import type { Request, Router } from 'express';
import type { AdminSessionUser } from './auth.js';
import { logAdminAction } from './audit.js';
import { updateServicePrice } from '../services/result-pin.service.js';
import { listVerificationPricesForAdmin } from '../services/verification.service.js';

declare module 'express-session' { interface SessionData { adminUser?: AdminSessionUser; } }
type FormidableFields = Record<string, string | string[] | undefined>;
function fields(req: Request): FormidableFields { return ((req as unknown as { fields?: FormidableFields }).fields ?? {}) as FormidableFields; }
function field(req: Request, name: string): string {
  const value = fields(req)[name];
  return typeof value === 'string' ? value : Array.isArray(value) ? value[0] ?? '' : '';
}
function canManage(req: Request): AdminSessionUser | null {
  const admin = req.session?.adminUser;
  return admin && admin.role !== 'SUPPORT' ? admin : null;
}
function redirectMessage(type: 'success' | 'error', message: string) { return encodeURIComponent(`${type}:${message}`); }
function parseMessage(query: Record<string, unknown>): { type: 'success' | 'error'; message: string } | null {
  if (typeof query.flash !== 'string') return null;
  const [type, ...rest] = query.flash.split(':');
  return type === 'success' || type === 'error' ? { type, message: rest.join(':') } : null;
}

// These are the only services currently implemented by BOTH providers in
// verification.service.ts. Keeping unavailable choices disabled prevents an
// admin from saving a route that would fail on the next customer request.
const FRANCEVERIFIED_SERVICES = new Set([
  'NIN_SLIP_PREMIUM', 'NIN_SLIP_STANDARD', 'NIN_SLIP_REGULAR', 'NIN_SLIP_VNIN',
  'NIN_PHONE_SLIP_PREMIUM', 'NIN_PHONE_SLIP_STANDARD', 'NIN_PHONE_SLIP_REGULAR',
  'NIN_DEMOGRAPHIC', 'BVN_SLIP_PREMIUM', 'BVN_SLIP_STANDARD'
]);

export function registerNinBvnProviderRoutes(router: Router) {
  router.get('/nin-bvn-provider', async (req, res) => {
    const admin = canManage(req);
    if (!admin) return res.redirect('/admin/login');
    try {
      const services = await listVerificationPricesForAdmin();
      res.type('html').send(renderPage(admin, services, parseMessage(req.query)));
    } catch (error) {
      console.error('[nin-bvn-provider] failed to load page:', error);
      res.status(500).type('html').send('<!doctype html><title>NIN/BVN Provider</title><p>Could not load provider settings. Nothing was changed.</p>');
    }
  });

  router.post('/nin-bvn-provider/save', async (req, res) => {
    const admin = canManage(req);
    if (!admin) return res.redirect('/admin/login');
    const requested = Object.entries(fields(req))
      .filter(([key]) => key.startsWith('provider_'))
      .map(([key, value]) => ({ service: key.slice('provider_'.length), provider: typeof value === 'string' ? value : value?.[0] ?? '' }));
    if (!requested.length) return res.redirect('/admin/nin-bvn-provider?flash=' + redirectMessage('error', 'Ba a sami service da za a adana ba.'));

    const invalid = requested.find(({ service, provider }) => provider !== 'techhub' && !(provider === 'franceverified' && FRANCEVERIFIED_SERVICES.has(service)));
    if (invalid) return res.redirect('/admin/nin-bvn-provider?flash=' + redirectMessage('error', 'An ƙi provider ɗin da aka zaɓa saboda babu haɗinsa da wannan service.'));

    let updated = 0;
    const failed: string[] = [];
    for (const { service, provider } of requested) {
      try { await updateServicePrice(service, { provider }); updated += 1; }
      catch (error) { console.warn(`[nin-bvn-provider] skipped ${service}:`, error); failed.push(service); }
    }
    await logAdminAction({ adminId: admin.id, action: 'UPDATE_NIN_BVN_SERVICE_PROVIDERS', targetType: 'ServicePricing', metadata: { requested, updated, failed } });
    const note = failed.length ? ` ${failed.length} service(s) could not be saved.` : '';
    return res.redirect('/admin/nin-bvn-provider?flash=' + redirectMessage('success', `An adana provider ga services ${updated}.${note}`));
  });
}

function renderPage(admin: AdminSessionUser, services: Awaited<ReturnType<typeof listVerificationPricesForAdmin>>, message: { type: 'success' | 'error'; message: string } | null) {
  const esc = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const rows = services.map((service) => {
    const franceAvailable = FRANCEVERIFIED_SERVICES.has(service.service);
    return `<tr><td><b>${esc(service.label)}</b><div class="muted">${esc(service.service)}</div></td><td><select name="provider_${esc(service.service)}"><option value="techhub" ${service.provider === 'techhub' ? 'selected' : ''}>Techhub</option><option value="franceverified" ${service.provider === 'franceverified' ? 'selected' : ''} ${franceAvailable ? '' : 'disabled'}>FranceVerified${franceAvailable ? '' : ' — not available yet'}</option></select></td><td class="muted">${franceAvailable ? 'Choose Techhub or FranceVerified.' : 'Techhub is currently the only provider integrated for this service.'}</td></tr>`;
  }).join('');
  const alert = message ? `<div class="alert ${message.type}">${esc(message.message)}</div>` : '';
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>NIN/BVN Provider — K-Tech Solutions</title><style>:root{--gold:#d4af37;--goldDark:#9c7a17;--bg:#faf7ef;--card:#fff;--text:#1a1508;--muted:#6b6248;--border:#e9e1c8}*{box-sizing:border-box}body{margin:0;padding:24px;background:var(--bg);color:var(--text);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif}.wrap{max-width:950px;margin:auto}header{display:flex;justify-content:space-between;align-items:center;margin-bottom:24px}h1{font-size:21px;margin:0}a{color:var(--goldDark);text-decoration:none}.card{background:var(--card);border:1px solid var(--border);border-radius:12px;padding:20px 24px}.hint,.muted{color:var(--muted);font-size:13px}.hint{margin:0 0 18px}table{width:100%;border-collapse:collapse;font-size:14px}th{color:var(--muted);font-size:12px;text-align:left;padding:10px;border-bottom:1px solid var(--border)}td{padding:11px 10px;border-bottom:1px solid var(--border);vertical-align:middle}select{width:100%;min-width:190px;padding:9px 10px;border:1px solid var(--border);border-radius:7px;background:#fffdf5;font-size:14px}button{margin-top:18px;background:var(--gold);border:0;border-radius:8px;padding:11px 20px;font-weight:700;cursor:pointer}button:hover{background:var(--goldDark);color:white}.table{overflow:auto;border:1px solid var(--border);border-radius:8px}.alert{padding:12px 16px;border-radius:8px;margin-bottom:18px}.success{background:#eaf7ee;color:#1e7b34}.error{background:#fdecec;color:#b3261e}@media(max-width:650px){body{padding:14px}.card{padding:16px}header{align-items:flex-start;gap:12px}table{min-width:700px}}</style></head><body><div class="wrap"><header><h1>NIN/BVN Provider</h1><a href="/admin">← Back to admin panel</a></header>${alert}<div class="card"><p class="hint">Zaɓi provider na kowane NIN/BVN service ɗaya bayan ɗaya, sannan ka danna save. Wannan page ɗin provider routing kawai yake canzawa; ba ya canza price. FranceVerified yana samuwa ne kawai a services da aka haɗa da shi a yanzu, domin kada customer request ya faɗi.</p><form method="post" action="/admin/nin-bvn-provider/save" onsubmit="return confirm('Save the provider selection for all NIN/BVN services?')"><div class="table"><table><thead><tr><th>Service</th><th>Provider</th><th>Availability</th></tr></thead><tbody>${rows}</tbody></table></div><button type="submit">Save provider selections</button></form></div><p class="muted">Signed in as ${esc(admin.fullName)} (${esc(admin.role)})</p></div></body></html>`;
}
