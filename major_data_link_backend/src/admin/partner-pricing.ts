import type { Request, Router } from 'express';
import type { AdminSessionUser } from './auth.js';
import { logAdminAction } from './audit.js';
import { listServicePricesForAdmin, updateServicePrice } from '../services/result-pin.service.js';
import { listVerificationPricesForAdmin } from '../services/verification.service.js';

declare module 'express-session' {
  interface SessionData { adminUser?: AdminSessionUser; }
}

// AdminJS parses form posts with formidable before custom routes run. Its
// values live on req.fields, not req.body (see bulk-pricing.ts for detail).
type FormidableFields = Record<string, string | string[] | undefined>;
function fields(req: Request): FormidableFields {
  return ((req as unknown as { fields?: FormidableFields }).fields ?? {}) as FormidableFields;
}
function field(req: Request, name: string): string {
  const value = fields(req)[name];
  return typeof value === 'string' ? value : Array.isArray(value) ? value[0] ?? '' : '';
}

type ServiceRow = {
  service: string; label: string; provider: string; provider_cost: number;
  selling_price: number | null; partner_selling_price: number | null; is_active: boolean;
};

function requireFinanceOrSuper(req: Request): AdminSessionUser | null {
  const admin = req.session?.adminUser;
  return admin && admin.role !== 'SUPPORT' ? admin : null;
}
function flash(type: 'success' | 'error', message: string) { return encodeURIComponent(`${type}:${message}`); }
function readFlash(query: Record<string, unknown>): { type: 'success' | 'error'; message: string } | null {
  if (typeof query.flash !== 'string') return null;
  const [type, ...rest] = query.flash.split(':');
  return type === 'success' || type === 'error' ? { type, message: rest.join(':') } : null;
}

/** Partner-only editor: it deliberately writes partnerSellingPriceKobo, never sellingPriceKobo. */
export function registerPartnerPricingRoutes(router: Router) {
  router.get('/partner-pricing', async (req, res) => {
    const admin = requireFinanceOrSuper(req);
    if (!admin) return res.redirect('/admin/login');
    try {
      const [resultPins, verificationServices] = await Promise.all([listServicePricesForAdmin(), listVerificationPricesForAdmin()]);
      const services: ServiceRow[] = [...resultPins.map((row) => ({ ...row, provider: 'alrahuz' })), ...verificationServices];
      res.type('html').send(renderPage(admin, services, readFlash(req.query)));
    } catch (error) {
      console.error('[partner-pricing] failed to load page:', error);
      res.status(500).type('html').send('<!doctype html><title>Partner Pricing</title><p>Could not load partner pricing. Nothing was changed; check the server logs and try again.</p>');
    }
  });

  router.post('/partner-pricing/bulk-save', async (req, res) => {
    const admin = requireFinanceOrSuper(req);
    if (!admin) return res.redirect('/admin/login');
    const selected = Object.keys(fields(req)).filter((key) => key.startsWith('selected_')).map((key) => key.slice('selected_'.length));
    const amount = Number(field(req, 'amount').trim());
    const currency = field(req, 'currency');
    const priceNaira = currency === 'kobo' ? amount / 100 : amount;
    if (!selected.length) return res.redirect('/admin/partner-pricing?flash=' + flash('error', 'Zaɓi aƙalla service guda kafin saving.'));
    if (!Number.isFinite(amount) || amount <= 0 || (currency !== 'naira' && currency !== 'kobo')) {
      return res.redirect('/admin/partner-pricing?flash=' + flash('error', 'Saka ingantaccen farashi sama da sifili a Naira ko Kobo.'));
    }
    let updated = 0;
    const skipped: string[] = [];
    for (const service of selected) {
      try {
        // Retail/web pricing remains unchanged, even in bulk updates.
        await updateServicePrice(service, { partnerSellingPrice: priceNaira });
        updated += 1;
      } catch (error) {
        console.warn(`[partner-pricing] skipped ${service}:`, error);
        skipped.push(service);
      }
    }
    await logAdminAction({ adminId: admin.id, action: 'BULK_UPDATE_PARTNER_PRICING', targetType: 'ServicePricing', metadata: { services: selected, priceNaira, priceKobo: Math.round(priceNaira * 100), updated, skipped: skipped.length } });
    const amountText = currency === 'kobo' ? `${amount} kobo (₦${priceNaira.toFixed(2)})` : `₦${priceNaira.toFixed(2)}`;
    const note = skipped.length ? ` ${skipped.length} service(s) were skipped.` : '';
    return res.redirect('/admin/partner-pricing?flash=' + flash('success', `An sa partner price ${amountText} ga services ${updated}.${note}`));
  });
}

function renderPage(admin: AdminSessionUser, services: ServiceRow[], notice: { type: 'success' | 'error'; message: string } | null) {
  const escape = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const rows = services.map((service) => {
    const current = service.partner_selling_price ?? service.selling_price ?? service.provider_cost;
    const source = service.partner_selling_price !== null ? 'Partner price set' : service.selling_price !== null ? 'Using retail fallback' : 'Using provider-cost fallback';
    return `<tr><td><input type="checkbox" name="selected_${escape(service.service)}" aria-label="Select ${escape(service.label)}"></td><td><b>${escape(service.label)}</b><div class="muted">${escape(service.service)} · ${escape(service.provider)}${service.is_active ? '' : ' · <span class="inactive">inactive</span>'}</div></td><td>₦${service.provider_cost.toFixed(2)}</td><td><b>₦${current.toFixed(2)}</b><div class="muted">${Math.round(current * 100)} kobo · ${source}</div></td></tr>`;
  }).join('');
  const flashHtml = notice ? `<div class="flash ${notice.type}">${escape(notice.message)}</div>` : '';
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Partner Pricing — K-Tech Solutions</title><style>:root{--gold:#d4af37;--goldDark:#9c7a17;--bg:#faf7ef;--card:#fff;--text:#1a1508;--muted:#6b6248;--border:#e9e1c8}*{box-sizing:border-box}body{margin:0;padding:24px;background:var(--bg);color:var(--text);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif}.wrap{max-width:900px;margin:auto}header{display:flex;align-items:center;justify-content:space-between;margin-bottom:24px}h1{font-size:21px;margin:0}a{color:var(--goldDark);text-decoration:none}.card{background:var(--card);border:1px solid var(--border);border-radius:12px;padding:20px 24px;margin-bottom:20px}h2{font-size:16px;margin:0 0 6px}.hint,.muted{color:var(--muted);font-size:13px}.hint{margin:0 0 16px}.row{display:flex;gap:12px;align-items:end}.row>div{flex:1}label{display:block;font-size:13px;font-weight:600;margin:0 0 5px}input[type=number],select{width:100%;padding:10px 12px;border:1px solid var(--border);border-radius:8px;font-size:14px;background:#fffdf5}button{margin-top:18px;background:var(--gold);border:0;border-radius:8px;padding:11px 20px;font-weight:700;cursor:pointer}button:hover{background:var(--goldDark);color:#fff}.table-wrap{max-height:520px;overflow:auto;border:1px solid var(--border);border-radius:8px}table{width:100%;border-collapse:collapse;font-size:13px}th{position:sticky;top:0;background:#fff;text-align:left;padding:10px;border-bottom:1px solid var(--border);color:var(--muted)}td{padding:10px;border-bottom:1px solid var(--border);vertical-align:middle}td:first-child{width:42px;text-align:center}input[type=checkbox]{width:16px;height:16px}.select-all{display:flex;gap:8px;align-items:center;margin:12px 0;font-size:13px}.flash{padding:12px 16px;border-radius:8px;margin-bottom:20px;font-size:14px}.success{background:#eaf7ee;color:#1e7b34}.error{background:#fdecec;color:#b3261e}.inactive{color:#b3261e}@media(max-width:600px){body{padding:14px}.card{padding:16px}.row{display:block}.row>div+div{margin-top:12px}}</style></head><body><div class="wrap"><header><h1>Partner Pricing</h1><a href="/admin">← Back to admin panel</a></header>${flashHtml}<div class="card"><h2>Set one price for selected partner services</h2><p class="hint">Wannan page ɗin na API Partners kaɗai ne. Canjin nan baya canza farashin normal web/app users. Saka amount a Naira (default) ko Kobo, zaɓi services, sannan ka save sau ɗaya.</p><form method="post" action="/admin/partner-pricing/bulk-save" onsubmit="return confirmSave(this)"><div class="row"><div><label>Partner price</label><input name="amount" type="number" step="0.01" min="0.01" placeholder="Misali: 150.00" required></div><div><label>Currency</label><select name="currency"><option value="naira">Naira (₦)</option><option value="kobo">Kobo</option></select></div></div><div class="select-all"><input type="checkbox" id="select-all" onclick="toggleAll(this)"><label for="select-all" style="margin:0">Select all services shown</label></div><div class="table-wrap"><table id="services"><thead><tr><th></th><th>Service</th><th>Provider cost</th><th>Current partner price</th></tr></thead><tbody>${rows || '<tr><td colspan="4">No services found.</td></tr>'}</tbody></table></div><button type="submit">Save partner prices</button></form></div><p class="muted">Signed in as ${escape(admin.fullName)} (${escape(admin.role)})</p></div><script>function toggleAll(source){document.querySelectorAll('#services input[type=checkbox]').forEach(function(box){box.checked=source.checked})}function confirmSave(form){var count=form.querySelectorAll('#services input[type=checkbox]:checked').length;if(!count){alert('Zaɓi aƙalla service guda kafin saving.');return false}return confirm('Save this partner-only price for '+count+' selected service(s)? Normal-user prices will not change.')}</script></body></html>`;
}
