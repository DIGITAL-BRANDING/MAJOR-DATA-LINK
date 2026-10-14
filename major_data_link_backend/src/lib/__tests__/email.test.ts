import { beforeEach, describe, expect, it, vi } from 'vitest';

const { sendMock, batchMock, mockEnv } = vi.hoisted(() => ({
  sendMock: vi.fn(),
  batchMock: vi.fn(),
  mockEnv: {
    RESEND_API_KEY: 're_test_key',
    RESEND_FROM_EMAIL: 'K-TECH SOLUTIONS COMPANY <support@k-tech.com.ng>',
    PUBLIC_WEB_URL: 'https://k-tech.com.ng'
  } as Record<string, string | undefined>
}));

vi.mock('resend', () => ({
  Resend: class {
    emails = { send: sendMock };
    batch = { send: batchMock };
  }
}));
vi.mock('../../config/env.js', () => ({ env: mockEnv }));

const load = async () => {
  vi.resetModules();
  return import('../email.js');
};

const okBatch = (count: number, errors: { index: number; message: string }[] = []) => ({
  data: { data: Array.from({ length: count - errors.length }, (_v, i) => ({ id: `id-${i}` })), errors },
  error: null
});

beforeEach(() => {
  vi.clearAllMocks();
  mockEnv.RESEND_API_KEY = 're_test_key';
  sendMock.mockResolvedValue({ data: { id: 'email-1' }, error: null });
  batchMock.mockImplementation(async (payload: unknown[]) => okBatch(payload.length));
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

describe('welcome email', () => {
  it('goes out from the K-TECH sender with the agreed subject and both html and text bodies', async () => {
    const { sendWelcomeEmail } = await load();
    const result = await sendWelcomeEmail({ email: 'new.user@example.com', fullName: 'SUNUSI USAMA' });

    expect(result.sent).toBe(true);
    const payload = sendMock.mock.calls[0][0];
    expect(payload.from).toBe('K-TECH SOLUTIONS COMPANY <support@k-tech.com.ng>');
    expect(payload.to).toEqual(['new.user@example.com']);
    expect(payload.subject).toBe('Welcome to K-TECH SOLUTIONS');
    expect(payload.html).toContain('Welcome, Sunusi!');
    expect(payload.text).toContain('Hello Sunusi,');
    expect(payload.html.length).toBeGreaterThan(500);
    expect(payload.text.length).toBeGreaterThan(200);
  });

  it('advertises the real services and links to the dashboard in both versions', async () => {
    const { buildWelcomeEmail } = await load();
    const { html, text } = buildWelcomeEmail({ fullName: 'Ada Obi', webUrl: 'https://k-tech.com.ng/' });
    for (const body of [html, text]) {
      for (const phrase of ['NIN verification', 'BVN verification', 'CAC registration', 'JAMB services', 'Mobile data, airtime', 'result checker PINs']) {
        expect(body).toContain(phrase);
      }
      expect(body).toContain('https://k-tech.com.ng/dashboard');
    }
    expect(html).toContain('href="https://k-tech.com.ng/dashboard"');
  });

  it('is fully K-TECH branded (no leftover MAJOR DATA-LINK name)', async () => {
    const { buildWelcomeEmail } = await load();
    const { html, text, subject } = buildWelcomeEmail({ fullName: 'Ada Obi', webUrl: 'https://k-tech.com.ng' });
    for (const body of [html, text, subject]) expect(body).not.toMatch(/MAJOR DATA-LINK/i);
    expect(html).toContain('K-TECH SOLUTIONS');
  });

  it('keeps a properly capitalised name as typed and escapes HTML in names', async () => {
    const { buildWelcomeEmail } = await load();
    expect(buildWelcomeEmail({ fullName: 'McDonald Eze', webUrl: 'https://k-tech.com.ng' }).text).toContain('Hello McDonald,');
    const evil = buildWelcomeEmail({ fullName: '<script>alert(1)</script> Bob', webUrl: 'https://k-tech.com.ng' });
    expect(evil.html).not.toContain('<script>');
    expect(evil.html).toContain('&lt;script&gt;');
  });

  it('falls back to a neutral greeting when the name is empty', async () => {
    const { buildWelcomeEmail } = await load();
    expect(buildWelcomeEmail({ fullName: '   ', webUrl: 'https://k-tech.com.ng' }).text).toContain('Hello there,');
  });
});

describe('single sends fail safely', () => {
  it('does nothing (and says why) when RESEND_API_KEY is not set', async () => {
    mockEnv.RESEND_API_KEY = undefined;
    const { sendWelcomeEmail } = await load();
    expect(await sendWelcomeEmail({ email: 'a@b.co', fullName: 'A B' })).toEqual({ sent: false, error: 'RESEND_API_KEY is not configured' });
    expect(sendMock).not.toHaveBeenCalled();
  });

  it('reports a Resend rejection (e.g. unverified sender domain) instead of pretending it was sent', async () => {
    sendMock.mockResolvedValue({ data: null, error: { name: 'invalid_from_address', message: 'The domain is not verified' } });
    const { sendWelcomeEmail } = await load();
    expect(await sendWelcomeEmail({ email: 'a@b.co', fullName: 'A B' })).toEqual({ sent: false, error: 'The domain is not verified' });
  });

  it('survives a thrown network error', async () => {
    sendMock.mockRejectedValue(new Error('socket hang up'));
    const { sendWelcomeEmail } = await load();
    expect((await sendWelcomeEmail({ email: 'a@b.co', fullName: 'A B' })).sent).toBe(false);
  });
});

describe('bulk / admin announcements', () => {
  it('sends every recipient their OWN email - addresses are never shared in one "to" list', async () => {
    const { sendAdminEmail } = await load();
    const recipients = ['one@example.com', 'two@example.com', 'three@example.com'];
    const result = await sendAdminEmail({ recipients, subject: '  Maintenance tonight ', message: 'Hello <b>all</b>\nSee you' });

    expect(result).toMatchObject({ sent: true, delivered: 3, failed: 0 });
    const payload = batchMock.mock.calls[0][0] as { from: string; to: string[]; subject: string; html: string; text: string }[];
    expect(payload).toHaveLength(3);
    expect(payload.map((m) => m.to)).toEqual([['one@example.com'], ['two@example.com'], ['three@example.com']]);
    expect(payload.every((m) => m.from === 'K-TECH SOLUTIONS COMPANY <support@k-tech.com.ng>')).toBe(true);
    expect(payload[0].subject).toBe('Maintenance tonight');
    expect(payload[0].text).toBe('Hello <b>all</b>\nSee you');
    expect(payload[0].html).toContain('Hello &lt;b&gt;all&lt;/b&gt;<br>See you');
    expect(batchMock.mock.calls[0][1]).toEqual({ batchValidation: 'permissive' });
    expect(sendMock).not.toHaveBeenCalled();
  });

  it('splits large audiences into batches of 100 and removes duplicate addresses', async () => {
    const { sendBulkEmail } = await load();
    const recipients = [...Array.from({ length: 250 }, (_v, i) => `user${i}@example.com`), 'USER0@example.com'];
    const result = await sendBulkEmail(recipients, { subject: 's', text: 't', html: 'h' }, { pauseMs: 0 });
    expect(batchMock.mock.calls.map((c) => (c[0] as unknown[]).length)).toEqual([100, 100, 50]);
    expect(result).toMatchObject({ sent: true, delivered: 250, failed: 0 });
  });

  it('one bad address fails only itself', async () => {
    batchMock.mockResolvedValue(okBatch(100, [{ index: 3, message: 'Invalid `to` field' }]));
    const { sendBulkEmail } = await load();
    const result = await sendBulkEmail(Array.from({ length: 100 }, (_v, i) => `u${i}@example.com`), { subject: 's', text: 't', html: 'h' }, { pauseMs: 0 });
    expect(result).toMatchObject({ sent: true, delivered: 99, failed: 1 });
  });

  it('waits and retries when Resend answers "rate limit"', async () => {
    batchMock
      .mockResolvedValueOnce({ data: null, error: { name: 'rate_limit_exceeded', message: 'Too many requests' } })
      .mockImplementation(async (payload: unknown[]) => okBatch(payload.length));
    const { sendBulkEmail } = await load();
    const result = await sendBulkEmail(['a@example.com', 'b@example.com'], { subject: 's', text: 't', html: 'h' }, { pauseMs: 0 });
    expect(batchMock).toHaveBeenCalledTimes(2);
    expect(result).toMatchObject({ sent: true, delivered: 2, failed: 0 });
  });

  it('stops at once on an error that would repeat for everyone (bad key / unverified sender)', async () => {
    batchMock.mockResolvedValue({ data: null, error: { name: 'invalid_from_address', message: 'Sender domain not verified' } });
    const { sendBulkEmail } = await load();
    const result = await sendBulkEmail(Array.from({ length: 250 }, (_v, i) => `u${i}@example.com`), { subject: 's', text: 't', html: 'h' }, { pauseMs: 0 });
    expect(batchMock).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ sent: false, error: 'Sender domain not verified', delivered: 0, failed: 250 });
  });

  it('does nothing without an API key', async () => {
    mockEnv.RESEND_API_KEY = undefined;
    const { sendAdminEmail } = await load();
    expect((await sendAdminEmail({ recipients: ['a@example.com'], subject: 's', message: 'm' })).sent).toBe(false);
    expect(batchMock).not.toHaveBeenCalled();
  });
});

describe('password reset email', () => {
  it('uses the K-TECH sender and brand, with html and text', async () => {
    const { sendPasswordResetEmail } = await load();
    expect(await sendPasswordResetEmail('user@example.com', '482913')).toEqual({ sent: true });
    const payload = sendMock.mock.calls[0][0];
    expect(payload.from).toBe('K-TECH SOLUTIONS COMPANY <support@k-tech.com.ng>');
    expect(payload.to).toEqual(['user@example.com']);
    expect(payload.subject).toBe('482913 is your K-TECH SOLUTIONS password reset code');
    expect(payload.text).toContain('482913');
    expect(payload.html).toContain('482913');
  });

  it('reports not-sent when Resend rejects it', async () => {
    sendMock.mockResolvedValue({ data: null, error: { name: 'validation_error', message: 'bad' } });
    const { sendPasswordResetEmail } = await load();
    expect(await sendPasswordResetEmail('user@example.com', '482913')).toEqual({ sent: false });
  });
});
