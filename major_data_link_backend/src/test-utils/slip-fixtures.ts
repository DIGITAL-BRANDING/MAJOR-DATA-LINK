import { deflateSync } from 'node:zlib';
import PDFDocument from 'pdfkit';
import { PDFDocument as LibPdf, PDFName } from 'pdf-lib';

/** Specimen JPEG (100x125 silhouette) - synthetic, not a real person. */
export const JPEG_PHOTO_B64 =
  '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAA4KCw0LCQ4NDA0QDw4RFiQXFhQUFiwgIRokNC43NjMuMjI6QVNGOj1OPjIySGJJTlZYXV5dOEVmbWVabFNbXVn/2wBDAQ8QEBYTFioXFypZOzI7WVlZWVlZWVlZWVlZWVlZWVlZWVlZWVlZWVlZWVlZWVlZWVlZWVlZWVlZWVlZWVlZWVn/wAARCAB9AGQDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwDrqKKK1ICiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKzLvXLS3JVGM74/g6Z7c/4Zqhr+qHcbO3cbcYlZTzn+7/j+XrXP1jOpbRG0Kd9WdHH4mQuBJasqdyr5P5YFa1nf296uYJAWxkoeGH4fjXDU+GWSCVZYmKOpyCKhVWtynST2O/oqnpd8t/aiT5RKOHUdj/8AXq5XQnfU52raBRRRTAKKKKACiiigAqO4l8i3llxu8tC2M4zgZqSs/Xv+QPP/AMB/9CFJuyuNK7scczF2LMSzE5JJ5JpKKK4zsCiiikBreHJzHqQj5KyqQRnjI5z+h/OusrhdP/5CNr/11T+Yruq6aT0OeqtQooorUyCiiigAooooAKq6nD9o064jwxJQkBepI5A/MVaopNXBOx57RV7V7E2N2VH+qf5kPPA9Pw/wqjXG1Z2OxO6uFFFFIZe0WHz9UgBDYU7yR2xyP1xXaVieHLEwwm6k+/KMKOeF/wDr8f5NbddVNWRzVHdhRRRWhmFFFFABRRRQAUUUUAQ3drFeQNDMuVPQ9wfUVzN3oN3ASYcToBnK8H8v8M11lFRKCluVGbjscPHpt7I4VbWUE/3lKj8zxWzp2gbHWW8KtjkRDkfif6Vv0VKpJFOq2FFFFamYUUUUAFFFFABVbU/+QXef9cX/APQTVmq2p/8AILvP+uL/APoJoQHnVFFFbiCiiigAooooAKKKKANTw5/yHLb/AIF/6Ca7quF8Of8AIctv+Bf+gmu6rKe4BRRRUjCq2p/8gu8/64v/AOgmrNVtT/5Bd5/1xf8A9BNCA86ooorcQUUUUAFFFFABRRRQBqeHP+Q5bf8AAv8A0E13VcL4c/5Dlt/wL/0E13VZT3AKKKKkYVW1P/kF3n/XF/8A0E1Zqtqf/ILvP+uL/wDoJoQHnVFFFbiCiiigAooooAKKKKANTw5/yHLb/gX/AKCa7quF8Of8hy2/4F/6Ca7qsp7gFFFFSM//2Q==';

/** Minimal valid PNG with the given size (solid colour), built by hand. */
export function makePng(width: number, height: number, rgb: [number, number, number] = [30, 120, 90]): Buffer {
  const crcTable = Array.from({ length: 256 }, (_v, n) => {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc = (buf: Buffer) => {
    let c = 0xffffffff;
    for (const byte of buf) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type: string, data: Buffer) => {
    const body = Buffer.concat([Buffer.from(type), data]);
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const sum = Buffer.alloc(4);
    sum.writeUInt32BE(crc(body));
    return Buffer.concat([len, body, sum]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  const row = Buffer.concat([Buffer.from([0]), Buffer.from(Array.from({ length: width }, () => rgb).flat())]);
  const raw = Buffer.concat(Array.from({ length: height }, () => row));
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

/** A PDF (as base64) that embeds the given images the way real slip generators do (pdfkit: JPEG=DCT, PNG=Flate+predictor). */
export function makePdfWithImages(images: Buffer[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 20 });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks).toString('base64')));
    doc.on('error', reject);
    doc.fontSize(12).text('Specimen slip');
    images.forEach((img, i) => doc.image(img, 40 + i * 120, 80, { fit: [100, 120] }));
    doc.end();
  });
}

/** A PDF whose only image is a raw RGB Flate stream with NO predictor (what some PHP generators emit). */
export async function makePdfWithRawFlateImage(width: number, height: number): Promise<string> {
  const lib = await LibPdf.create();
  const page = lib.addPage([300, 300]);
  const pixels = Buffer.alloc(width * height * 3);
  for (let i = 0; i < pixels.length; i += 3) {
    pixels[i] = 200;
    pixels[i + 1] = (i / 3) % 255;
    pixels[i + 2] = 40;
  }
  const stream = lib.context.stream(deflateSync(pixels), {
    Type: 'XObject', Subtype: 'Image', Width: width, Height: height, ColorSpace: 'DeviceRGB', BitsPerComponent: 8, Filter: 'FlateDecode'
  });
  const ref = lib.context.register(stream);
  page.node.Resources()?.set(PDFName.of('XObject'), lib.context.obj({ Im0: ref }));
  return Buffer.from(await lib.save()).toString('base64');
}

/** PNG with a 4-colour palette (colour type 3, 8-bit), like palette PNGs embedded by FPDF/pdfkit. */
export function makeIndexedPng(width: number, height: number): Buffer {
  const crcTable = Array.from({ length: 256 }, (_v, n) => {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc = (buf: Buffer) => {
    let c = 0xffffffff;
    for (const byte of buf) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type: string, data: Buffer) => {
    const body = Buffer.concat([Buffer.from(type), data]);
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const sum = Buffer.alloc(4);
    sum.writeUInt32BE(crc(body));
    return Buffer.concat([len, body, sum]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 3;
  const palette = Buffer.from([255, 0, 0, 0, 255, 0, 0, 0, 255, 255, 255, 0]);
  const rows = Buffer.concat(Array.from({ length: height }, (_v, y) => Buffer.concat([Buffer.from([0]), Buffer.from(Array.from({ length: width }, (_w, x) => (x + y) % 4))])));
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('PLTE', palette), chunk('IDAT', deflateSync(rows)), chunk('IEND', Buffer.alloc(0))]);
}

export function ascii85Encode(input: Buffer): string {
  let out = '';
  for (let i = 0; i < input.length; i += 4) {
    const chunk = input.subarray(i, i + 4);
    const padded = Buffer.concat([chunk, Buffer.alloc(4 - chunk.length)]);
    let n = padded.readUInt32BE(0);
    const digits: string[] = [];
    for (let d = 0; d < 5; d += 1) {
      digits.unshift(String.fromCharCode((n % 85) + 33));
      n = Math.floor(n / 85);
    }
    out += digits.slice(0, chunk.length + 1).join('');
  }
  return `${out}~>`;
}

/** A PDF whose only image is a JPEG behind extra filters (e.g. [/FlateDecode /DCTDecode] or [/ASCII85Decode /DCTDecode]). */
export async function makePdfWithWrappedJpeg(jpeg: Buffer, mode: 'flate' | 'ascii85'): Promise<string> {
  const lib = await LibPdf.create();
  const page = lib.addPage([300, 300]);
  const contents = mode === 'flate' ? deflateSync(jpeg) : Buffer.from(ascii85Encode(jpeg), 'latin1');
  const stream = lib.context.stream(contents, {
    Type: 'XObject', Subtype: 'Image', Width: 100, Height: 125, ColorSpace: 'DeviceRGB', BitsPerComponent: 8,
    Filter: lib.context.obj([mode === 'flate' ? 'FlateDecode' : 'ASCII85Decode', 'DCTDecode'])
  });
  const ref = lib.context.register(stream);
  page.node.Resources()?.set(PDFName.of('XObject'), lib.context.obj({ Im0: ref }));
  return Buffer.from(await lib.save()).toString('base64');
}

/** A damaged PDF: header + a JPEG stream whose dictionary says nothing about being an image, then junk. */
export function makeDamagedPdfWithJpeg(jpeg: Buffer): string {
  return Buffer.concat([
    Buffer.from('%PDF-1.4\n1 0 obj\n<< /Length 999999 >>\nstream\n'),
    jpeg,
    Buffer.from('\nendstream\nendobj\ntrailer << /Root 9 0 R >>\nstartxref\n1\n%%EOF\n'.repeat(1)),
    Buffer.alloc(80, 0x20)
  ]).toString('base64');
}
