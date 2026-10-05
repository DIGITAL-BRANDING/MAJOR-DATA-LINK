import { describe, expect, it, vi } from 'vitest';
import { inflateSync } from 'node:zlib';
import { extractPhotoFromPdf } from '../pdf-photo-extract.js';
import { JPEG_PHOTO_B64, makePdfWithImages, makePdfWithRawFlateImage, makePng } from '../../test-utils/slip-fixtures.js';

const jpeg = Buffer.from(JPEG_PHOTO_B64, 'base64');

/** Reads width/height and the inflated scanline size back out of a PNG. */
function inspectPng(base64: string) {
  const png = Buffer.from(base64, 'base64');
  expect(png.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
  let offset = 8;
  let width = 0;
  let height = 0;
  const idat: Buffer[] = [];
  while (offset < png.length) {
    const length = png.readUInt32BE(offset);
    const type = png.subarray(offset + 4, offset + 8).toString('ascii');
    const data = png.subarray(offset + 8, offset + 8 + length);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
    }
    if (type === 'IDAT') idat.push(data);
    offset += 12 + length;
  }
  return { width, height, scanlineBytes: inflateSync(Buffer.concat(idat)).length };
}

describe('extractPhotoFromPdf', () => {
  it('picks the large JPEG photo over a small PNG crest', async () => {
    const pdf = await makePdfWithImages([makePng(70, 70), jpeg]);
    const result = await extractPhotoFromPdf(pdf);
    expect(result.imagesInPdf).toBe(2);
    expect(result.image).toMatchObject({ format: 'jpeg', width: 100, height: 125 });
    expect(Buffer.from(result.image!.base64, 'base64').subarray(0, 2).toString('hex')).toBe('ffd8');
  });

  it('returns the JPEG bytes untouched (no re-encoding)', async () => {
    const result = await extractPhotoFromPdf(await makePdfWithImages([jpeg]));
    expect(Buffer.from(result.image!.base64, 'base64').equals(jpeg)).toBe(true);
  });

  it('re-wraps a Flate/predictor PNG photo as a valid PNG', async () => {
    const result = await extractPhotoFromPdf(await makePdfWithImages([makePng(90, 110)]));
    expect(result.image?.format).toBe('png');
    expect(inspectPng(result.image!.base64)).toEqual({ width: 90, height: 110, scanlineBytes: 110 * (1 + 90 * 3) });
  });

  it('handles a raw RGB Flate image with no predictor', async () => {
    const result = await extractPhotoFromPdf(await makePdfWithRawFlateImage(80, 100));
    expect(result.image?.format).toBe('png');
    expect(inspectPng(result.image!.base64)).toEqual({ width: 80, height: 100, scanlineBytes: 100 * (1 + 80 * 3) });
  });

  it('ignores tiny images (icons/bullets)', async () => {
    const result = await extractPhotoFromPdf(await makePdfWithImages([makePng(20, 20)]));
    expect(result.imagesInPdf).toBe(1);
    expect(result.image).toBeUndefined();
  });

  it('reports no image for a PDF without pictures', async () => {
    const result = await extractPhotoFromPdf(await makePdfWithImages([]));
    expect(result).toEqual({ imagesInPdf: 0 });
  });

  it('never throws on garbage, empty or non-PDF input', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    for (const input of ['', 'not base64 at all!!', Buffer.from('%PDF-1.4 broken broken broken broken broken broken broken broken broken broken broken broken').toString('base64'), Buffer.from('hello world, not a pdf '.repeat(10)).toString('base64')]) {
      await expect(extractPhotoFromPdf(input)).resolves.toMatchObject({ imagesInPdf: 0 });
    }
    vi.restoreAllMocks();
  });
});
