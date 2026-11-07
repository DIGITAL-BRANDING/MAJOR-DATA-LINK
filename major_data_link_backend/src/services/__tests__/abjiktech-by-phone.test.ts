import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../config/env.js', () => ({ env: {
  ABJIKTECH_API_KEY: 'test-key',
  ABJIKTECH_BASE_URL: 'https://abjiktech.example/api/verification/'
} }));

const originalFetch = globalThis.fetch;
const abjikTechService = (await import('../abjiktech.service.js')).abjikTechService;

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe('AbjikTech NIN by phone', () => {
  it('posts the phone and tier endpoint and reads nested provider data', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response(JSON.stringify({
      success: true,
      data: {
        user_data: { first_name: 'Amina', last_name: 'Usman', nin: '12345678901' },
        pdf_base64: 'JVBERi0xLjQ='
      }
    }), { status: 200 }));
    globalThis.fetch = fetchMock as never;

    const result = await abjikTechService.ninByPhone('08012345678', 'standard');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toBe('https://abjiktech.example/api/verification/nin_by_phone_standard.php');
    expect(JSON.parse(String((fetchMock.mock.calls[0][1] as RequestInit).body))).toEqual({ api_key: 'test-key', phone: '08012345678' });
    expect(result.ok).toBe(true);
    expect(result.userData).toMatchObject({ 'First Name': 'Amina', Surname: 'Usman', NIN: '12345678901' });
    expect(result.pdfBase64).toBe('JVBERi0xLjQ=');
  });

  it('recognizes nested status and response-code success envelopes', async () => {
    globalThis.fetch = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response(JSON.stringify({
      data: {
        response_code: '00',
        result: { user_data: { firstName: 'Amina', surname: 'Usman' } },
        pdf_url: 'https://files.example/slip.pdf'
      }
    }), { status: 200 })) as never;

    const result = await abjikTechService.ninByPhone('08012345678', 'premium');

    expect(result.ok).toBe(true);
    expect(result.userData?.['First Name']).toBe('Amina');
    expect(result.pdfUrl).toBe('https://files.example/slip.pdf');
  });

  it('keeps genuine provider errors as failures', async () => {
    globalThis.fetch = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response(JSON.stringify({
      success: false,
      data: { message: 'No record found' }
    }), { status: 200 })) as never;

    const result = await abjikTechService.ninByPhone('08012345678', 'regular');

    expect(result.ok).toBe(false);
    expect(result.message).toBe('No record found');
  });
});
