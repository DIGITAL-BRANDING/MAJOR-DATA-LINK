import type { Request, Router } from 'express';
import type { AdminSessionUser } from './auth.js';
import { logAdminAction } from './audit.js';
import { listServicePricesForAdmin, updateServicePrice } from '../services/result-pin.service.js';
import { listVerificationPricesForAdmin } from '../services/verification.service.js';
import { listCacPricesForAdmin } from '../services/cac.service.js';
import { listBvnModificationPricesForAdmin } from '../services/bvn-modification.service.js';
import { listModificationPricesForAdmin } from '../services/nin-modification.service.js';
import { listNewspaperPublicationPriceForAdmin } from '../services/newspaper-publication.service.js';
import { listBirthAttestationPriceForAdmin } from '../services/birth-attestation.service.js';
import { listBvnCrmPriceForAdmin } from '../services/bvn-crm.service.js';
import { listBvnLicensePriceForAdmin } from '../services/bvn-license-onboarding.service.js';
import { listJambPricesForAdmin } from '../services/jamb-pricing.service.js';
import { prisma } from '../lib/prisma.js';
import { listPartnerServicePriceOverrides, setPartnerServicePriceOverride } from '../services/partner-service-pricing.service.js';
import { ensurePartnerEnterpriseOfferCode } from '../services/partner-enterprise-profile.service.js';

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
      const [services, partners] = await Promise.all([loadPartnerPricingServices(), prisma.partner.findMany({ orderBy: { businessName: 'asc' }, select: { id: true, businessName: true, email: true, enterpriseOfferCode: true } })]);
      const partnerId = typeof req.query.partnerId === 'string' && partners.some((partner) => partner.id === req.query.partnerId) ? req.query.partnerId : '';
      const overrides = partnerId ? await listPartnerServicePriceOverrides(partnerId) : new Map<string, number>();
      if (partnerId) {
        const offerCode = await ensurePartnerEnterpriseOfferCode(partnerId);
        const selected = partners.find((partner) => partner.id === partnerId);
        if (selected) selected.enterpriseOfferCode = offerCode;
      }
      res.type('html').send(renderPage(admin, services, partners, partnerId, overrides, readFlash(req.query)));
    } catch (error) {
      console.error('[partner-pricing] failed to load page:', error);
      res.status(500).type('html').send('<!doctype html><title>Partner Pricing</title><p>Could not load partner pricing. Nothing was changed; check the server logs and try again.</p>');
    }
  });

  router.post('/partner-pricing/partner-save', async (req, res) => {
    const admin = requireFinanceOrSuper(req);
    if (!admin) return res.redirect('/admin/login');
    const partnerId = field(req, 'partner_id').trim();
    const partner = await prisma.partner.findUnique({ where: { id: partnerId }, select: { id: true, businessName: true } });
    if (!partner) return res.redirect('/admin/partner-pricing?flash=' + flash('error', 'Zaɓin partner ɗin bai inganta ba.'));
    const services = await loadPartnerPricingServices();
    const allowed = new Set(services.map((service) => service.service));
    const changes: Array<{ service: string; price: number | null }> = [];
    for (const key of Object.keys(fields(req)).filter((name) => name.startsWith('enterprise_'))) {
      const service = key.slice('enterprise_'.length);
      if (!allowed.has(service)) continue;
      const raw = field(req, key).trim();
      if (!raw) {
        changes.push({ service, price: null });
        continue;
      }
      const price = Number(raw);
      if (!Number.isFinite(price) || price <= 0 || price > 10_000_000) {
        return res.redirect(`/admin/partner-pricing?partnerId=${encodeURIComponent(partnerId)}&flash=` + flash('error', `Farashin ${service} bai inganta ba.`));
      }
      changes.push({ service, price });
    }
    let saved = 0;
    let cleared = 0;
    for (const change of changes) {
      await setPartnerServicePriceOverride(partnerId, change.service, change.price);
      if (change.price === null) cleared += 1;
      else saved += 1;
    }
    await logAdminAction({ adminId: admin.id, action: 'UPDATE_PARTNER_ENTERPRISE_PRICING', targetType: 'Partner', targetId: partnerId, metadata: { saved, cleared } });
    return res.redirect(`/admin/partner-pricing?partnerId=${encodeURIComponent(partnerId)}&flash=` + flash('success', `An ajiye farashin musamman ${saved}; an cire overrides ${cleared}.`));
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

async function loadPartnerPricingServices(): Promise<ServiceRow[]> {
  const [resultPins, verificationServices, cac, bvnMod, ninMod, newspaper, birth, bvnCrm, bvnLicense, jamb] = await Promise.all([
    listServicePricesForAdmin(), listVerificationPricesForAdmin(), listCacPricesForAdmin(), listBvnModificationPricesForAdmin(),
    listModificationPricesForAdmin(), listNewspaperPublicationPriceForAdmin(), listBirthAttestationPriceForAdmin(), listBvnCrmPriceForAdmin(),
    listBvnLicensePriceForAdmin(), listJambPricesForAdmin()
  ]);
  return [
    ...resultPins.map((row) => ({ ...row, provider: 'inventory' })), ...verificationServices.filter((row) => row.service !== 'IPE_CLEARANCE'),
    ...cac, ...bvnMod, ...ninMod, ...newspaper, ...birth, ...bvnCrm, ...bvnLicense, ...jamb
  ];
}

function renderPage(admin: AdminSessionUser, services: ServiceRow[], partners: Array<{ id: string; businessName: string; email: string; enterpriseOfferCode: string | null }>, partnerId: string, overrides: Map<string, number>, notice: { type: 'success' | 'error'; message: string } | null) {
  const escape = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  const rows = services.map((service) => {
    const current = service.partner_selling_price ?? service.selling_price ?? service.provider_cost;
    const source = service.partner_selling_price !== null ? 'Partner price set' : service.selling_price !== null ? 'Using retail fallback' : 'Using provider-cost fallback';
    return `<tr><td><input type="checkbox" name="selected_${escape(service.service)}" aria-label="Select ${escape(service.label)}"></td><td><b>${escape(service.label)}</b><div class="muted">${escape(service.service)} · ${escape(service.provider)}${service.is_active ? '' : ' · <span class="inactive">inactive</span>'}</div></td><td>₦${service.provider_cost.toFixed(2)}</td><td><b>₦${current.toFixed(2)}</b><div class="muted">${Math.round(current * 100)} kobo · ${source}</div></td></tr>`;
  }).join('');
  const partnerOptions = partners.map((partner) => `<option value="${escape(partner.id)}" ${partner.id === partnerId ? 'selected' : ''}>${escape(partner.businessName)} — ${escape(partner.email)}</option>`).join('');
  const enterpriseRows = services.map((service) => {
    const override = overrides.get(service.service);
    const sharedPrice = service.partner_selling_price ?? service.selling_price ?? service.provider_cost;
    return `<tr><td>${escape(service.label)}<div class="muted">${escape(service.service)} · shared rate ₦${sharedPrice.toFixed(2)}</div></td><td><input name="enterprise_${escape(service.service)}" type="number" min="0.01" step="0.01" value="${override === undefined ? '' : override.toFixed(2)}" placeholder="Use shared rate"></td></tr>`;
  }).join('');
  const selectedPartner = partners.find((partner) => partner.id === partnerId);
  const offerCode = selectedPartner?.enterpriseOfferCode ?? 'Code will be issued when this partner opens the portal';
  const enterpriseSection = `<div class="card"><h2>Enterprise rate for one partner</h2><p class="hint">Zaɓi partner ka saka farashi ga kowane service. Filin da aka bari babu komai zai yi amfani da shared partner price. Wannan canjin yana shafar API key ɗin wannan partner kawai.</p><form method="get" action="/admin/partner-pricing"><label>Partner account</label><select name="partnerId" onchange="this.form.submit()"><option value="">Choose partner</option>${partnerOptions}</select></form>${partnerId ? `<div class="offer-code"><b>Private enterprise offer code:</b> <code>${escape(offerCode)}</code><span>Ka bai wa wannan partner wannan code kawai; ana amfani da override ɗin da ke ƙasa ne a billing.</span></div><form method="post" action="/admin/partner-pricing/partner-save"><input type="hidden" name="partner_id" value="${escape(partnerId)}"><div class="table-wrap"><table><thead><tr><th>Service</th><th>Partner-specific price (₦)</th></tr></thead><tbody>${enterpriseRows}</tbody></table></div><button type="submit">Save enterprise offer</button></form>` : ''}</div>`;
  const flashHtml = notice ? `<div class="flash ${notice.type}">${escape(notice.message)}</div>` : '';
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Partner Pricing — K-Tech Solutions</title><style>:root{--gold:#d4af37;--goldDark:#9c7a17;--bg:#faf7ef;--card:#fff;--text:#1a1508;--muted:#6b6248;--border:#e9e1c8}*{box-sizing:border-box}body{margin:0;padding:24px;background:var(--bg);color:var(--text);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif}.wrap{max-width:900px;margin:auto}header{display:flex;align-items:center;justify-content:space-between;margin-bottom:24px}h1{font-size:21px;margin:0}a{color:var(--goldDark);text-decoration:none}.card{background:var(--card);border:1px solid var(--border);border-radius:12px;padding:20px 24px;margin-bottom:20px}h2{font-size:16px;margin:0 0 6px}.hint,.muted{color:var(--muted);font-size:13px}.hint{margin:0 0 16px}.row{display:flex;gap:12px;align-items:end}.row>div{flex:1}label{display:block;font-size:13px;font-weight:600;margin:0 0 5px}input[type=number],select{width:100%;padding:10px 12px;border:1px solid var(--border);border-radius:8px;font-size:14px;background:#fffdf5}button{margin-top:18px;background:var(--gold);border:0;border-radius:8px;padding:11px 20px;font-weight:700;cursor:pointer}button:hover{background:var(--goldDark);color:#fff}.table-wrap{max-height:520px;overflow:auto;border:1px solid var(--border);border-radius:8px}table{width:100%;border-collapse:collapse;font-size:13px}th{position:sticky;top:0;background:#fff;text-align:left;padding:10px;border-bottom:1px solid var(--border);color:var(--muted)}td{padding:10px;border-bottom:1px solid var(--border);vertical-align:middle}td:first-child{width:42px;text-align:center}input[type=checkbox]{width:16px;height:16px}.select-all{display:flex;gap:8px;align-items:center;margin:12px 0;font-size:13px}.offer-code{display:flex;flex-wrap:wrap;align-items:center;gap:8px;padding:12px;margin:14px 0;background:#fff8dc;border:1px solid #e9d27a;border-radius:8px;font-size:13px}.offer-code code{font-size:15px;font-weight:800;letter-spacing:.08em;color:#6c4f00}.offer-code span{width:100%;color:var(--muted);font-size:12px}.flash{padding:12px 16px;border-radius:8px;margin-bottom:20px;font-size:14px}.success{background:#eaf7ee;color:#1e7b34}.error{background:#fdecec;color:#b3261e}.inactive{color:#b3261e}@media(max-width:600px){body{padding:14px}.card{padding:16px}.row{display:block}.row>div+div{margin-top:12px}}</style></head><body><div class="wrap"><header><h1>Partner Pricing</h1><a href="/admin">← Back to admin panel</a></header>${flashHtml}${enterpriseSection}<div class="card"><h2>Set one price for selected partner services</h2><p class="hint">Wannan page ɗin na API Partners kaɗai ne. Canjin nan baya canza farashin normal web/app users. Kowane IPE type yana da layinsa; idan farashinsa zai bambanta, zaɓi type ɗaya ka sa masa farashi daban.</p><form method="post" action="/admin/partner-pricing/bulk-save" onsubmit="return confirmSave(this)"><div class="row"><div><label>Partner price</label><input name="amount" type="number" step="0.01" min="0.01" placeholder="Misali: 150.00" required></div><div><label>Currency</label><select name="currency"><option value="naira">Naira (₦)</option><option value="kobo">Kobo</option></select></div></div><div class="select-all"><input type="checkbox" id="select-all" onclick="toggleAll(this)"><label for="select-all" style="margin:0">Select all services shown</label></div><div class="table-wrap"><table id="services"><thead><tr><th></th><th>Service</th><th>Provider cost</th><th>Current partner price</th></tr></thead><tbody>${rows || '<tr><td colspan="4">No services found.</td></tr>'}</tbody></table></div><button type="submit">Save partner prices</button></form></div><p class="muted">Signed in as ${escape(admin.fullName)} (${escape(admin.role)})</p></div><script>function toggleAll(source){document.querySelectorAll('#services input[type=checkbox]').forEach(function(box){box.checked=source.checked})}function confirmSave(form){var count=form.querySelectorAll('#services input[type=checkbox]:checked').length;if(!count){alert('Zaɓi aƙalla service guda kafin saving.');return false}return confirm('Save this partner-only price for '+count+' selected service(s)? Normal-user prices will not change.')}</script></body></html>`;
}
