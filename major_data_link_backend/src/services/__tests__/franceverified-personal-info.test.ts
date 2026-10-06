import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../lib/prisma.js', () => ({ prisma: {} }));

const realFetch = globalThis.fetch;
beforeEach(() => {
  vi.resetModules();
  process.env.FRANCEVERIFIED_API_KEY = 'test-key';
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});
afterEach(() => {
  globalThis.fetch = realFetch;
  vi.restoreAllMocks();
});

const reply = (data: Record<string, unknown>) => {
  globalThis.fetch = vi.fn(async () => new Response(JSON.stringify({ status: 'success', message: 'ok', data }), { status: 200, headers: { 'content-type': 'application/json' } })) as never;
};
const load = async () => (await import('../franceverified-slip-adapter.service.js')).franceverifiedSlipAdapter;

describe('FranceVerified Personal Info report', () => {
  it('is built even when the provider sent no photograph or phone (already billed - never refund for that)', async () => {
    reply({ nin: '12345678901', firstName: 'SPECIMEN', lastName: 'PERSON', birthdate: '1990-01-01', gender: 'f' });
    const result = await (await load()).ninByNin('12345678901', undefined, true);
    expect(result.ok).toBe(true);
    expect(result.pdfBase64).toBeTruthy();
  });

  it('still fails when the reply has no name at all', async () => {
    reply({ nin: '12345678901' });
    const result = await (await load()).ninByNin('12345678901', undefined, true);
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/enough identity details/);
  });
});
