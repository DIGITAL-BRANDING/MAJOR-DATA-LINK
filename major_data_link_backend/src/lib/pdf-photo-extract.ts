import { deflateSync, inflateSync } from 'node:zlib';
import { PDFArray, PDFBool, PDFDict, PDFDocument, PDFHexString, PDFName, PDFNumber, PDFRawStream, PDFRef, PDFString } from 'pdf-lib';

/**
 * Pulls the holder's photograph out of a provider-issued slip PDF.
 *
 * Why this exists: Techhub's NIN endpoints return the identity fields as JSON
 * but the photograph only inside the finished slip PDF (`pdf_base64`). To
 * build our own Personal Information slip from a Techhub Regular slip we read
 * the largest photo-like image out of that PDF.
 *
 * Image encodings handled:
 *  - DCTDecode (JPEG), alone or behind Flate/ASCII85/ASCIIHex: the decoded bytes
 *    ARE a JPEG file, used as-is.
 *  - FlateDecode (alone or behind ASCII85/ASCIIHex) Gray / RGB / Indexed
 *    (palette): re-wrapped as a PNG. PDF's PNG predictors and PNG scanline
 *    filtering are the same byte layout, so no pixel work is needed.
 *  - Fallback when the PDF's own structure can't be read or yields nothing:
 *    scan the raw bytes for JPEG streams.
 * CMYK, JPX and TIFF-predictor images are skipped. Never throws.
 */

export type ExtractedImage = { base64: string; format: 'jpeg' | 'png'; width: number; height: number };
export type PhotoExtraction = { image?: ExtractedImage; imagesInPdf: number; method?: 'pdf-objects' | 'jpeg-scan' };

const MIN_SIDE = 48;

type Candidate = ExtractedImage & { score: number };

// ── PDF dictionary helpers ───────────────────────────────────────────────

function num(dict: PDFDict, key: string): number | undefined {
  const value = dict.lookup(PDFName.of(key));
  return value instanceof PDFNumber ? value.asNumber() : undefined;
}

function filterNames(dict: PDFDict): string[] {
  const filter = dict.lookup(PDFName.of('Filter'));
  if (filter instanceof PDFName) return [filter.toString()];
  if (filter instanceof PDFArray) return filter.asArray().map((item) => String(dict.context.lookup(item)?.toString() ?? ''));
  return [];
}

/** DecodeParms for the filter at `index` (it can be a dict, or an array parallel to Filter). */
function paramsFor(dict: PDFDict, index: number): PDFDict | undefined {
  const params = dict.lookup(PDFName.of('DecodeParms')) ?? dict.lookup(PDFName.of('DP'));
  if (params instanceof PDFDict) return params;
  if (params instanceof PDFArray) {
    const entry = params.lookup(index);
    return entry instanceof PDFDict ? entry : undefined;
  }
  return undefined;
}

// ── Stream filters ───────────────────────────────────────────────────────

function ascii85(input: Buffer): Buffer {
  let text = input.toString('latin1').replace(/\s/g, '');
  if (text.startsWith('<~')) text = text.slice(2);
  const end = text.indexOf('~>');
  if (end !== -1) text = text.slice(0, end);
  const out: number[] = [];
  let group: number[] = [];
  const flush = (digits: number[], keep: number) => {
    let n = 0;
    for (const digit of digits) n = n * 85 + digit;
    const bytes = [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
    out.push(...bytes.slice(0, keep));
  };
  for (const ch of text) {
    if (ch === 'z' && group.length === 0) {
      out.push(0, 0, 0, 0);
      continue;
    }
    const digit = ch.charCodeAt(0) - 33;
    if (digit < 0 || digit > 84) throw new Error('bad ASCII85');
    group.push(digit);
    if (group.length === 5) {
      flush(group, 4);
      group = [];
    }
  }
  if (group.length > 1) {
    const pad = 5 - group.length;
    flush([...group, ...Array<number>(pad).fill(84)], 4 - pad);
  }
  return Buffer.from(out);
}

function asciiHex(input: Buffer): Buffer {
  const text = input.toString('latin1').replace(/[^0-9a-fA-F>]/g, '');
  const end = text.indexOf('>');
  const hex = end === -1 ? text : text.slice(0, end);
  return Buffer.from(hex.length % 2 ? `${hex}0` : hex, 'hex');
}

/** Applies the byte-level filters in order; undefined if one isn't supported. */
function decodeFilters(bytes: Buffer, names: string[]): Buffer | undefined {
  let current = bytes;
  for (const name of names) {
    if (name === '/FlateDecode' || name === '/Fl') current = inflateSync(current);
    else if (name === '/ASCII85Decode' || name === '/A85') current = ascii85(current);
    else if (name === '/ASCIIHexDecode' || name === '/AHx') current = asciiHex(current);
    else return undefined;
  }
  return current;
}

// ── PNG construction ─────────────────────────────────────────────────────

let crcTable: Uint32Array | undefined;
function crc32(buffer: Buffer): number {
  if (!crcTable) {
    crcTable = new Uint32Array(256);
    for (let n = 0; n < 256; n += 1) {
      let c = n;
      for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      crcTable[n] = c >>> 0;
    }
  }
  let crc = 0xffffffff;
  for (const byte of buffer) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Buffer): Buffer {
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

function toPng(width: number, height: number, bitDepth: number, colorType: 0 | 2 | 3, scanlines: Buffer, palette?: Buffer): Buffer {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = bitDepth;
  header[9] = colorType;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', header),
    ...(palette ? [pngChunk('PLTE', palette)] : []),
    pngChunk('IDAT', deflateSync(scanlines)),
    pngChunk('IEND', Buffer.alloc(0))
  ]);
}

// ── Colour spaces ────────────────────────────────────────────────────────

type PixelFormat = { colorType: 0 | 2 | 3; components: 1 | 3; validDepths: number[]; palette?: Buffer };

function componentsOfSpace(space: unknown): 1 | 3 | undefined {
  if (space instanceof PDFName) {
    const name = space.toString();
    if (name === '/DeviceRGB' || name === '/CalRGB' || name === '/RGB') return 3;
    if (name === '/DeviceGray' || name === '/CalGray' || name === '/G') return 1;
    return undefined;
  }
  if (space instanceof PDFArray && space.size() >= 1) {
    const head = String(space.lookup(0));
    if (head === '/ICCBased' && space.size() >= 2) {
      const profile = space.lookup(1);
      const n = profile instanceof PDFRawStream ? num(profile.dict, 'N') : undefined;
      return n === 1 || n === 3 ? n : undefined;
    }
    if (head === '/CalRGB') return 3;
    if (head === '/CalGray') return 1;
  }
  return undefined;
}

function pixelFormatOf(dict: PDFDict): PixelFormat | undefined {
  const space = dict.lookup(PDFName.of('ColorSpace'));
  if (space instanceof PDFArray && String(space.lookup(0)) === '/Indexed' && space.size() >= 4) {
    const baseComponents = componentsOfSpace(space.lookup(1));
    const hival = space.lookup(2);
    const table = space.lookup(3);
    if (!baseComponents || !(hival instanceof PDFNumber)) return undefined;
    let bytes: Buffer | undefined;
    if (table instanceof PDFHexString || table instanceof PDFString) bytes = Buffer.from(table.asBytes());
    else if (table instanceof PDFRawStream) bytes = decodeFilters(Buffer.from(table.contents), filterNames(table.dict));
    if (!bytes) return undefined;
    const entries = Math.min(hival.asNumber() + 1, 256);
    if (bytes.length < entries * baseComponents) return undefined;
    const palette = Buffer.alloc(entries * 3);
    for (let i = 0; i < entries; i += 1) {
      for (let c = 0; c < 3; c += 1) palette[i * 3 + c] = bytes[i * baseComponents + (baseComponents === 3 ? c : 0)];
    }
    return { colorType: 3, components: 1, validDepths: [1, 2, 4, 8], palette };
  }
  const components = componentsOfSpace(space);
  if (components === 3) return { colorType: 2, components: 3, validDepths: [8, 16] };
  if (components === 1) return { colorType: 0, components: 1, validDepths: [1, 2, 4, 8, 16] };
  return undefined;
}

// ── Candidates ───────────────────────────────────────────────────────────

/** Passport-style portrait/near-square: what an ID photo looks like (backgrounds and banners are not). */
const looksLikePortrait = (width: number, height: number) => width / height >= 0.55 && width / height <= 1.0;

function candidateFrom(stream: PDFRawStream, allowFlate: boolean): Candidate | undefined {
  const { dict } = stream;
  const width = num(dict, 'Width');
  const height = num(dict, 'Height');
  if (!width || !height || width < MIN_SIDE || height < MIN_SIDE) return undefined;
  const aspect = width / height;
  if (aspect < 0.4 || aspect > 2.5) return undefined; // rules, banners, barcodes

  const filters = filterNames(dict);
  if (filters.length === 0) return undefined;
  const area = width * height;
  const source = Buffer.from(stream.contents);

  if (filters[filters.length - 1] === '/DCTDecode' || filters[filters.length - 1] === '/DCT') {
    const cs = dict.lookup(PDFName.of('ColorSpace'));
    if (cs instanceof PDFName && cs.toString() === '/DeviceCMYK') return undefined;
    const bytes = decodeFilters(source, filters.slice(0, -1));
    if (!bytes || bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return undefined;
    // Photographs are JPEGs, while page backgrounds, QR codes and crests are
    // Flate PNGs (dompdf, FPDF...) - so a JPEG always outranks them, and a
    // portrait-shaped JPEG outranks any other JPEG. Within a tier, bigger wins.
    return { base64: bytes.toString('base64'), format: 'jpeg', width, height, score: (looksLikePortrait(width, height) ? 2e9 : 1e9) + area };
  }

  // Flate images are only considered when the PDF has no JPEG at all (a
  // photograph stored losslessly). Skipped otherwise: they are the expensive
  // ones to convert and are almost never the photograph.
  if (!allowFlate) return undefined;

  const format = pixelFormatOf(dict);
  if (!format || filters[filters.length - 1] !== '/FlateDecode') return undefined;
  const bitDepth = num(dict, 'BitsPerComponent') ?? 8;
  if (!format.validDepths.includes(bitDepth)) return undefined;
  const raw = decodeFilters(source, filters);
  if (!raw) return undefined;

  const params = paramsFor(dict, filters.length - 1);
  const predictor = params ? (num(params, 'Predictor') ?? 1) : 1;
  const rowBytes = Math.ceil((width * format.components * bitDepth) / 8);

  let scanlines: Buffer;
  if (predictor >= 10) {
    if (raw.length !== height * (rowBytes + 1)) return undefined; // already PNG-filtered rows
    scanlines = raw;
  } else if (predictor === 1) {
    if (raw.length !== height * rowBytes) return undefined;
    scanlines = Buffer.alloc(height * (rowBytes + 1)); // prefix each row with filter type 0
    for (let row = 0; row < height; row += 1) raw.copy(scanlines, row * (rowBytes + 1) + 1, row * rowBytes, (row + 1) * rowBytes);
  } else {
    return undefined; // TIFF predictor: not worth supporting
  }
  const png = toPng(width, height, bitDepth, format.colorType, scanlines, format.palette);
  // An image with a soft mask (/SMask) is an overlay - logo, QR code, page
  // template - not a photograph, so unmasked portrait images rank first.
  const masked = dict.has(PDFName.of('SMask')) || dict.has(PDFName.of('Mask'));
  const score = (masked ? 0 : 5e8) + (looksLikePortrait(width, height) ? 2.5e8 : 0) + area;
  return { base64: png.toString('base64'), format: 'png', width, height, score };
}

// ── Raw JPEG scan (fallback) ─────────────────────────────────────────────

/** Width/height/components from a JPEG's SOF marker, walking segments (skips EXIF thumbnails). */
function jpegInfo(buffer: Buffer): { width: number; height: number; components: number } | undefined {
  let i = 2;
  while (i + 9 < buffer.length) {
    if (buffer[i] !== 0xff) {
      i += 1;
      continue;
    }
    const marker = buffer[i + 1];
    if (marker === 0xff) {
      i += 1;
      continue;
    }
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      return { height: buffer.readUInt16BE(i + 5), width: buffer.readUInt16BE(i + 7), components: buffer[i + 9] };
    }
    if (marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) {
      i += 2;
      continue;
    }
    i += 2 + buffer.readUInt16BE(i + 2);
  }
  return undefined;
}

function scanForJpegs(bytes: Buffer): Candidate[] {
  const found: Candidate[] = [];
  const signature = Buffer.from([0xff, 0xd8, 0xff]);
  let from = 0;
  while (from < bytes.length) {
    const start = bytes.indexOf(signature, from);
    if (start === -1) break;
    const stop = bytes.indexOf('endstream', start, 'latin1');
    if (stop === -1) break;
    let end = stop;
    while (end > start && (bytes[end - 1] === 0x0a || bytes[end - 1] === 0x0d || bytes[end - 1] === 0x20)) end -= 1;
    const looksComplete = end - start > 200 && bytes[end - 2] === 0xff && bytes[end - 1] === 0xd9;
    const info = looksComplete ? jpegInfo(bytes.subarray(start, end)) : undefined;
    if (info && info.width >= MIN_SIDE && info.height >= MIN_SIDE && info.components !== 4) {
      const aspect = info.width / info.height;
      if (aspect >= 0.4 && aspect <= 2.5) {
        found.push({ base64: bytes.subarray(start, end).toString('base64'), format: 'jpeg', width: info.width, height: info.height, score: info.width * info.height * 2 });
      }
      from = end;
    } else {
      from = start + 3;
    }
  }
  return found;
}

function best(candidates: Candidate[]): ExtractedImage | undefined {
  const top = [...candidates].sort((a, b) => b.score - a.score)[0];
  return top ? { base64: top.base64, format: top.format, width: top.width, height: top.height } : undefined;
}

export async function extractPhotoFromPdf(pdfBase64: string): Promise<PhotoExtraction> {
  let imagesInPdf = 0;
  let bytes: Buffer;
  try {
    bytes = Buffer.from(pdfBase64.replace(/^data:application\/pdf;base64,/i, '').replace(/\s/g, ''), 'base64');
    if (bytes.length < 100 || bytes.subarray(0, 5).toString('latin1') !== '%PDF-') return { imagesInPdf };
  } catch {
    return { imagesInPdf };
  }

  try {
    const doc = await PDFDocument.load(bytes, { ignoreEncryption: true, updateMetadata: false, throwOnInvalidObject: false });
    const streams: { ref: string; stream: PDFRawStream }[] = [];
    const maskRefs = new Set<string>();
    for (const [ref, object] of doc.context.enumerateIndirectObjects()) {
      if (!(object instanceof PDFRawStream)) continue;
      if (object.dict.lookup(PDFName.of('Subtype')) !== PDFName.of('Image')) continue;
      streams.push({ ref: ref.toString(), stream: object });
      // The alpha channel / stencil of another image is stored as its own Image
      // XObject (a large grey picture). It is never the photograph.
      for (const key of ['SMask', 'Mask']) {
        const target = object.dict.get(PDFName.of(key));
        if (target instanceof PDFRef) maskRefs.add(target.toString());
      }
    }
    const images = streams.filter(({ ref, stream }) => !maskRefs.has(ref) && stream.dict.lookup(PDFName.of('ImageMask')) !== PDFBool.True).map(({ stream }) => stream);
    imagesInPdf = images.length;
    // Pass 1: JPEGs only. Pass 2 (Flate/PNG-style images) only if pass 1 found nothing.
    for (const allowFlate of [false, true]) {
      const candidates: Candidate[] = [];
      for (const stream of images) {
        try {
          const candidate = candidateFrom(stream, allowFlate);
          if (candidate) candidates.push(candidate);
        } catch {
          // One undecodable image must not stop us finding the photo.
        }
      }
      const image = best(candidates);
      if (image) return { image, imagesInPdf, method: 'pdf-objects' };
    }
  } catch (error) {
    console.error('[pdf-photo-extract] could not parse the PDF structure, scanning raw bytes:', error instanceof Error ? error.message : error);
  }

  try {
    const scanned = scanForJpegs(bytes);
    imagesInPdf = Math.max(imagesInPdf, scanned.length);
    const image = best(scanned);
    if (image) return { image, imagesInPdf, method: 'jpeg-scan' };
  } catch {
    // fall through
  }
  return { imagesInPdf };
}
