import { randomUUID } from 'node:crypto';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import express, { type RequestHandler } from 'express';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { generateTotp } from '../../lib/totp.js';

/**
 * End-to-end test of the 2FA gate over real HTTP: a real Express app with the
 * real createMfaRouter, a tiny in-memory session store, and an in-memory
 * stand-in for the two prisma tables it touches.
 */
type Row = Record<string, any>;
const admins = new Map<string, Row>();
let recovery: Row[] = [];
// Test knob: delay reads so two requests really overlap (HTTP requests alone
// finish one after the other too fast to exercise a race).
let readLatencyMs = 0;

function matches(row: Row, where: Record<string, any>): boolean {
  return Object.entries(where).every(([k, v]) => {
    if (k === 'OR') return (v as Record<string, any>[]).some((w) => matches(row, w));
    const val = row[k];
    if (v === null) return val === null || val === undefined;
    if (v && typeof v === 'object' && !(v instanceof Date)) {
      if ('lt' in v) return val != null && val < v.lt;
      if ('lte' in v) return val != null && val <= v.lte;
    }
    return val === v;
  });
}
function apply(row: Row, data: Row) {
  for (const [k, v] of Object.entries(data)) {
    if (v && typeof v === 'object' && !(v instanceof Date) && 'increment' in v) row[k] = (row[k] ?? 0) + v.increment;
    else row[k] = v;
  }
}

vi.mock('../../lib/prisma.js', () => ({
  prisma: {
    adminUser: {
      findUnique: async ({ where, select }: any) => {
        if (readLatencyMs) await new Promise((r) => setTimeout(r, readLatencyMs));
        const r = [...admins.values()].find((x) => (where.id ? x.id === where.id : x.email === where.email));
        if (!r) return null;
        if (!select) return { ...r };
        return Object.fromEntries(Object.keys(select).map((k) => [k, r[k]]));
      },
      update: async ({ where, data }: any) => { const r = admins.get(where.id)!; apply(r, data); return { ...r }; },
      updateMany: async ({ where, data }: any) => {
        let count = 0;
        for (const r of admins.values()) if (matches(r, where)) { apply(r, data); count++; }
        return { count };
      }
    },
    adminRecoveryCode: {
      updateMany: async ({ where, data }: any) => {
        let count = 0;
        for (const r of recovery) if (matches(r, where)) { apply(r, data); count++; }
        return { count };
      },
      deleteMany: async ({ where }: any) => { recovery = recovery.filter((r) => !matches(r, where)); return {}; },
      createMany: async ({ data }: any) => { recovery.push(...data.map((d: Row) => ({ ...d, usedAt: null }))); return {}; }
    }
  }
}));
vi.mock('../audit.js', () => ({ logAdminAction: vi.fn().mockResolvedValue(undefined) }));

const { createMfaRouter } = await import('../mfa.js');

const store = new Map<string, Row>();
const sessionMw: RequestHandler = (req, res, next) => {
  if ((req as any).session) return next();
  const jar = Object.fromEntries((req.headers.cookie ?? '').split(';').map((c) => c.trim().split('=')).filter((p) => p[0]));
  let sid = jar.sid as string | undefined;
  if (!sid || !store.has(sid)) { sid = randomUUID(); store.set(sid, {}); res.setHeader('Set-Cookie', `sid=${sid}; Path=/`); }
  const id = sid;
  (req as any).session = Object.assign(store.get(id)!, {
    save: (cb?: () => void) => cb?.(),
    destroy: (cb?: () => void) => { store.delete(id); cb?.(); }
  });
  next();
};

let server: Server;
let base = '';
beforeAll(async () => {
  const app = express();
  app.use(sessionMw);
  // test-only helper standing in for AdminJS's password login
  app.post('/__login/:id', (req, res) => {
    const a = admins.get(req.params.id)!;
    (req as any).session.adminUser = { id: a.id, email: a.email, fullName: a.fullName, role: a.role };
    res.send('ok');
  });
  app.use('/admin', createMfaRouter({ rootPath: '/admin', sessionMiddleware: sessionMw }));
  app.get('/admin/secret', (_req, res) => res.send('SECRET-PAGE'));
  app.get('/admin/login', (_req, res) => res.send('LOGIN-PAGE'));
  app.get('/admin/api/resources', (_req, res) => res.json({ ok: true }));
  server = app.listen(0);
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(() => { server.close(); });

class Client {
  cookie = '';
  async req(path: string, init: { method?: string; body?: string; headers?: Record<string, string> } = {}) {
    const res = await fetch(base + path, {
      method: init.method ?? 'GET',
      redirect: 'manual',
      body: init.body,
      headers: { ...(init.cookie === undefined ? {} : {}), cookie: this.cookie, ...(init.body ? { 'content-type': 'application/x-www-form-urlencoded' } : {}), ...init.headers }
    } as any);
    const set = res.headers.get('set-cookie');
    if (set) this.cookie = set.split(';')[0];
    return { status: res.status, location: res.headers.get('location'), text: await res.text() };
  }
  post(path: string, fields: Record<string, string> = {}) {
    return this.req(path, { method: 'POST', body: new URLSearchParams(fields).toString() });
  }
  async login(id: string) { await this.post(`/__login/${id}`); }
}

function seed() {
  admins.clear(); store.clear(); recovery = [];
  const base = { passwordHash: 'x', isActive: true, lastLoginAt: null, failedLoginCount: 0, failedLoginAt: null, lockedUntil: null,
    totpSecretEnc: null, totpEnabledAt: null, totpLastStep: null };
  admins.set('boss', { ...base, id: 'boss', email: 'boss@ktech.test', fullName: 'Boss', role: 'SUPER_ADMIN' });
  admins.set('fin', { ...base, id: 'fin', email: 'fin@ktech.test', fullName: 'Fin', role: 'FINANCE' });
  admins.set('help', { ...base, id: 'help', email: 'help@ktech.test', fullName: 'Help', role: 'SUPPORT' });
}

/** Walk the real enrolment screens; returns the secret and recovery codes shown. */
async function enroll(c: Client, id = 'boss') {
  await c.login(id);
  const page = await c.req('/admin/mfa');
  const secret = /class="key">([^<]+)</.exec(page.text)![1].replace(/\s/g, '');
  const done = await c.post('/admin/mfa/enroll', { code: generateTotp(secret) });
  const codes = [...done.text.matchAll(/<span>([A-Z0-9]{5}-[A-Z0-9]{5})<\/span>/g)].map((m) => m[1]);
  return { secret, codes, done };
}

describe('admin 2FA gate', () => {
  beforeEach(seed);

  it('does nothing for visitors who are not signed in (AdminJS login handles them)', async () => {
    const c = new Client();
    expect((await c.req('/admin/secret')).text).toBe('SECRET-PAGE');
  });

  it('blocks every page for a password-only SUPER_ADMIN and sends them to set up 2FA', async () => {
    const c = new Client();
    await c.login('boss');
    const r = await c.req('/admin/secret');
    expect(r.status).toBe(302);
    expect(r.location).toBe('/admin/mfa');
    const page = await c.req('/admin/mfa');
    expect(page.text).toContain('Set up two-factor');
    expect(page.text).toContain('otpauth://totp/');
  });

  it('answers API/XHR calls with 401 JSON instead of a redirect', async () => {
    const c = new Client();
    await c.login('boss');
    const r = await c.req('/admin/api/resources', { headers: { accept: 'application/json' } });
    expect(r.status).toBe(401);
    expect(JSON.parse(r.text).code).toBe('MFA_REQUIRED');
  });

  it('enrols: a wrong code is refused, the right one turns 2FA on, shows recovery codes once, stores only ciphertext', async () => {
    const c = new Client();
    await c.login('boss');
    const page = await c.req('/admin/mfa');
    const secret = /class="key">([^<]+)</.exec(page.text)![1].replace(/\s/g, '');

    const bad = await c.post('/admin/mfa/enroll', { code: '000000' });
    expect(bad.status).toBe(400);
    expect((await c.req('/admin/secret')).status).toBe(302);

    const ok = await c.post('/admin/mfa/enroll', { code: generateTotp(secret) });
    expect(ok.status).toBe(200);
    expect([...ok.text.matchAll(/<span>[A-Z0-9]{5}-[A-Z0-9]{5}<\/span>/g)].length).toBe(8);
    expect((await c.req('/admin/secret')).text).toBe('SECRET-PAGE');

    const row = admins.get('boss')!;
    expect(row.totpEnabledAt).toBeInstanceOf(Date);
    expect(row.totpSecretEnc).toBeTruthy();
    expect(row.totpSecretEnc).not.toContain(secret);
    expect(recovery.length).toBe(8);
    expect(recovery.every((r) => /^[0-9a-f]{64}$/.test(r.codeHash))).toBe(true);
  });

  it('a later sign-in must pass the code: wrong refused, right accepted, same code cannot be replayed', async () => {
    const { secret } = await enroll(new Client());
    const c2 = new Client();
    await c2.login('boss');
    expect((await c2.req('/admin/secret')).status).toBe(302);
    expect((await c2.req('/admin/mfa')).text).toContain('Two-factor verification');

    const replay = await c2.post('/admin/mfa/verify', { code: generateTotp(secret) }); // same step as enrolment
    expect(replay.status).toBe(400);

    const fresh = await c2.post('/admin/mfa/verify', { code: generateTotp(secret, Date.now() + 30_000) });
    expect(fresh.status).toBe(302);
    expect((await c2.req('/admin/secret')).text).toBe('SECRET-PAGE');
    expect(admins.get('boss')!.failedLoginCount).toBe(0);
  });

  it('one code used from two sessions at the same instant signs in only once (atomic step claim)', async () => {
    const { secret } = await enroll(new Client());
    const a = new Client();
    const b = new Client();
    await a.login('boss');
    await b.login('boss');
    const code = generateTotp(secret, Date.now() + 30_000); // a fresh, not-yet-used step
    readLatencyMs = 15;
    try {
      const [ra, rb] = await Promise.all([a.post('/admin/mfa/verify', { code }), b.post('/admin/mfa/verify', { code })]);
      expect([ra.status, rb.status].sort()).toEqual([302, 400]);
    } finally {
      readLatencyMs = 0;
    }
  });

  it('a recovery code signs in exactly once', async () => {
    const { codes } = await enroll(new Client());
    const c2 = new Client();
    await c2.login('boss');
    expect((await c2.post('/admin/mfa/verify', { code: codes[0] })).status).toBe(302);
    expect((await c2.req('/admin/secret')).text).toBe('SECRET-PAGE');

    const c3 = new Client();
    await c3.login('boss');
    expect((await c3.post('/admin/mfa/verify', { code: codes[0] })).status).toBe(400); // already used
    expect((await c3.post('/admin/mfa/verify', { code: codes[1].toLowerCase() })).status).toBe(302); // case-insensitive
  });

  it('locks the account after repeated wrong codes and ends the session', async () => {
    await enroll(new Client());
    const c = new Client();
    await c.login('boss');
    for (let i = 0; i < 5; i++) expect((await c.post('/admin/mfa/verify', { code: '111111' })).status).toBe(400);
    expect(admins.get('boss')!.lockedUntil).not.toBeNull();
    const locked = await c.post('/admin/mfa/verify', { code: '111111' });
    expect(locked.status).toBe(429);
    expect(locked.text).toContain('Too many failed');
  });

  it('parallel code guesses cannot exceed the attempt limit', async () => {
    const { secret } = await enroll(new Client());
    const c = new Client();
    await c.login('boss');
    const wrong = Array.from({ length: 30 }, (_, i) => String(100000 + i * 7919).slice(0, 6));
    const results = await Promise.all(wrong.map((code) => c.post('/admin/mfa/verify', { code })));
    expect(results.filter((r) => r.status === 400).length).toBeLessThanOrEqual(5);
    // even the correct code is now refused while locked
    const c2 = new Client();
    await c2.login('boss');
    const late = await c2.post('/admin/mfa/verify', { code: generateTotp(secret, Date.now() + 30_000) });
    expect(late.status).toBe(429);
  });

  it('a session verified for one admin does not carry over to another admin', async () => {
    await enroll(new Client(), 'boss');
    const c = new Client();
    const { } = await enroll(c, 'fin'); // c is now verified as "fin"
    await c.login('boss'); // same browser session, different admin
    expect((await c.req('/admin/secret')).status).toBe(302);
  });

  it('SUPPORT staff who never turned on 2FA pass through; once they enrol it is enforced', async () => {
    const c = new Client();
    await c.login('help');
    expect((await c.req('/admin/secret')).text).toBe('SECRET-PAGE');

    const c2 = new Client();
    await enroll(c2, 'help');
    const c3 = new Client();
    await c3.login('help');
    expect((await c3.req('/admin/secret')).status).toBe(302);
  });

  it('ADMIN_MFA_ENFORCED=false is the emergency bypass', async () => {
    process.env.ADMIN_MFA_ENFORCED = 'false';
    try {
      const c = new Client();
      await c.login('boss');
      expect((await c.req('/admin/secret')).text).toBe('SECRET-PAGE');
    } finally {
      delete process.env.ADMIN_MFA_ENFORCED;
    }
  });
});
