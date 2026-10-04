import { describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { buildPdf, formatNin, qrPayload, splitFields, type IdentitySlipParams, type PdfDoc } from '../identity-slip-common.js';
import { drawPremiumPortrait, drawRegularForm, drawSmartIdCard, drawStandardDigital, drawVninRecord } from '../identity-slip-layouts.js';
import { renderIdentitySlipPdf } from '../render-identity-slip-pdf.js';

// 1x1 transparent PNG - a valid image, so the photo path runs without a fixture file.
const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

const base: IdentitySlipParams = {
  title: 'NIN Slip',
  subtitle: 'Verified by NIN',
  reference: 'FV-REF-123',
  issuedAt: new Date('2026-10-04T00:36:38Z'),
  photo: { base64: PNG, format: 'png' },
  fields: [
    { label: 'First Name', value: 'ADAEZE' },
    { label: 'Middle Name', value: 'CHIAMAKA' },
    { label: 'Surname', value: 'OKONKWO' },
    { label: 'NIN', value: '12345678901' },
    { label: 'Gender', value: 'Female' },
    { label: 'Date of Birth', value: '1990-03-14' },
    { label: 'Phone', value: '08012345678' },
    { label: 'Address', value: '12 Sample Street, Ikeja' }
  ]
};

/** PDFKit writes text as hex chunks (split at kerning points); stitch them back together. */
async function textOf(draw: (doc: PdfDoc, p: IdentitySlipParams) => void, params: IdentitySlipParams = base) {
  const raw = Buffer.from(await buildPdf((doc) => draw(doc, params), { compress: false }), 'base64').toString('latin1');
  return [...raw.matchAll(/<([0-9a-fA-F]{2,})>/g)].map((m) => Buffer.from(m[1], 'hex').toString('latin1')).join('');
}
const pages = (b64: string) => (Buffer.from(b64, 'base64').toString('latin1').match(/\/Type \/Page\b/g) ?? []).length;
// PDFs embed a creation timestamp and a random /ID, so two renders of the same
// layout never hash equal; strip those before comparing.
const hash = (b64: string) =>
  createHash('sha256')
    .update(Buffer.from(b64, 'base64').toString('latin1').replace(/\/CreationDate \([^)]*\)/g, '').replace(/\/ID \[[^\]]*\]/g, ''))
    .digest('hex');

describe('NIN slip layouts', () => {
  it('renders six visually distinct, single-page PDFs - one per tier', async () => {
    const out = await Promise.all((['premium', 'standard', 'regular', 'vnin', 'smart', 'portrait'] as const).map((tier) => renderIdentitySlipPdf({ ...base, tier })));
    out.forEach((pdf) => {
      expect(Buffer.from(pdf, 'base64').subarray(0, 5).toString()).toBe('%PDF-');
      expect(pages(pdf)).toBe(1);
    });
    expect(new Set(out.map(hash)).size).toBe(6);
    // Same tier twice = byte-identical layout (proves the hash really ignores only timestamps).
    expect(hash(await renderIdentitySlipPdf({ ...base, tier: 'regular' }))).toBe(hash(out[2]));
  });

  it('standard, regular, smart and portrait print the NIN grouped and carry the not-NIMC disclaimer', async () => {
    for (const draw of [drawStandardDigital, drawRegularForm, drawSmartIdCard, drawPremiumPortrait]) {
      const text = await textOf(draw);
      expect(text).toContain('1234 567 8901');
      expect(text).toContain('OKONKWO');
      expect(text).toContain('not a document issued or certified by NIMC');
    }
  });

  it('vNIN record withholds the NIN number but still shows the identity details', async () => {
    const text = await textOf(drawVninRecord);
    expect(text).not.toContain('12345678901');
    expect(text).not.toContain('1234 567 8901');
    expect(text).not.toContain('08012345678');
    expect(text).toContain('OKONKWO');
    expect(text).toContain('ADAEZE CHIAMAKA');
    expect(text).toContain('SUCCESSFUL');
  });

  it('never uses government/agency wording on any layout', async () => {
    for (const draw of [drawStandardDigital, drawRegularForm, drawVninRecord, drawSmartIdCard, drawPremiumPortrait]) {
      const text = await textOf(draw);
      expect(text).not.toMatch(/Federal Republic|NATIONAL IDENTITY MANAGEMENT|Verification as a Service/i);
      expect(text).toContain('K-TECH SOLUTIONS');
    }
  });

  it.each([
    ['no photo', { ...base, photo: undefined }],
    ['an undecodable photo', { ...base, photo: { base64: 'bm90LWFuLWltYWdl', format: 'jpeg' as const } }],
    ['missing fields', { ...base, fields: [{ label: 'Surname', value: 'OKONKWO' }] }]
  ])('still renders every tier with %s', async (_name, params) => {
    for (const tier of ['premium', 'standard', 'regular', 'vnin', 'smart', 'portrait'] as const) {
      vi.spyOn(console, 'error').mockImplementation(() => undefined);
      const pdf = await renderIdentitySlipPdf({ ...params, tier });
      expect(pages(pdf)).toBeGreaterThanOrEqual(1);
    }
    vi.restoreAllMocks();
  });

  it('spills long field lists onto a second page instead of overflowing', async () => {
    const many = [...base.fields, ...Array.from({ length: 30 }, (_v, i) => ({ label: `Extra ${i}`, value: `value ${i}` }))];
    expect(pages(await renderIdentitySlipPdf({ ...base, fields: many, tier: 'standard' }))).toBeGreaterThan(1);
  });

  it('smart card has a front and a back; portrait keeps every field by continuing onto a second page', async () => {
    const smart = await textOf(drawSmartIdCard);
    expect(smart).toContain('SMART ID CARD SLIP');
    expect(smart).toContain('not an identity document');
    const many = [...base.fields, ...Array.from({ length: 14 }, (_v, i) => ({ label: `Extra ${i}`, value: `value ${i}` }))];
    const portrait = await renderIdentitySlipPdf({ ...base, fields: many, tier: 'portrait' });
    expect(pages(portrait)).toBe(2);
    const text = await textOf(drawPremiumPortrait, { ...base, fields: many });
    expect(text).toContain('value 13');
  });

  it('keeps the original looks for BVN slips and for NIN slips with no tier', async () => {
    const bvn = { ...base, title: 'BVN Slip' as const, fields: [{ label: 'BVN', value: '22222222222' }] };
    const plainNin = await renderIdentitySlipPdf({ ...base });
    const standardNin = await renderIdentitySlipPdf({ ...base, tier: 'standard' });
    expect(hash(plainNin)).not.toBe(hash(standardNin));
    // BVN 'standard'/'regular' both fall through to the single original plain layout.
    expect(hash(await renderIdentitySlipPdf({ ...bvn, tier: 'standard' }))).toBe(hash(await renderIdentitySlipPdf({ ...bvn })));
  });
});

describe('helpers', () => {
  it('formats only 11-digit NINs', () => {
    expect(formatNin('12345678901')).toBe('1234 567 8901');
    expect(formatNin('1234')).toBe('1234');
    expect(formatNin(undefined)).toBeUndefined();
  });

  it('QR carries only our reference, never identity data', () => {
    expect(qrPayload('FV-1')).toBe('K-TECH-REF:FV-1');
  });

  it('splitFields pulls out headline fields by label and keeps the rest in order', () => {
    const f = splitFields([
      { label: 'First Name', value: 'A' }, { label: 'Middle Name', value: '' }, { label: 'Surname', value: 'B' },
      { label: 'National Identification Number (NIN)', value: '1' }, { label: 'Phone', value: '080' }, { label: 'Address', value: 'x' }
    ]);
    expect(f).toMatchObject({ firstName: 'A', surname: 'B', nin: '1', givenNames: 'A' });
    expect(f.middleName).toBeUndefined();
    expect(f.rest.map((r) => r.label)).toEqual(['Phone', 'Address']);
  });
});
