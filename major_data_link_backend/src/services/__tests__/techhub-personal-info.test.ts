import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { JPEG_PHOTO_B64, makePdfWithImages, makePng } from '../../test-utils/slip-fixtures.js';

vi.mock('../../lib/prisma.js', () => ({ prisma: {} }));

const realFetch = globalThis.fetch;
function mockFetch(body: unknown, status = 200) {
  const fn = vi.fn(async () => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } }));
  globalThis.fetch = fn as never;
  return fn;
}
const calledUrl = (fn: ReturnType<typeof vi.fn>) => String((fn.mock.calls[0] as unknown[])[0]);
const calledBody = (fn: ReturnType<typeof vi.fn>) => JSON.parse(String(((fn.mock.calls[0] as unknown[])[1] as RequestInit).body));

const IDENTITY = { nin: '12345678901', first_name: 'SPECIMEN', last_name: 'PERSON', middle_name: '', gender: 'F', date_of_birth: '1990-01-01', address: '1 Sample Street' };

beforeEach(() => {
  vi.resetModules();
  process.env.TECHHUB_API_KEY = 'test-key';
  vi.spyOn(console, 'info').mockImplementation(() => undefined);
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});
afterEach(() => {
  globalThis.fetch = realFetch;
  vi.restoreAllMocks();
});
const load = async () => (await import('../techhub.service.js')).techhubService;

describe('Techhub Personal Info slip (built from the REGULAR slip response)', () => {
  it('calls the regular NIN endpoint - not premium', async () => {
    const pdf = await makePdfWithImages([makePng(60, 60), Buffer.from(JPEG_PHOTO_B64, 'base64')]);
    const fetchMock = mockFetch({ status: 'success', user_data: IDENTITY, pdf_base64: pdf });
    await (await load()).ninPersonalInfoByNin('12345678901');
    expect(calledUrl(fetchMock)).toMatch(/\/nin_regular_slip\.php$/);
    expect(calledUrl(fetchMock)).not.toMatch(/nin_by_nin\.php|premium/);
    expect(calledBody(fetchMock)).toEqual({ api_key: 'test-key', nin: '12345678901' });
  });

  it('by phone also uses the regular endpoint', async () => {
    const pdf = await makePdfWithImages([Buffer.from(JPEG_PHOTO_B64, 'base64')]);
    const fetchMock = mockFetch({ status: 'success', user_data: IDENTITY, pdf_base64: pdf });
    const result = await (await load()).ninPersonalInfoByPhone('08012345678');
    expect(calledUrl(fetchMock)).toMatch(/\/nin_by_phone_regular\.php$/);
    expect(result.ok).toBe(true);
  });

  it('builds our own PDF using the photograph found inside the Techhub PDF (JSON has no photo)', async () => {
    const pdf = await makePdfWithImages([makePng(60, 60), Buffer.from(JPEG_PHOTO_B64, 'base64')]);
    mockFetch({ status: 'success', user_data: IDENTITY, pdf_base64: pdf });
    const result = await (await load()).ninPersonalInfoByNin('12345678901');
    expect(result.ok).toBe(true);
    expect(result.userData).toMatchObject({ 'First Name': 'SPECIMEN', 'Last Name': 'PERSON', 'Date of Birth': '1990-01-01' });
    expect(result.userData?.photo).toBe(JPEG_PHOTO_B64);
    // Our own generated document, not Techhub's regular slip passed through.
    expect(result.pdfBase64).toBeTruthy();
    expect(result.pdfBase64).not.toBe(pdf);
    expect(Buffer.from(result.pdfBase64!, 'base64').subarray(0, 5).toString()).toBe('%PDF-');
  });

  it('succeeds without a phone number (NIMC leaves it blank for many records)', async () => {
    const pdf = await makePdfWithImages([Buffer.from(JPEG_PHOTO_B64, 'base64')]);
    mockFetch({ status: 'success', user_data: { ...IDENTITY, phone_number: '' }, pdf_base64: pdf });
    const result = await (await load()).ninPersonalInfoByNin('12345678901');
    expect(result.ok).toBe(true);
  });

  it('prefers a photo field in the JSON when Techhub does send one', async () => {
    const other = await makePdfWithImages([makePng(90, 90)]);
    mockFetch({ status: 'success', user_data: { ...IDENTITY, image: JPEG_PHOTO_B64 }, pdf_base64: other });
    const result = await (await load()).ninPersonalInfoByNin('12345678901');
    expect(result.ok).toBe(true);
    expect(result.userData?.photo).toBe(JPEG_PHOTO_B64);
  });

  it('fails with a diagnosable log (keys only, no personal data) when no photo exists anywhere', async () => {
    const pdf = await makePdfWithImages([]);
    mockFetch({ status: 'success', user_data: IDENTITY, pdf_base64: pdf });
    const result = await (await load()).ninPersonalInfoByNin('12345678901');
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/complete Personal Info slip/);
    const logged = (console.error as unknown as ReturnType<typeof vi.fn>).mock.calls.flat().join(' ');
    expect(logged).toContain('photo=MISSING');
    expect(logged).toContain('images_in_pdf=0');
    expect(logged).toContain('user_data_keys=nin,first_name');
    expect(logged).not.toContain('SPECIMEN');
    expect(logged).not.toContain('12345678901');
  });

  it('fails when the core identity details are missing', async () => {
    const pdf = await makePdfWithImages([Buffer.from(JPEG_PHOTO_B64, 'base64')]);
    mockFetch({ status: 'success', user_data: { nin: '12345678901' }, pdf_base64: pdf });
    const result = await (await load()).ninPersonalInfoByNin('12345678901');
    expect(result.ok).toBe(false);
    expect((console.error as unknown as ReturnType<typeof vi.fn>).mock.calls.flat().join(' ')).toContain('identity_fields=MISSING');
  });

  it('standard and regular NIN lookups are untouched and still hit their own endpoints', async () => {
    const fetchMock = mockFetch({ status: 'success', user_data: IDENTITY, pdf_base64: 'JVBERi0=' });
    await (await load()).ninByNin('12345678901', 'standard');
    expect(calledUrl(fetchMock)).toMatch(/\/nin_standard_slip\.php$/);
  });
});
