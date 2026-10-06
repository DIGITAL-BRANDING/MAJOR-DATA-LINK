import { describe, expect, it } from 'vitest';
import { collectObjects, findEmbeddedImage, findEmbeddedPdf } from '../provider-response-scan.js';
import { JPEG_PHOTO_B64, makePdfWithImages, makePng } from '../../test-utils/slip-fixtures.js';

const png = makePng(60, 60).toString('base64');

describe('findEmbeddedImage', () => {
  it('finds a base64 JPEG by its bytes, whatever the key is called and however deep it sits', () => {
    const body = { status: 'success', user_data: { first_name: 'A', meta: { list: [{ weird_key_xyz: JPEG_PHOTO_B64 }] } } };
    expect(findEmbeddedImage(body)).toEqual({ base64: JPEG_PHOTO_B64, format: 'jpeg', key: 'weird_key_xyz' });
  });

  it('accepts data: URIs and strips whitespace/newlines', () => {
    const wrapped = JPEG_PHOTO_B64.replace(/(.{76})/g, '$1\n');
    expect(findEmbeddedImage({ photo: `data:image/jpeg;base64,${wrapped}` })?.base64).toBe(JPEG_PHOTO_B64);
  });

  it('prefers a field named like a photo over a larger unnamed image', () => {
    const big = makePng(200, 200).toString('base64');
    expect(findEmbeddedImage({ banner: big, passport_photo: png })?.key).toBe('passport_photo');
  });

  it('ignores PDFs, short strings, plain text and non-image base64', () => {
    expect(findEmbeddedImage({ pdf_base64: 'JVBERi0xLjQK'.repeat(30), note: 'hello', short: 'abc', text: 'x'.repeat(500), nin: '12345678901' })).toBeUndefined();
  });
});

describe('findEmbeddedPdf', () => {
  it('finds a base64 PDF under any key and ignores images', async () => {
    const pdf = await makePdfWithImages([]);
    expect(findEmbeddedPdf({ a: { slip_file: pdf }, photo: JPEG_PHOTO_B64 })).toBe(pdf);
    expect(findEmbeddedPdf({ photo: JPEG_PHOTO_B64 })).toBeUndefined();
  });
});

describe('collectObjects', () => {
  it('lists every object shallowest-first, through arrays', () => {
    const objects = collectObjects({ a: 1, b: { c: { d: 1 } }, e: [{ f: 1 }] });
    expect(objects[0]).toHaveProperty('a');
    expect(objects).toHaveLength(4);
  });
});
