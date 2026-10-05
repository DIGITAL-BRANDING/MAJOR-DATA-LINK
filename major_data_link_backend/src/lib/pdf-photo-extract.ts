import { deflateSync, inflateSync } from 'node:zlib';
import { PDFArray, PDFDict, PDFDocument, PDFName, PDFNumber, PDFRawStream } from 'pdf-lib';

/**
 * Pulls the holder's photograph out of a provider-issued slip PDF.
 *
 * Why this exists: Techhub's NIN endpoints return the identity fields as JSON
 * but the photograph only inside the finished slip PDF (`pdf_base64`), never as
 * a JSON field. To build our own Personal Information slip from a Techhub
 * Regular slip we read the largest photo-like image out of that PDF.
 *
 * Handles the two encodings real slip generators use:
 *  - DCTDecode (JPEG): the stream bytes ARE a JPEG file, used as-is.
 *  - FlateDecode RGB/Gray 8-bit: re-wrapped as a PNG (PDF's PNG predictors and
 *    PNG scanline filtering are the same byte layout, so no pixel work).
 * Anything else (CMYK, indexed, JPX, 16-bit) is skipped. Never throws.
 */

export type ExtractedImage = { base64: string; format: 'jpeg' | 'png'; width: number; height: number };
export type PhotoExtraction = { image?: ExtractedImage; imagesInPdf: number };

const MIN_SIDE = 48;

type Candidate = ExtractedImage & { score: number };

function num(dict: PDFDict, key: string): number | undefined {
  const value = dict.lookup(PDFName.of(key));
  return value instanceof PDFNumber ? value.asNumber() : undefined;
}

function filterNames(dict: PDFDict): string[] {
  const filter = dict.lookup(PDFName.of('Filter'));
  if (filter instanceof PDFName) return [filter.toString()];
  if (filter instanceof PDFArray) {
    return filter.asArray().map((item) => String(dict.context.lookup(item)?.toString() ?? ''));
  }
  return [];
}

/** Components per pixel for DeviceRGB/DeviceGray/ICCBased(N=1|3); undefined = unsupported. */
function componentsOf(dict: PDFDict): number | undefined {
  const space = dict.lookup(PDFName.of('ColorSpace'));
  if (space instanceof PDFName) {
    const name = space.toString();
    if (name === '/DeviceRGB') return 3;
    if (name === '/DeviceGray') return 1;
    return undefined;
  }
  if (space instanceof PDFArray && space.size() >= 2 && String(space.lookup(0)) === '/ICCBased') {
    const profile = space.lookup(1);
    if (profile instanceof PDFRawStream) {
      const n = num(profile.dict, 'N');
      return n === 1 || n === 3 ? n : undefined;
    }
  }
  return undefined;
}

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

function toPng(width: number, height: number, components: number, scanlines: Buffer): Buffer {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8; // bit depth
  header[9] = components === 3 ? 2 : 0; // colour type: RGB / grayscale
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', header),
    pngChunk('IDAT', deflateSync(scanlines)),
    pngChunk('IEND', Buffer.alloc(0))
  ]);
}

function candidateFrom(stream: PDFRawStream): Candidate | undefined {
  const { dict } = stream;
  const width = num(dict, 'Width');
  const height = num(dict, 'Height');
  if (!width || !height || width < MIN_SIDE || height < MIN_SIDE) return undefined;
  const aspect = width / height;
  if (aspect < 0.4 || aspect > 2.5) return undefined; // rules, banners, barcodes

  const filters = filterNames(dict);
  const area = width * height;

  if (filters.length === 1 && filters[0] === '/DCTDecode') {
    const bytes = Buffer.from(stream.contents);
    if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return undefined;
    const cs = dict.lookup(PDFName.of('ColorSpace'));
    if (cs instanceof PDFName && cs.toString() === '/DeviceCMYK') return undefined;
    // Photographs are JPEGs; crests/logos are usually Flate PNGs - prefer JPEG.
    return { base64: bytes.toString('base64'), format: 'jpeg', width, height, score: area * 2 };
  }

  if (filters.length === 1 && filters[0] === '/FlateDecode') {
    const components = componentsOf(dict);
    if (!components || (num(dict, 'BitsPerComponent') ?? 8) !== 8) return undefined;
    const raw = inflateSync(Buffer.from(stream.contents));
    const params = dict.lookup(PDFName.of('DecodeParms'));
    const predictor = params instanceof PDFDict ? (num(params, 'Predictor') ?? 1) : 1;
    const rowBytes = width * components;

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
    return { base64: toPng(width, height, components, scanlines).toString('base64'), format: 'png', width, height, score: area };
  }
  return undefined;
}

export async function extractPhotoFromPdf(pdfBase64: string): Promise<PhotoExtraction> {
  let imagesInPdf = 0;
  try {
    const bytes = Buffer.from(pdfBase64.replace(/^data:application\/pdf;base64,/i, '').replace(/\s/g, ''), 'base64');
    if (bytes.length < 100 || bytes.subarray(0, 5).toString('latin1') !== '%PDF-') return { imagesInPdf };

    const doc = await PDFDocument.load(bytes, { ignoreEncryption: true, updateMetadata: false, throwOnInvalidObject: false });
    const candidates: Candidate[] = [];
    for (const [, object] of doc.context.enumerateIndirectObjects()) {
      if (!(object instanceof PDFRawStream)) continue;
      if (object.dict.lookup(PDFName.of('Subtype')) !== PDFName.of('Image')) continue;
      imagesInPdf += 1;
      try {
        const candidate = candidateFrom(object);
        if (candidate) candidates.push(candidate);
      } catch {
        // One undecodable image must not stop us finding the photo.
      }
    }
    candidates.sort((a, b) => b.score - a.score);
    const best = candidates[0];
    return best ? { image: { base64: best.base64, format: best.format, width: best.width, height: best.height }, imagesInPdf } : { imagesInPdf };
  } catch (error) {
    console.error('[pdf-photo-extract] could not read the PDF:', error instanceof Error ? error.message : error);
    return { imagesInPdf };
  }
}
