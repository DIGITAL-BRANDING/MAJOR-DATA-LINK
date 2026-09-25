import type { Request, Router } from 'express';
import type { AdminSessionUser } from './auth.js';
import { logAdminAction } from './audit.js';
import { updateServicePrice } from '../services/result-pin.service.js';
import { listAllServiceStatuses, type ServiceStatusRow } from '../lib/service-status.js';

declare module 'express-session' { interface SessionData { adminUser?: AdminSessionUser; } }
type FormidableFields = Record<string, string | string[] | undefined>;
function fields(req: Request): FormidableFields { return ((req as unknown as { fields?: FormidableFields }).fields ?? {}) as FormidableFields; }
function adminFrom(req: Request): AdminSessionUser | null { const admin = req.session?.adminUser; return admin && admin.role !== 'SUPPORT' ? admin : null; }
function flash(type: 'success' | 'error', message: string) { return encodeURIComponent(`${type}:${message}`); }
function message(query: Record<string, unknown>): { type: 'success' | 'error'; text: string } | null {
  if (typeof query.flash !== 'string') return null;
  const [type, ...text] = query.flash.split(':');
  return type === 'success' || type === 'error' ? { type, text: text.join(':') } : null;
}

type Row = ServiceStatusRow;
type CategorizedRow = Row;

/** Enables/disables service-pricing rows without touching either price or provider. */
export function registerServiceStatusRoutes(router: Router) {
  router.get('/service-status', async (req, res) => {
    const admin = adminFrom(req);
    if (!admin) return res.redirect('/admin/login');
    try {
      const rows = await listAllServiceStatuses();
      res.type('html').send(page(admin, rows, message(req.query)));
    } catch (error) {
      console.error('[service-status] failed to load:', error);
      res.status(500).type('html').send('<!doctype html><title>Service Status</title><p>Could not load service status. Nothing was changed.</p>');
    }
  });

  router.post('/service-status/save', async (req, res) => {
    const admin = adminFrom(req);
    if (!admin) return res.redirect('/admin/login');
    const requested = Object.entries(fields(req)).filter(([key]) => key.startsWith('status_')).map(([key, value]) => ({ service: key.slice(7), active: (typeof value === 'string' ? value : value?.[0]) === 'active' }));
    if (!requested.length) return res.redirect('/admin/service-status?flash=' + flash('error', 'Ba a sami service da za a adana ba.'));
    let updated = 0;
    const failed: string[] = [];
    for (const item of requested) {
      try { await updateServicePrice(item.service, { isActive: item.active }); updated += 1; }
      catch (error) { console.warn(`[service-status] skipped ${item.service}:`, error); failed.push(item.service); }
    }
    await logAdminAction({ adminId: admin.id, action: 'UPDATE_SERVICE_ACTIVATION_STATUS', targetType: 'ServicePricing', metadata: { requested, updated, failed } });
    return res.redirect('/admin/service-status?flash=' + flash('success', `An adana status na services ${updated}.${failed.length ? ` ${failed.length} sun kasa adanawa.` : ''}`));
  });
}

function page(admin: AdminSessionUser, rows: CategorizedRow[], notice: { type: 'success' | 'error'; text: string } | null) {
  const esc = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  let lastCategory = '';
  const services = rows
    .map((row) => {
      const categoryHeader =
        row.category !== lastCategory
          ? ((lastCategory = row.category), `<tr class="cat"><td colspan="2">${esc(row.category)}</td></tr>`)
          : '';
      return `${categoryHeader}<tr><td><b>${esc(row.label)}</b><div class="muted">${esc(row.service)} · ${esc(row.provider)}</div></td><td><select name="status_${esc(row.service)}"><option value="active" ${row.is_active ? 'selected' : ''}>Active</option><option value="inactive" ${row.is_active ? '' : 'selected'}>Inactive</option></select></td></tr>`;
    })
    .join('');
  const alert = notice ? `<div class="alert ${notice.type}">${esc(notice.text)}</div>` : '';
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Service Status — K-Tech Solutions</title><style>:root{--gold:#d4af37;--goldDark:#9c7a17;--bg:#faf7ef;--card:#fff;--text:#1a1508;--muted:#6b6248;--border:#e9e1c8}*{box-sizing:border-box}body{margin:0;padding:24px;background:var(--bg);color:var(--text);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif}.wrap{max-width:850px;margin:auto}header{display:flex;justify-content:space-between;align-items:center;margin-bottom:24px}h1{font-size:21px;margin:0}a{color:var(--goldDark);text-decoration:none}.card{background:var(--card);border:1px solid var(--border);border-radius:12px;padding:20px 24px}.hint,.muted{color:var(--muted);font-size:13px}.hint{margin:0 0 18px}.table{max-height:620px;overflow:auto;border:1px solid var(--border);border-radius:8px}table{width:100%;border-collapse:collapse;font-size:14px}th{position:sticky;top:0;background:#fff;color:var(--muted);font-size:12px;text-align:left;padding:10px;border-bottom:1px solid var(--border)}td{padding:11px 10px;border-bottom:1px solid var(--border)}tr.cat td{background:#f3ecd2;color:var(--goldDark);font-weight:700;font-size:11px;text-transform:uppercase;letter-spacing:.04em;padding:8px 10px;position:sticky;top:29px}select{min-width:140px;padding:9px 10px;border:1px solid var(--border);border-radius:7px;background:#fffdf5;font-size:14px}button{margin-top:18px;background:var(--gold);border:0;border-radius:8px;padding:11px 20px;font-weight:700;cursor:pointer}button:hover{background:var(--goldDark);color:#fff}.alert{padding:12px 16px;border-radius:8px;margin-bottom:18px}.success{background:#eaf7ee;color:#1e7b34}.error{background:#fdecec;color:#b3261e}@media(max-width:600px){body{padding:14px}.card{padding:16px}}</style></head><body><div class="wrap"><header><h1>Service Status</h1><a href="/admin">← Back to admin panel</a></header>${alert}<div class="card"><p class="hint">Kunna ko kashe kowane service da ake bayarwa a app din — Data, Airtime, Cable, Electricity, JAMB, NIN/BVN verification, Result Pins, CAC, Modifications, da sauransu. Wannan ba ya canza price ko provider. Inactive service ba zai amsa sabon customer request ba, kuma icon dinsa zai nuna "Not Available" a app.</p><form method="post" action="/admin/service-status/save" onsubmit="return confirm('Save these service activation settings?')"><div class="table"><table><thead><tr><th>Service</th><th>Status</th></tr></thead><tbody>${services}</tbody></table></div><button type="submit">Save service status</button></form></div><p class="muted">Signed in as ${esc(admin.fullName)} (${esc(admin.role)})</p></div></body></html>`;
}
