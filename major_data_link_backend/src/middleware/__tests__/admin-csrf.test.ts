import { describe, expect, it, vi } from 'vitest';
import { createAdminCsrfGuard } from '../admin-csrf.js';

function run(method: string, headers: Record<string, string>, extraHosts: string[] = []) {
  const lower = Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]));
  const req: any = { method, path: '/admin/user-wallet/1/adjust', get: (h: string) => lower[h.toLowerCase()] };
  const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
  const next = vi.fn();
  createAdminCsrfGuard(extraHosts)(req, res, next);
  return { allowed: next.mock.calls.length === 1, status: res.status.mock.calls[0]?.[0] as number | undefined };
}
const HOST = 'k-tech.com.ng';

describe('admin CSRF guard', () => {
  it('lets read-only requests through untouched', () => {
    expect(run('GET', { Host: HOST }).allowed).toBe(true);
    expect(run('HEAD', {}).allowed).toBe(true);
  });
  it('allows same-origin POSTs (Sec-Fetch-Site)', () => {
    expect(run('POST', { Host: HOST, 'Sec-Fetch-Site': 'same-origin' }).allowed).toBe(true);
    expect(run('POST', { Host: HOST, 'Sec-Fetch-Site': 'none' }).allowed).toBe(true);
  });
  it('blocks cross-site and same-site (sibling subdomain) POSTs', () => {
    expect(run('POST', { Host: HOST, 'Sec-Fetch-Site': 'cross-site' })).toMatchObject({ allowed: false, status: 403 });
    expect(run('POST', { Host: HOST, 'Sec-Fetch-Site': 'same-site' }).allowed).toBe(false);
  });
  it('falls back to Origin host for browsers without Sec-Fetch-Site', () => {
    expect(run('POST', { Host: HOST, Origin: 'https://k-tech.com.ng' }).allowed).toBe(true);
    expect(run('POST', { Host: HOST, Origin: 'http://k-tech.com.ng' }).allowed).toBe(true); // scheme ignored on purpose
    expect(run('POST', { Host: 'internal:8787', 'X-Forwarded-Host': HOST, Origin: 'https://k-tech.com.ng' }).allowed).toBe(true);
    expect(run('POST', { Host: HOST, Origin: 'https://evil.example' }).allowed).toBe(false);
    expect(run('POST', { Host: HOST, Origin: 'https://k-tech.com.ng.evil.example' }).allowed).toBe(false);
    expect(run('POST', { Host: HOST, Origin: 'null' }).allowed).toBe(false);
  });
  it('falls back to Referer when Origin is missing', () => {
    expect(run('POST', { Host: HOST, Referer: 'https://k-tech.com.ng/admin/user-wallet' }).allowed).toBe(true);
    expect(run('POST', { Host: HOST, Referer: 'https://evil.example/x' }).allowed).toBe(false);
  });
  it('blocks state-changing requests that carry no origin information at all', () => {
    expect(run('POST', { Host: HOST })).toMatchObject({ allowed: false, status: 403 });
    expect(run('DELETE', { Host: HOST }).allowed).toBe(false);
  });
  it('honours explicitly allowed extra hosts', () => {
    expect(run('POST', { Host: HOST, Origin: 'https://admin.example.com' }, ['admin.example.com']).allowed).toBe(true);
  });
});
