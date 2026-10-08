import type { Request, Router } from 'express';
import { TransactionStatus, TransactionType } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { openPII } from '../lib/pii.js';
import { dispatchManualCustomerRequest, dispatchManualPartnerRequest, manualDispatchProviderConfigured, manualDispatchProviders } from '../services/manual-provider-dispatch.service.js';
import type { ManualDispatchProvider } from '../services/manual-provider-dispatch.service.js';
import { logAdminAction } from './audit.js';
import type { AdminSessionUser } from './auth.js';
import { checkIpeClearanceStatus } from '../services/verification.service.js';
import { partnerVerification } from '../services/partner-verification.service.js';
import { createPartnerRequestUpdate } from '../services/partner-request-update.service.js';
import { recoverRefundedFranceVerification } from '../services/partner-verification-recovery.service.js';
import { koboToNaira } from '../lib/money.js';
import { resendPartnerTransactionWebhook } from '../services/partner-webhook.service.js';

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
    const recentWhere = { type: TransactionType.IDENTITY_SERVICE_REQUEST, provider: { in: ['techhub', 'franceverified'] }, createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } };
    const [customers, partners, recentCustomers, recentPartners] = await Promise.all([
      prisma.transaction.findMany({ where, include: { user: { select: { fullName: true, email: true } } }, orderBy: { createdAt: 'desc' }, take: 50 }),
      prisma.partnerTransaction.findMany({ where, include: { partner: { select: { businessName: true, email: true } } }, orderBy: { createdAt: 'desc' }, take: 50 }),
      prisma.transaction.findMany({ where: recentWhere, include: { user: { select: { fullName: true, email: true } } }, orderBy: { createdAt: 'desc' }, take: 50 }),
      prisma.partnerTransaction.findMany({ where: recentWhere, include: { partner: { select: { businessName: true, email: true } }, requestUpdates: { orderBy: { createdAt: 'desc' }, take: 3 } }, orderBy: { createdAt: 'desc' }, take: 50 })
    ]);
    const rows = [
      ...customers.map((row) => ({ ...row, source: 'Customer', owner: row.user.fullName, email: row.user.email, kind: 'customer' as const })),
      ...partners.map((row) => ({ ...row, source: 'Partner API', owner: row.partner.businessName, email: row.partner.email, kind: 'partner' as const })),
      ...recentCustomers.map((row) => ({ ...row, source: 'Customer', owner: row.user.fullName, email: row.user.email, kind: 'customer' as const })),
      ...recentPartners.map((row) => ({ ...row, source: 'Partner API', owner: row.partner.businessName, email: row.partner.email, kind: 'partner' as const }))
    ].filter((row, index, all) => providersFor(serviceName(row.metadata)).length > 0 && all.findIndex((candidate) => candidate.id === row.id && candidate.kind === row.kind) === index).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    const flash = typeof req.query.flash === 'string' ? escapeHtml(req.query.flash) : '';
    const table = rows.length ? rows.map((row) => {
      const metadata = (row.metadata as Record<string, unknown> | null) ?? {};
      const service = serviceName(metadata);
      const dispatch = metadata.manual_dispatch as Record<string, unknown> | undefined;
      const inRecovery = row.provider === 'manual_dispatching';
      const dispatched = row.provider === 'techhub' || row.provider === 'franceverified';
      const pending = row.status === TransactionStatus.PENDING;
      const canRecover = row.kind === 'partner' && row.provider === 'franceverified' && row.status === TransactionStatus.REVERSED && (service.startsWith('NIN_VALIDATION_') || service === 'IPE_CLEARANCE');
      const dispatchError = typeof dispatch?.error === 'string' ? `<small class="recovery">Last dispatch failed: ${escapeHtml(dispatch.error)}</small>` : '';
      const lastUpdate = row.kind === 'partner' && 'requestUpdates' in row && Array.isArray(row.requestUpdates) && row.requestUpdates[0]
        ? `<small>Latest partner update: ${escapeHtml(row.requestUpdates[0].message)}</small>` : '';
      const providerChoices = providersFor(service).map(({ provider, enabled }) => `<option value="${provider}" ${enabled ? '' : 'disabled'}>${provider === 'techhub' ? 'Techhub' : 'FranceVerified'}${enabled ? '' : ' (not configured)'}</option>`).join('');
      const form = dispatched
        ? `<strong>${escapeHtml(row.provider === 'franceverified' ? 'FranceVerified' : 'Techhub')} · ${escapeHtml(row.status.toLowerCase())}</strong><small>Ticket: ${escapeHtml(row.providerRef ?? String(metadata.ticket_id ?? '—'))}</small>${lastUpdate}${canRecover ? `<form method="post" action="/admin/manual-provider-dispatch/recover/${encodeURIComponent(row.id)}" onsubmit="return confirm('This will debit ₦${koboToNaira(row.amountKobo).toLocaleString('en-NG')} again and resume polling the existing FranceVerified ticket. Continue?')"><button type="submit">Restore request · debit ₦${koboToNaira(row.amountKobo).toLocaleString('en-NG')}</button></form>` : ''}${pending && service === 'IPE_CLEARANCE' ? `<form method="post" action="/admin/manual-provider-dispatch/status/${row.kind}/${encodeURIComponent(row.id)}"><button type="submit">Check status</button></form>` : ''}${row.kind === 'partner' && pending ? `<form method="post" action="/admin/manual-provider-dispatch/update/${encodeURIComponent(row.id)}"><input name="message" required maxlength="1000" placeholder="Progress update for API partner"><button type="submit">Send update</button></form>` : ''}${row.kind === 'partner' && row.status === TransactionStatus.SUCCESS ? `<form method="post" action="/admin/manual-provider-dispatch/resend-completion/${encodeURIComponent(row.id)}"><button type="submit">Resend completion to partner</button></form>` : ''}${row.kind === 'partner' && !pending ? `<form method="post" action="/admin/manual-provider-dispatch/update/${encodeURIComponent(row.id)}"><input name="message" required maxlength="1000" placeholder="Completion/update note for API partner"><button type="submit">Send update</button></form>` : ''}`
        : inRecovery
        ? `<strong class="recovery">Provider may have accepted this request. Reconcile it manually; do not resubmit.</strong><small>State: ${escapeHtml(String(dispatch?.status ?? 'unknown'))}</small>${typeof dispatch?.error === 'string' ? `<small>${escapeHtml(dispatch.error)}</small>` : ''}`
        : `<form method="post" action="/admin/manual-provider-dispatch/${row.kind}/${encodeURIComponent(row.id)}"><select name="provider" required><option value="">Choose provider</option>${providerChoices}</select><button type="submit">Send request</button></form>${dispatchError}`;
      const pii = openPII<Record<string, unknown>>(metadata.pii);
      const ipe = typeof metadata.ipe_type === 'string' ? `<small>IPE type: ${escapeHtml(metadata.ipe_type.replace(/_/g, ' '))}</small>` : '';
      return `<tr><td>${escapeHtml(row.source)}</td><td><strong>${escapeHtml(service.replace(/_/g, ' '))}</strong>${ipe}<small>${escapeHtml(row.reference)}</small></td><td>${escapeHtml(row.owner)}<small>${escapeHtml(row.email)}</small></td><td class="identifier">${escapeHtml(displayIdentifier(pii))}</td><td>${escapeHtml(row.createdAt.toLocaleString())}</td><td>${form}</td></tr>`;
    }).join('') : '<tr><td colspan="6" class="empty">No eligible ticket requests are waiting for provider dispatch.</td></tr>';
    return res.type('html').send(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Manual Provider Dispatch</title><style>body{font:14px Arial,sans-serif;background:#f5f6f8;color:#18212f;margin:0;padding:28px}a{color:#0756b8;font-weight:600;text-decoration:none}.top{display:flex;justify-content:space-between;align-items:center;gap:16px}.hint{color:#536273}.flash{background:#e6f4ea;color:#155724;padding:12px;border-radius:8px}.notice{background:#fff8df;border:1px solid #e7d28a;padding:12px;border-radius:8px}table{border-collapse:collapse;width:100%;min-width:1000px;background:#fff;box-shadow:0 1px 4px #0001}th,td{text-align:left;padding:12px;border-bottom:1px solid #e7edf4;vertical-align:top}th{background:#0b2f73;color:#fff}.identifier{font-weight:700;white-space:nowrap;font-family:monospace}small{display:block;color:#5b6878;margin-top:4px}form{display:flex;gap:8px;min-width:240px}select,button{font:inherit;border:1px solid #bdc9d8;border-radius:6px;padding:8px}button{background:#0b2f73;color:white;border:0;font-weight:bold;cursor:pointer}.recovery{color:#9a3412}.empty{text-align:center;padding:30px}</style></head><body><div class="top"><div><h1>Manual Provider Dispatch</h1><p class="hint">Choose a supported provider for customer or Partner API ticket requests configured for manual processing.</p></div><a href="/admin">← Admin Dashboard</a></div>${flash ? `<p class="flash">${flash}</p>` : ''}<p class="notice">Dispatch sends a live request to the selected provider. Requests marked for recovery were accepted upstream or have an uncertain outcome; do not submit them again.</p><div style="overflow-x:auto"><table><thead><tr><th>Source</th><th>Service / reference</th><th>Account</th><th>Identifier</th><th>Submitted</th><th>Provider action</th></tr></thead><tbody>${table}</tbody></table></div></body></html>`);
  });

  router.post('/manual-provider-dispatch/:source(customer|partner)/:id', async (req: Request, res) => {
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

  router.post('/manual-provider-dispatch/status/:source/:id', async (req: Request, res) => {
    const admin = req.session?.adminUser as AdminSessionUser | undefined;
    if (!admin) return res.redirect('/admin/login');
    if (admin.role === 'SUPPORT') return res.status(403).send('Only Finance and Super Admin can check provider status.');
    const source = String(req.params.source); const id = String(req.params.id);
    try {
      if (source === 'partner') {
        const tx = await prisma.partnerTransaction.findUnique({ where: { id } });
        if (!tx || tx.status !== TransactionStatus.PENDING || !['techhub', 'franceverified'].includes(tx.provider ?? '') || serviceName(tx.metadata) !== 'IPE_CLEARANCE') throw new Error('Request is not an active IPE provider ticket.');
        const result = await partnerVerification.checkIpeClearance(tx.partnerId, tx.providerRef ?? '');
        await logAdminAction({ adminId: admin.id, action: 'CHECK_MANUAL_PROVIDER_STATUS', targetType: 'PartnerTransaction', targetId: id, metadata: { provider: tx.provider, status: result.status } });
        return res.redirect(`/admin/manual-provider-dispatch?flash=${encodeURIComponent(`Provider status for ${tx.reference}: ${result.status}`)}`);
      }
      if (source === 'customer') {
        const tx = await prisma.transaction.findUnique({ where: { id } });
        if (!tx || tx.status !== TransactionStatus.PENDING || !['techhub', 'franceverified'].includes(tx.provider ?? '') || serviceName(tx.metadata) !== 'IPE_CLEARANCE') throw new Error('Request is not an active IPE provider ticket.');
        const result = await checkIpeClearanceStatus({ userId: tx.userId, ticketId: tx.providerRef ?? '' });
        await logAdminAction({ adminId: admin.id, action: 'CHECK_MANUAL_PROVIDER_STATUS', targetType: 'Transaction', targetId: id, metadata: { provider: tx.provider, status: result.status } });
        return res.redirect(`/admin/manual-provider-dispatch?flash=${encodeURIComponent(`Provider status for ${tx.reference}: ${result.status}`)}`);
      }
      return res.status(400).send('Invalid request source.');
    } catch (error) {
      return res.redirect(`/admin/manual-provider-dispatch?flash=${encodeURIComponent(error instanceof Error ? error.message : 'Could not check provider status.')}`);
    }
  });

  router.post('/manual-provider-dispatch/update/:id', async (req: Request, res) => {
    const admin = req.session?.adminUser as AdminSessionUser | undefined;
    if (!admin) return res.redirect('/admin/login');
    if (admin.role === 'SUPPORT') return res.status(403).send('Only Finance and Super Admin can send partner updates.');
    const id = String(req.params.id); const message = field(req, 'message');
    try {
      const tx = await prisma.partnerTransaction.findUnique({ where: { id } });
      if (!tx || !['techhub', 'franceverified'].includes(tx.provider ?? '')) throw new Error('Only a provider request can receive an update.');
      await createPartnerRequestUpdate({ transactionId: id, message });
      await logAdminAction({ adminId: admin.id, action: 'SEND_MANUAL_PROVIDER_PARTNER_UPDATE', targetType: 'PartnerTransaction', targetId: id, metadata: { provider: tx.provider, message } });
      return res.redirect(`/admin/manual-provider-dispatch?flash=${encodeURIComponent(`Update sent to partner for ${tx.reference}.`)}`);
    } catch (error) {
      return res.redirect(`/admin/manual-provider-dispatch?flash=${encodeURIComponent(error instanceof Error ? error.message : 'Could not send partner update.')}`);
    }
  });

  router.post('/manual-provider-dispatch/resend-completion/:id', async (req: Request, res) => {
    const admin = req.session?.adminUser as AdminSessionUser | undefined;
    if (!admin) return res.redirect('/admin/login');
    if (admin.role === 'SUPPORT') return res.status(403).send('Only Finance and Super Admin can resend partner completion events.');
    const id = String(req.params.id);
    try {
      const tx = await prisma.partnerTransaction.findUnique({ where: { id } });
      if (!tx || tx.status !== TransactionStatus.SUCCESS || !['techhub', 'franceverified'].includes(tx.provider ?? '')) throw new Error('Only a completed provider request can resend its completion event.');
      const delivery = await resendPartnerTransactionWebhook(tx);
      if (!delivery) throw new Error('The partner has not configured a webhook URL and secret yet.');
      await logAdminAction({ adminId: admin.id, action: 'RESEND_PROVIDER_COMPLETION_TO_PARTNER', targetType: 'PartnerTransaction', targetId: id, metadata: { provider: tx.provider, deliveryStatus: delivery?.status ?? null } });
      return res.redirect(`/admin/manual-provider-dispatch?flash=${encodeURIComponent(`Completion event resent to partner for ${tx.reference}.`)}`);
    } catch (error) {
      return res.redirect(`/admin/manual-provider-dispatch?flash=${encodeURIComponent(error instanceof Error ? error.message : 'Could not resend partner completion.')}`);
    }
  });

  router.post('/manual-provider-dispatch/recover/:id', async (req: Request, res) => {
    const admin = req.session?.adminUser as AdminSessionUser | undefined;
    if (!admin) return res.redirect('/admin/login');
    if (admin.role === 'SUPPORT') return res.status(403).send('Only Finance and Super Admin can restore a refunded request.');
    const id = String(req.params.id);
    try {
      const result = await recoverRefundedFranceVerification(id);
      if (!result.alreadyRecovered) {
        await logAdminAction({ adminId: admin.id, action: 'RECOVER_REFUNDED_FRANCE_VERIFICATION', targetType: 'PartnerTransaction', targetId: id, metadata: { recoveredTransactionId: result.transaction.id, ticketId: result.transaction.providerRef } });
        await createPartnerRequestUpdate({ transactionId: result.transaction.id, message: `Request restored after an erroneous refund. FranceVerified ticket ${result.transaction.providerRef} is still being checked.` }).catch((error) => console.error('[manual-provider-dispatch] recovered request but could not notify partner', error));
      }
      return res.redirect(`/admin/manual-provider-dispatch?flash=${encodeURIComponent(`FranceVerified ticket ${result.transaction.providerRef} restored as pending. Partner wallet debited for this request.`)}`);
    } catch (error) {
      return res.redirect(`/admin/manual-provider-dispatch?flash=${encodeURIComponent(error instanceof Error ? error.message : 'Could not restore this request.')}`);
    }
  });
}
