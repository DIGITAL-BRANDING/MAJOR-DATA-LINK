import type { NextFunction, Request, Response } from 'express';

/**
 * CSRF guard for the cookie-authenticated admin panel (/admin/*).
 *
 * The admin session is a cookie, so a malicious page open in an admin's
 * browser could otherwise make that browser POST to /admin (credit a wallet,
 * change a price) with the cookie attached. Every state-changing request
 * (anything except GET / HEAD / OPTIONS) must therefore prove it was
 * started by this site itself:
 *
 *  1. `Sec-Fetch-Site` (sent by all current browsers and set by the browser,
 *     not by page script): `same-origin` or `none` is accepted, anything
 *     else (`cross-site`, `same-site` = a sibling subdomain) is refused.
 *  2. Browsers without it: the `Origin` header (or `Referer`) host must equal
 *     this request's own host (`Host` or `X-Forwarded-Host`), or be listed in
 *     `extraAllowedHosts`. Only the HOST is compared, not the scheme, because
 *     behind Railway's proxy the scheme the app sees can differ from the one
 *     the browser used.
 *  3. A state-changing request with none of these headers is refused.
 */
export function createAdminCsrfGuard(extraAllowedHosts: string[] = []) {
  const extra = new Set(extraAllowedHosts.map((h) => h.toLowerCase()));

  const hostOf = (value: string | undefined) => {
    if (!value) return null;
    try {
      return new URL(value).host.toLowerCase();
    } catch {
      return null;
    }
  };

  return function adminCsrfGuard(req: Request, res: Response, next: NextFunction) {
    if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') return next();

    const fetchSite = req.get('sec-fetch-site');
    if (fetchSite) {
      if (fetchSite === 'same-origin' || fetchSite === 'none') return next();
      return reject(res, req, `sec-fetch-site=${fetchSite}`);
    }

    const sourceHost = hostOf(req.get('origin')) ?? hostOf(req.get('referer'));
    if (!sourceHost) return reject(res, req, 'no origin information');

    const ownHosts = [req.get('host'), req.get('x-forwarded-host')?.split(',')[0]]
      .filter((h): h is string => !!h)
      .map((h) => h.trim().toLowerCase());
    if (ownHosts.includes(sourceHost) || extra.has(sourceHost)) return next();

    return reject(res, req, `origin host ${sourceHost} not allowed`);
  };
}

function reject(res: Response, req: Request, reason: string) {
  console.warn('[admin-csrf] blocked request', { method: req.method, path: req.path, reason });
  return res.status(403).json({
    status: false,
    message: 'Request blocked: it did not come from this site. Reload the admin page and try again.',
    code: 'CSRF_BLOCKED'
  });
}
