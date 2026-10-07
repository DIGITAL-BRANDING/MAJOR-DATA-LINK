import type { Request, Router } from 'express';
import { TransactionStatus, TransactionType } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { openPII } from '../lib/pii.js';
import { dispatchManualCustomerRequest, dispatchManualPartnerRequest, manualDispatchProviderConfigured, manualDispatchProviders } from '../services/manual-provider-dispatch.service.js';
import type { ManualDispatchProvider } from '../services/manual-provider-dispatch.service.js';
import { logAdminAction } from './audit.js';
import type { AdminSessionUser } from './auth.js';

function escapeHtml(value: string) { return value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!); }
function field(req: Request, name: string) {
  const body = req.body as Record<string, unknown> | undefined;
  const fields = (req as unknown as { fields?: Record<string, unknown> }).fields;
  const value = body?.[name] ?? fields?.[name];
  return typeof value === 'string' ? value.trim() : '';
}
function displayIdentifier(pii: Record<string, unknown> | null) {
  if (!pii) return '—';
  for (const [key, label] of [['nin', 'NIN'], ['tracking_id', 'Tracking ID']] as const) {
    const value = pii[key];
    if (typeof value === 'string' && value.trim()) return `${label}: ${value.trim()}`;
  }
  for (const [key, label] of [['bvn', 'BVN'], ['phone_number', 'Phone'], ['phone', 'Phone']] as const) {
    const value = pii[key];
    if (typeof value === 'string' && value.trim()) return `${label}: ••••••${value.slice(-4)}`;
  }
  return '—';
}
function serviceName(metadata: unknown) {
  const value = typeof metadata === 'object' && metadata !== null ? (metadata as Record<string, unknown>).service : undefined;
  return typeof value === 'string' ? value : '';
}
function providersFor(service: string) {
  return manualDispatchProviders(service).map((provider) => ({ provider, enabled: manualDispatchProviderConfigured(service, provider) }));
}

export function registerManualProviderDispatchRoutes(router: Router) {
  router.get('/manual-provider-dispatch', async (req: Request, res) => {
    const admin = req.session?.adminUser as AdminSessionUser | undefined;
    if (!admin) return res.redirect('/admin/login');
    const where = { status: TransactionStatus.PENDING, type: TransactionType.IDENTITY_SERVICE_REQUEST, provider: { in: ['manual', 'manual_dispatching'] } };
    const [customers, partners] = await Promise.all([
      prisma.transaction.findMany({ where, include: { user: { select: { fullName: true, email: true } } }, orderBy: { createdAt: 'asc' } }),
      prisma.partnerTransaction.findMany({ where, include: { partner: { select: { businessName: true, email: true } } }, orderBy: { createdAt: 'asc' } })
    ]);
    const rows = [
      ...customers.map((row) => ({ ...row, source: 'Customer', owner: row.user.fullName, email: row.user.email, kind: 'customer' as const })),
      ...partners.map((row) => ({ ...row, source: 'Partner API', owner: row.partner.businessName, email: row.partner.email, kind: 'partner' as const }))
    ].filter((row) => providersFor(serviceName(row.metadata)).length > 0);
    const flash = typeof req.query.flash === 'string' ? escapeHtml(req.query.flash) : '';
    const table = rows.length ? rows.map((row) => {
      const metadata = (row.metadata as Record<string, unknown> | null) ?? {};
      const service = serviceName(metadata);
      const dispatch = metadata.manual_dispatch as Record<string, unknown> | undefined;
      const inRecovery = row.provider === 'manual_dispatching';
      const providerChoices = providersFor(service).map(({ provider, enabled }) => `<option value="${provider}" ${enabled ? '' : 'disabled'}>${provider === 'techhub' ? 'Techhub' : 'FranceVerified'}${enabled ? '' : ' (not configured)'}</option>`).join('');
      const form = inRecovery
        ? `<strong class="recovery">Provider may have accepted this request. Reconcile it manually; do not resubmit.</strong><small>State: ${escapeHtml(String(dispatch?.status ?? 'unknown'))}</small>`
        : `<form method="post" action="/admin/manual-provider-dispatch/${row.kind}/${encodeURIComponent(row.id)}"><select name="provider" required><option value="">Choose provider</option>${providerChoices}</select><button type="submit">Send request</button></form>`;
      const pii = openPII<Record<string, unknown>>(metadata.pii);
      const ipe = typeof metadata.ipe_type === 'string' ? `<small>IPE type: ${escapeHtml(metadata.ipe_type.replace(/_/g, ' '))}</small>` : '';
      return `<tr><td>${escapeHtml(row.source)}</td><td><strong>${escapeHtml(service.replace(/_/g, ' '))}</strong>${ipe}<small>${escapeHtml(row.reference)}</small></td><td>${escapeHtml(row.owner)}<small>${escapeHtml(row.email)}</small></td><td class="identifier">${escapeHtml(displayIdentifier(pii))}</td><td>${escapeHtml(row.createdAt.toLocaleString())}</td><td>${form}</td></tr>`;
    }).join('') : '<tr><td colspan="6" class="empty">No eligible ticket requests are waiting for provider dispatch.</td></tr>';
    return res.type('html').send(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Manual Provider Dispatch</title><style>body{font:14px Arial,sans-serif;background:#f5f6f8;color:#18212f;margin:0;padding:28px}a{color:#0756b8;font-weight:600;text-decoration:none}.top{display:flex;justify-content:space-between;align-items:center;gap:16px}.hint{color:#536273}.flash{background:#e6f4ea;color:#155724;padding:12px;border-radius:8px}.notice{background:#fff8df;border:1px solid #e7d28a;padding:12px;border-radius:8px}table{border-collapse:collapse;width:100%;min-width:1000px;background:#fff;box-shadow:0 1px 4px #0001}th,td{text-align:left;padding:12px;border-bottom:1px solid #e7edf4;vertical-align:top}th{background:#0b2f73;color:#fff}.identifier{font-weight:700;white-space:nowrap;font-family:monospace}small{display:block;color:#5b6878;margin-top:4px}form{display:flex;gap:8px;min-width:240px}select,button{font:inherit;border:1px solid #bdc9d8;border-radius:6px;padding:8px}button{background:#0b2f73;color:white;border:0;font-weight:bold;cursor:pointer}.recovery{color:#9a3412}.empty{text-align:center;padding:30px}</style></head><body><div class="top"><div><h1>Manual Provider Dispatch</h1><p class="hint">Choose a supported provider for customer or Partner API ticket requests configured for manual processing.</p></div><a href="/admin">← Admin Dashboard</a></div>${flash ? `<p class="flash">${flash}</p>` : ''}<p class="notice">Dispatch sends a live request to the selected provider. Requests marked for recovery were accepted upstream or have an uncertain outcome; do not submit them again.</p><div style="overflow-x:auto"><table><thead><tr><th>Source</th><th>Service / reference</th><th>Account</th><th>Identifier</th><th>Submitted</th><th>Provider action</th></tr></thead><tbody>${table}</tbody></table></div></body></html>`);
  });

  router.post('/manual-provider-dispatch/:source/:id', async (req: Request, res) => {
    const admin = req.session?.adminUser as AdminSessionUser | undefined;
    if (!admin) return res.redirect('/admin/login');
    if (admin.role === 'SUPPORT') return res.status(403).send('Only Finance and Super Admin can dispatch provider requests.');
    const sourceValue = req.params.source;
    const source = Array.isArray(sourceValue) ? sourceValue[0] : sourceValue;
    const idValue = req.params.id;
    const id = Array.isArray(idValue) ? idValue[0] : idValue;
    const provider = field(req, 'provider') as ManualDispatchProvider;
    if (!['techhub', 'franceverified'].includes(provider)) return res.redirect('/admin/manual-provider-dispatch?flash=Choose+a+valid+provider.');
    try {
      const result = source === 'customer'
        ? await dispatchManualCustomerRequest(id, provider)
        : source === 'partner'
          ? await dispatchManualPartnerRequest(id, provider)
          : null;
      if (!result) return res.status(400).send('Invalid request source.');
      await logAdminAction({ adminId: admin.id, action: 'DISPATCH_MANUAL_PROVIDER_REQUEST', targetType: source === 'partner' ? 'PartnerTransaction' : 'Transaction', targetId: id, metadata: { service: result.service, provider, ticketId: result.ticketId } });
      return res.redirect(`/admin/manual-provider-dispatch?flash=${encodeURIComponent(`${result.service} sent to ${provider}. Ticket: ${result.ticketId}`)}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not dispatch this request.';
      return res.redirect(`/admin/manual-provider-dispatch?flash=${encodeURIComponent(message)}`);
    }
  });
}
