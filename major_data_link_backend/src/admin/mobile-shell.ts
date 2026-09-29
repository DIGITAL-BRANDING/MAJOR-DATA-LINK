import type { NextFunction, Request, Response } from 'express';

/**
 * Makes every server-rendered admin page (Manual Requests, Bulk Pricing,
 * Company Wallet, User Deliveries, ...) usable on a phone without needing
 * "Desktop site" mode. Several of those pages were written without a
 * <meta name="viewport"> tag at all, so mobile browsers laid them out at a
 * ~980px virtual width and shrank them. Rather than editing 20 templates,
 * this wraps res.send() for the admin router: if the body is a full HTML
 * page it (1) adds the viewport tag when missing and (2) appends one small
 * stylesheet with mobile-only rules (media query), so desktop is untouched.
 *
 * Skipped for the AdminJS SPA shell (has #app) and for the Live Chat page,
 * which ships its own WhatsApp-style responsive layout.
 */
const MOBILE_CSS = `<style id="mobile-shell">
@media (max-width: 768px) {
  html { -webkit-text-size-adjust: 100%; }
  body { padding: 14px 12px !important; margin-left: 0 !important; margin-right: 0 !important; overflow-x: hidden; }
  h1 { font-size: 20px !important; line-height: 1.25; }
  h2 { font-size: 16px !important; }
  .wrap, main.wrap { max-width: 100% !important; }
  .top, header { flex-wrap: wrap; gap: 8px 12px; }
  .card, section { padding: 14px !important; border-radius: 12px; }
  .cards, .stats, .provider-cards { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
  .cards { display: grid !important; gap: 10px; }
  .card { min-width: 0 !important; }
  .forms, .adjust-form, .txn-head + .forms { grid-template-columns: 1fr !important; }
  .row, .custom-range, .search, .pages, .filter-bar { flex-wrap: wrap; }
  .row { flex-direction: column; }
  .search input { min-width: 0; width: 100%; }
  .resolve-form { flex-wrap: wrap; }
  .resolve-form input { min-width: 0 !important; flex: 1 1 120px; }
  dl { grid-template-columns: 1fr !important; }
  dt { margin-top: 6px; }
  .tabs { gap: 8px !important; }
  .tab, .chip { padding: 8px 12px !important; }
  table { display: block; max-width: 100%; overflow-x: auto; -webkit-overflow-scrolling: touch; }
  th, td { padding: 9px 8px !important; }
  input:not([type=checkbox]):not([type=radio]):not([type=file]), select, textarea { font-size: 16px !important; min-height: 42px; }
  button, .submit { min-height: 44px; }
  form.action-form button, .adjust-form button, .submit { width: 100%; justify-self: stretch !important; }
}
</style>`;

const VIEWPORT = '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">';

export function mobileShell(_req: Request, res: Response, next: NextFunction) {
  const originalSend = res.send.bind(res);
  res.send = ((body?: unknown) => {
    if (
      typeof body === 'string' &&
      /<html[\s>]/i.test(body) &&
      /<\/head>/i.test(body) &&
      !body.includes('id="app"') &&
      !body.includes('id="mobile-shell"') &&
      !body.includes('Live Chat — K-Tech')
    ) {
      let html = body;
      if (!/name=["']viewport["']/i.test(html)) {
        html = /<head[^>]*>/i.test(html)
          ? html.replace(/<head[^>]*>/i, (m) => `${m}${VIEWPORT}`)
          : html;
      }
      html = html.replace(/<\/head>/i, `${MOBILE_CSS}</head>`);
      return originalSend(html);
    }
    return originalSend(body as never);
  }) as typeof res.send;
  next();
}
