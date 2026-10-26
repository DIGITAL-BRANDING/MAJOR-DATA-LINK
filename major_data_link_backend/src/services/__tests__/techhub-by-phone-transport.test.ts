import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../lib/prisma.js', () => ({ prisma: {} }));

const realFetch = globalThis.fetch;
const OK = { status: 'success', response_code: '00', user_data: { first_name: 'JOHN', last_name: 'DOE' }, pdf_base64: 'JVBERi0x' };

/** Fake Techhub endpoint that only accepts the given transport. */
function fakeTechhub(accepts: 'json' | 'form' | 'form_query', missingStatus = 400, missingMessage = 'Missing required parameters') {
  const fn = vi.fn(async (url: unknown, init?: RequestInit) => {
    const ct = String((init?.headers as Record<string, string>)['Content-Type']);
    const hasQuery = String(url).includes('?');
    const transport = ct.includes('json') ? 'json' : hasQuery ? 'form_query' : 'form';
    const respond = (b: unknown, s: number) => new Response(JSON.stringify(b), { status: s, headers: { 'content-type': 'application/json' } });
    return transport === accepts ? respond(OK, 200) : respond({ status: 'error', message: missingMessage }, missingStatus);
  });
  globalThis.fetch = fn as never;
  return fn;
}

beforeEach(() => {
  vi.resetModules();
  process.env.TECHHUB_API_KEY = 'test-key';
  delete process.env.TECHHUB_NIN_API_KEY;
  vi.spyOn(console, 'info').mockImplementation(() => undefined);
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});
afterEach(() => {
  globalThis.fetch = realFetch;
  vi.restoreAllMocks();
});
const load = async () => (await import('../techhub.service.js')).techhubService;

describe('Techhub NIN by phone - transport ladder', () => {
  it('works first time when JSON is accepted', async () => {
    const fn = fakeTechhub('json');
    const r = await (await load()).ninByPhone('08012345678', 'premium');
    expect(r.ok).toBe(true);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(JSON.parse(String((fn.mock.calls[0][1] as RequestInit).body))).toEqual({ api_key: 'test-key', phone: '08012345678' });
  });

  it('falls back to form body when JSON is rejected with HTTP 400', async () => {
    const fn = fakeTechhub('form');
    const r = await (await load()).ninByPhone('08012345678', 'premium');
    expect(r.ok).toBe(true);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('falls back even when the provider answers HTTP 200 with "Missing parameter" (the old regex missed this)', async () => {
    const fn = fakeTechhub('form', 200, 'Missing parameter');
    const r = await (await load()).ninByPhone('08012345678', 'premium');
    expect(r.ok).toBe(true);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('falls back even on HTTP 422 "phone is required"', async () => {
    fakeTechhub('form', 422, 'phone is required');
    expect((await (await load()).ninByPhone('08012345678', 'premium')).ok).toBe(true);
  });

  it('reaches the form+query transport for $_GET/$_REQUEST-only scripts', async () => {
    const fn = fakeTechhub('form_query');
    expect((await (await load()).ninByPhone('08012345678', 'premium')).ok).toBe(true);
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('remembers the working transport for the next call', async () => {
    const fn = fakeTechhub('form');
    const svc = await load();
    await svc.ninByPhone('08012345678', 'premium');
    fn.mockClear();
    await svc.ninByPhone('08087654321', 'premium');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('does not retry on a genuine non-missing-parameter error', async () => {
    const fn = fakeTechhub('json', 400, 'Insufficient balance');
    globalThis.fetch = vi.fn(async () => new Response(JSON.stringify({ status: 'error', message: 'Insufficient balance' }), { status: 400 })) as never;
    const r = await (await load()).ninByPhone('08012345678', 'premium');
    expect(r.ok).toBe(false);
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    void fn;
  });

  it('cleans an empty NIN key / quoted key from env and falls back to the shared key', async () => {
    process.env.TECHHUB_NIN_API_KEY = '   ';
    process.env.TECHHUB_API_KEY = '"quoted-key"\n';
    const fn = fakeTechhub('json');
    await (await load()).ninByPhone('08012345678', 'premium');
    expect(JSON.parse(String((fn.mock.calls[0][1] as RequestInit).body)).api_key).toBe('quoted-key');
  });
});
