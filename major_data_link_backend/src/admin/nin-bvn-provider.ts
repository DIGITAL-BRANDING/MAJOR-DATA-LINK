import type { Request, Router } from 'express';
import type { AdminSessionUser } from './auth.js';
import { logAdminAction } from './audit.js';
import { updateServicePrice } from '../services/result-pin.service.js';
import { listVerificationPricesForAdmin } from '../services/verification.service.js';
import { listModificationPricesForAdmin } from '../services/nin-modification.service.js';
import { listBvnModificationPricesForAdmin } from '../services/bvn-modification.service.js';
import { env } from '../config/env.js';

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

function isPartnerOnlyIpePrice(service: string) { return service.startsWith('IPE_CLEARANCE_'); }

// These are the only services currently implemented by BOTH providers in
// verification.service.ts. Keeping unavailable choices disabled prevents an
// admin from saving a route that would fail on the next customer request.
const FRANCEVERIFIED_SERVICES = new Set([
  'NIN_VERIFICATION_V3_PREMIUM', 'NIN_VERIFICATION_V3_STANDARD', 'NIN_VERIFICATION_V3_REGULAR',
  'NIN_VERIFICATION_V3_VNIN', 'NIN_VERIFICATION_V3_SMART', 'NIN_VERIFICATION_V3_PORTRAIT', 'NIN_VERIFICATION_V3_PERSONAL',
  'NIN_PHONE_SLIP_V3_PREMIUM', 'NIN_PHONE_SLIP_V3_STANDARD', 'NIN_PHONE_SLIP_V3_REGULAR', 'NIN_PHONE_SLIP_V3_PERSONAL',
  'NIN_DEMOGRAPHIC_V3',
  'NIN_SLIP_PREMIUM', 'NIN_SLIP_STANDARD', 'NIN_SLIP_REGULAR', 'NIN_SLIP_VNIN',
  'NIN_PERSONAL_INFO_SLIP',
  'NIN_PHONE_SLIP_PREMIUM', 'NIN_PHONE_SLIP_STANDARD', 'NIN_PHONE_SLIP_REGULAR',
  'NIN_PHONE_PERSONAL_INFO_SLIP',
  'NIN_DEMOGRAPHIC', 'BVN_SLIP_PREMIUM', 'BVN_SLIP_STANDARD',
  // FranceVerified's NIN Validation adapter maps these internal services
  // to FranceVerified validation types. SIM and Update Records remain
  // Techhub-only because FranceVerified has no corresponding API type.
  // confirmed; see franceverified-nin-validation-adapter.service.ts.
  'NIN_VALIDATION_GENERAL',
  'NIN_VALIDATION_NO_RECORD',
  'NIN_VALIDATION_BANK',
  'NIN_VALIDATION_MODIFICATION',
  'NIN_VALIDATION_PHOTO_ERROR',
  'NIN_VALIDATION_VNIN'
]);

// These verification.service.ts routes have a Hubbu adapter. Its async
// endpoints create accepted requests but the published docs have no status
// lookup, so those remain pending for manual reconciliation.
const HUBBU_SERVICES = new Set([
  'NIN_SLIP_PREMIUM', 'NIN_SLIP_STANDARD', 'NIN_SLIP_REGULAR', 'NIN_SLIP_VNIN', 'NIN_PERSONAL_INFO_SLIP',
  'NIN_PHONE_SLIP_PREMIUM', 'NIN_PHONE_SLIP_STANDARD', 'NIN_PHONE_SLIP_REGULAR', 'NIN_PHONE_PERSONAL_INFO_SLIP',
  'NIN_DEMOGRAPHIC', 'NIN_DEMOGRAPHIC_V4', 'BVN_SLIP_PREMIUM', 'BVN_SLIP_STANDARD',
  'NIN_VERIFICATION_V4_PREMIUM', 'NIN_VERIFICATION_V4_STANDARD', 'NIN_VERIFICATION_V4_REGULAR', 'NIN_VERIFICATION_V4_VNIN', 'NIN_VERIFICATION_V4_PERSONAL',
  'NIN_PHONE_SLIP_V4_PREMIUM', 'NIN_PHONE_SLIP_V4_STANDARD', 'NIN_PHONE_SLIP_V4_REGULAR', 'NIN_PHONE_SLIP_V4_PERSONAL',
  'NIN_PERSONALIZATION', 'BVN_RETRIEVAL', 'IPE_CLEARANCE'
]);

// Monnify's NIN verification endpoint accepts only an NIN number and returns
// identity data (no photo), so it is exposed only on the five NIN by-NIN
// products that can be rendered from that response.
const MONNIFY_SERVICES = new Set([
  'NIN_SLIP_PREMIUM', 'NIN_SLIP_STANDARD', 'NIN_SLIP_REGULAR', 'NIN_SLIP_VNIN', 'NIN_PERSONAL_INFO_SLIP'
]);

// Versioned customer options are pinned to their provider and cannot be
// changed through the admin routing screen.
const PINNED_PROVIDERS: Record<string, 'techhub' | 'abjiktech' | 'franceverified' | 'hubbu'> = {
  NIN_VERIFICATION_V1_PREMIUM: 'techhub',
  NIN_VERIFICATION_V1_STANDARD: 'techhub',
  NIN_VERIFICATION_V1_REGULAR: 'techhub',
  NIN_VERIFICATION_V1_VNIN: 'techhub',
  NIN_VERIFICATION_V1_PERSONAL: 'techhub',
  NIN_VERIFICATION_V2_PREMIUM: 'abjiktech',
  NIN_VERIFICATION_V2_STANDARD: 'abjiktech',
  NIN_VERIFICATION_V2_REGULAR: 'abjiktech',
  NIN_VERIFICATION_V2_VNIN: 'abjiktech',
  NIN_VERIFICATION_V2_PERSONAL: 'abjiktech',
  NIN_VERIFICATION_V3_PREMIUM: 'franceverified',
  NIN_VERIFICATION_V3_STANDARD: 'franceverified',
  NIN_VERIFICATION_V3_REGULAR: 'franceverified',
  NIN_VERIFICATION_V3_VNIN: 'franceverified',
  NIN_VERIFICATION_V3_SMART: 'franceverified',
  NIN_VERIFICATION_V3_PORTRAIT: 'franceverified',
  NIN_VERIFICATION_V3_PERSONAL: 'franceverified',
  NIN_VERIFICATION_V4_PREMIUM: 'hubbu',
  NIN_VERIFICATION_V4_STANDARD: 'hubbu',
  NIN_VERIFICATION_V4_REGULAR: 'hubbu',
  NIN_VERIFICATION_V4_VNIN: 'hubbu',
  NIN_VERIFICATION_V4_PERSONAL: 'hubbu',
  NIN_PHONE_SLIP_V1_PREMIUM: 'techhub',
  NIN_PHONE_SLIP_V1_STANDARD: 'techhub',
  NIN_PHONE_SLIP_V1_REGULAR: 'techhub',
  NIN_PHONE_SLIP_V1_PERSONAL: 'techhub',
  NIN_PHONE_SLIP_V2_PREMIUM: 'abjiktech',
  NIN_PHONE_SLIP_V2_STANDARD: 'abjiktech',
  NIN_PHONE_SLIP_V2_REGULAR: 'abjiktech',
  NIN_PHONE_SLIP_V2_PERSONAL: 'abjiktech',
  NIN_PHONE_SLIP_V3_PREMIUM: 'franceverified',
  NIN_PHONE_SLIP_V3_STANDARD: 'franceverified',
  NIN_PHONE_SLIP_V3_REGULAR: 'franceverified',
  NIN_PHONE_SLIP_V3_PERSONAL: 'franceverified',
  NIN_PHONE_SLIP_V4_PREMIUM: 'hubbu',
  NIN_PHONE_SLIP_V4_STANDARD: 'hubbu',
  NIN_PHONE_SLIP_V4_REGULAR: 'hubbu',
  NIN_PHONE_SLIP_V4_PERSONAL: 'hubbu',
  NIN_DEMOGRAPHIC_V1: 'techhub',
  NIN_DEMOGRAPHIC_V2: 'abjiktech',
  NIN_DEMOGRAPHIC_V3: 'franceverified',
  NIN_DEMOGRAPHIC_V4: 'hubbu'
};

export function registerNinBvnProviderRoutes(router: Router) {
  router.get('/nin-bvn-provider', async (req, res) => {
    const admin = canManage(req);
    if (!admin) return res.redirect('/admin/login');
    try {
      const services = await getProviderServices();
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

    const knownServices = new Set((await getProviderServices()).map((item) => item.service));
    const invalid = requested.find(({ service, provider }) => {
      const pinned = PINNED_PROVIDERS[service];
      const modification = service.startsWith('NIN_MODIFICATION_') || service.startsWith('BVN_MODIFICATION_');
      if (!knownServices.has(service)) return true;
      if (pinned) return provider !== pinned;
      if (provider === 'manual' || provider === 'techhub') return false;
      if (provider === 'abjiktech') return modification || !ABJIKTECH_SERVICES.has(service) || !env.ABJIKTECH_API_KEY;
      if (provider === 'franceverified') return modification || !FRANCEVERIFIED_SERVICES.has(service) || !env.FRANCEVERIFIED_API_KEY;
      if (provider === 'hubbu') return !HUBBU_SERVICES.has(service) || !env.HUBBU_API_KEY;
      if (provider === 'monnify') return !MONNIFY_SERVICES.has(service) || !env.MONNIFY_API_KEY || !env.MONNIFY_SECRET_KEY;
      return true;
    });
    if (invalid) return res.redirect('/admin/nin-bvn-provider?flash=' + redirectMessage('error', 'Provider ɗin bai dace da service ɗin ba ko API key ɗinsa bai saita ba.'));

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

async function getProviderServices() {
  const [verification, ninModification, bvnModification] = await Promise.all([
    listVerificationPricesForAdmin(), listModificationPricesForAdmin(), listBvnModificationPricesForAdmin()
  ]);
  return [...verification.filter((service) => !isPartnerOnlyIpePrice(service.service)), ...ninModification, ...bvnModification];
}

const ABJIKTECH_SERVICES = new Set([
  'NIN_SLIP_PREMIUM', 'NIN_SLIP_STANDARD', 'NIN_SLIP_REGULAR', 'NIN_SLIP_VNIN', 'NIN_PERSONAL_INFO_SLIP',
  'NIN_PHONE_SLIP_PREMIUM', 'NIN_PHONE_SLIP_STANDARD', 'NIN_PHONE_SLIP_REGULAR', 'NIN_PHONE_PERSONAL_INFO_SLIP',
  'NIN_DEMOGRAPHIC', 'BVN_SLIP_PREMIUM', 'BVN_SLIP_STANDARD'
]);

function renderPage(admin: AdminSessionUser, services: Awaited<ReturnType<typeof getProviderServices>>, message: { type: 'success' | 'error'; message: string } | null) {
  const esc = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const rows = services.map((service) => {
    const pinnedProvider = PINNED_PROVIDERS[service.service];
    const abjiktechImplemented = ABJIKTECH_SERVICES.has(service.service);
    const abjiktechAvailable = abjiktechImplemented && Boolean(env.ABJIKTECH_API_KEY);
    const franceImplemented = FRANCEVERIFIED_SERVICES.has(service.service);
    const franceAvailable = franceImplemented && Boolean(env.FRANCEVERIFIED_API_KEY);
    const hubbuImplemented = HUBBU_SERVICES.has(service.service);
    const hubbuAvailable = hubbuImplemented && Boolean(env.HUBBU_API_KEY);
    const monnifyImplemented = MONNIFY_SERVICES.has(service.service);
    const monnifyAvailable = monnifyImplemented && Boolean(env.MONNIFY_API_KEY && env.MONNIFY_SECRET_KEY);
    const modification = service.service.startsWith('NIN_MODIFICATION_') || service.service.startsWith('BVN_MODIFICATION_');
    if (pinnedProvider) {
      const providerName = { techhub: 'Techhub', abjiktech: 'AbjikTech', franceverified: 'FranceVerified', hubbu: 'Hubbu' }[pinnedProvider];
      const keyMissing = (pinnedProvider === 'abjiktech' && !env.ABJIKTECH_API_KEY) || (pinnedProvider === 'franceverified' && !env.FRANCEVERIFIED_API_KEY) || (pinnedProvider === 'hubbu' && !env.HUBBU_API_KEY);
      const version = service.service.match(/_V([1-4])_/)?.[1];
      return `<tr><td><b>${esc(service.label)}</b><div class="muted">${esc(service.service)}</div></td><td><input type="hidden" name="provider_${esc(service.service)}" value="${pinnedProvider}"><select disabled><option selected>${providerName} (fixed)</option></select></td><td class="muted">${version ? `This V${version} service uses ${providerName} directly.` : `This service uses ${providerName} directly.`}${keyMissing ? ` The ${providerName} API key is not configured.` : ''}</td></tr>`;
    }
    const unavailableLabel = ' — API key missing';
    const availability = modification ? `Hubbu${hubbuAvailable ? '' : ' API key missing'} ya haɗu da modification endpoint; idan ba a zaɓe shi ba, request zai tsaya a manual queue.` : [
      'Techhub',
      ...(abjiktechAvailable ? ['AbjikTech'] : []),
      ...(franceAvailable ? ['FranceVerified'] : []),
      ...(hubbuAvailable ? ['Hubbu'] : []),
      ...(monnifyAvailable ? ['Monnify'] : []),
      'Manual'
    ].join(', ') + (hubbuAvailable && ['IPE_CLEARANCE', 'BVN_RETRIEVAL', 'NIN_PERSONALIZATION'].includes(service.service) ? '. Hubbu accepts these requests, but its published API has no status endpoint; requests stay pending for manual completion.' : '.');
    return `<tr><td><b>${esc(service.label)}</b><div class="muted">${esc(service.service)}</div></td><td><select name="provider_${esc(service.service)}">${modification ? `<option value="techhub" ${service.provider === 'techhub' ? 'selected' : ''}>Techhub manual processing</option>` : `<option value="techhub" ${service.provider === 'techhub' ? 'selected' : ''}>Techhub</option><option value="abjiktech" ${service.provider === 'abjiktech' ? 'selected' : ''} ${abjiktechAvailable ? '' : 'disabled'}>AbjikTech${abjiktechAvailable ? '' : unavailableLabel}</option><option value="franceverified" ${service.provider === 'franceverified' ? 'selected' : ''} ${franceAvailable ? '' : 'disabled'}>FranceVerified${franceAvailable ? '' : unavailableLabel}</option>`}<option value="hubbu" ${service.provider === 'hubbu' ? 'selected' : ''} ${hubbuAvailable || (modification && Boolean(env.HUBBU_API_KEY)) ? '' : 'disabled'}>Hubbu${hubbuAvailable || (modification && env.HUBBU_API_KEY) ? '' : unavailableLabel}</option><option value="monnify" ${service.provider === 'monnify' ? 'selected' : ''} ${monnifyAvailable ? '' : 'disabled'}>Monnify${monnifyAvailable ? '' : unavailableLabel}</option><option value="manual" ${service.provider === 'manual' ? 'selected' : ''}>Manual admin processing</option></select></td><td class="muted">${availability}</td></tr>`;
  }).join('');
  const alert = message ? `<div class="alert ${message.type}">${esc(message.message)}</div>` : '';
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>NIN/BVN Provider — K-Tech Solutions</title><style>:root{--gold:#d4af37;--goldDark:#9c7a17;--bg:#faf7ef;--card:#fff;--text:#1a1508;--muted:#6b6248;--border:#e9e1c8}*{box-sizing:border-box}body{margin:0;padding:24px;background:var(--bg);color:var(--text);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif}.wrap{max-width:950px;margin:auto}header{display:flex;justify-content:space-between;align-items:center;margin-bottom:24px}h1{font-size:21px;margin:0}a{color:var(--goldDark);text-decoration:none}.card{background:var(--card);border:1px solid var(--border);border-radius:12px;padding:20px 24px}.hint,.muted{color:var(--muted);font-size:13px}.hint{margin:0 0 18px}table{width:100%;border-collapse:collapse;font-size:14px}th{color:var(--muted);font-size:12px;text-align:left;padding:10px;border-bottom:1px solid var(--border)}td{padding:11px 10px;border-bottom:1px solid var(--border);vertical-align:middle}select{width:100%;min-width:190px;padding:9px 10px;border:1px solid var(--border);border-radius:7px;background:#fffdf5;font-size:14px}button{margin-top:18px;background:var(--gold);border:0;border-radius:8px;padding:11px 20px;font-weight:700;cursor:pointer}button:hover{background:var(--goldDark);color:white}.table{overflow:auto;border:1px solid var(--border);border-radius:8px}.alert{padding:12px 16px;border-radius:8px;margin-bottom:18px}.success{background:#eaf7ee;color:#1e7b34}.error{background:#fdecec;color:#b3261e}@media(max-width:650px){body{padding:14px}.card{padding:16px}header{align-items:flex-start;gap:12px}table{min-width:700px}}</style></head><body><div class="wrap"><header><h1>NIN/BVN Provider</h1><a href="/admin">← Back to admin panel</a></header>${alert}<div class="card"><p class="hint">Zaɓi provider na kowane NIN/BVN service ɗaya bayan ɗaya, sannan ka danna save. Za ka iya zaɓar <b>Manual admin processing</b> ga kowanne service — request zai kasance PENDING a Transaction ledger, sannan SUPER_ADMIN zai duba encrypted PII da “View PII” ya mark completed, ko Finance/SUPER_ADMIN ya reverse domin refund. FranceVerified yana samuwa ne kawai a services da aka haɗa da shi.</p><form method="post" action="/admin/nin-bvn-provider/save" onsubmit="return confirm('Save the provider selection for all NIN/BVN services?')"><div class="table"><table><thead><tr><th>Service</th><th>Provider</th><th>Availability</th></tr></thead><tbody>${rows}</tbody></table></div><button type="submit">Save provider selections</button></form></div><p class="muted">Signed in as ${esc(admin.fullName)} (${esc(admin.role)})</p></div></body></html>`;
}
