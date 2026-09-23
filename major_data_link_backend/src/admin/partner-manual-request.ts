import { readFile } from 'node:fs/promises';
import type { Request, Router } from 'express';
import { prisma } from '../lib/prisma.js';
import {
  isAdminManageablePartnerRequest,
  decryptPartnerManualPII,
  completePartnerManualRequest,
  declinePartnerManualRequest
} from '../services/partner-manual-admin.service.js';
import { resendPartnerTransactionWebhook } from '../services/partner-webhook.service.js';
import { logAdminAction } from './audit.js';
import type { AdminSessionUser } from './auth.js';

declare module 'express-session' {
  interface SessionData {
    adminUser?: AdminSessionUser;
  }
}

// Same req.fields/req.files shape as admin/jamb.ts and
// admin/user-deliveries.ts - express-formidable is already mounted ahead of
// every route on this router (see buildAuthenticatedRouter() in setup.ts),
// so this file must not add a second body parser of its own.
type Upload = { filepath?: string; path?: string; originalFilename?: string; name?: string; mimetype?: string; type?: string };
type PartnerManualTransaction = Awaited<ReturnType<typeof prisma.partnerTransaction.findUniqueOrThrow>>;
type WebhookDeliverySummary = {
  id: string;
  status: 'PENDING' | 'PROCESSING' | 'DELIVERED' | 'FAILED';
  attemptCount: number;
  deliveredAt: Date | null;
  lastAttemptAt: Date | null;
  lastResponseStatus: number | null;
  lastError: string | null;
};
function uploadedFile(req: Request, name = 'file') {
  const files = (req as unknown as { files?: Record<string, Upload | Upload[]> }).files;
  const value = files?.[name];
  return Array.isArray(value) ? value[0] : value;
}
function field(req: Request, name: string): string {
  const v = (req as unknown as { fields?: Record<string, string | string[] | undefined> }).fields?.[name];
  return typeof v === 'string' ? v : '';
}
function fields(req: Request) {
  return (req as unknown as { fields?: Record<string, string | string[] | undefined> }).fields ?? {};
}
function routeParam(req: Request, name: string) {
  const value = req.params[name];
  return typeof value === 'string' ? value : '';
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

function requestIdentifier(transaction: PartnerManualTransaction) {
  const pii = decryptPartnerManualPII(transaction);
  for (const key of ['tracking_id', 'trackingId', 'ticket_id', 'ticketId', 'nin', 'bvn', 'phone', 'registration_number']) {
    const value = pii?.[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '—';
}

function serviceLabel(transaction: PartnerManualTransaction) {
  const metadata = transaction.metadata as Record<string, unknown> | null;
  const service = metadata?.service;
  return typeof service === 'string' ? service.replace(/_/g, ' ') : transaction.type.replace(/_/g, ' ');
}

function renderBatchPage(params: { rows: Array<PartnerManualTransaction & { partner: { businessName: string; email: string } }>; flash?: string }) {
  const tableRows = params.rows.length
    ? params.rows.map((transaction) => {
        const id = transaction.id;
        return `<tr><td><strong>${escapeHtml(transaction.partner.businessName)}</strong><br><small>${escapeHtml(transaction.partner.email)}</small></td><td><strong>${escapeHtml(serviceLabel(transaction))}</strong><br><small>${escapeHtml(transaction.reference)}</small></td><td>${escapeHtml(requestIdentifier(transaction))}</td><td>${escapeHtml(transaction.createdAt.toLocaleString())}</td><td><select name="action_${id}"><option value="">No change</option><option value="complete">Complete request</option><option value="decline">Decline &amp; refund</option></select></td><td><textarea name="note_${id}" rows="2" placeholder="Completion note, or decline reason"></textarea></td><td><input type="file" name="file_${id}" accept="application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/png,image/jpeg"><small>Optional; used only when completing.</small></td></tr>`;
      }).join('')
    : '<tr><td colspan="7" class="empty">No pending partner requests in this queue.</td></tr>';
  return `<!doctype html><html><head><meta charset="utf-8"><title>Partner Request Queue</title><style>body{font:14px Arial,sans-serif;background:#f5f6f8;color:#18212f;margin:0;padding:28px}a{color:#0756b8;font-weight:600;text-decoration:none}.top{display:flex;justify-content:space-between;align-items:center;gap:16px}.flash{background:#e6f4ea;border:1px solid #8fd1a1;color:#155724;padding:12px 15px;border-radius:8px;margin:16px 0}form{overflow-x:auto}table{border-collapse:collapse;width:100%;min-width:1180px;background:#fff;box-shadow:0 1px 4px #0001}th,td{text-align:left;padding:12px;border-bottom:1px solid #e7edf4;vertical-align:top}th{background:#0b2f73;color:#fff}textarea,select,input[type=file]{box-sizing:border-box;width:100%;font:inherit;border:1px solid #bdc9d8;border-radius:6px;padding:8px;background:#fff}input[type=file]{font-size:12px}small{display:block;color:#5b6878;margin-top:4px}.empty{text-align:center;padding:32px}.submit{margin-top:16px;background:#0b2f73;color:#fff;border:0;border-radius:8px;padding:12px 20px;font-size:15px;font-weight:bold;cursor:pointer}.hint{color:#536273}</style></head><body><div class="top"><div><h1>Partner request queue</h1><p class="hint">Complete or decline many pending Partner API requests on one page. Only rows with a selected action will change.</p></div><a href="/admin">← Admin Dashboard</a></div><p><a href="/admin/manual-requests">← All manual requests</a> · <a href="/admin/partner-manual-requests/resend">Partner API activity &amp; webhook recovery</a></p>${params.flash ? `<p class="flash">${escapeHtml(params.flash)}</p>` : ''}<form method="post" action="/admin/partner-manual-requests/batch" enctype="multipart/form-data"><table><thead><tr><th>Partner</th><th>Request</th><th>Submitted ID</th><th>Submitted</th><th>Action</th><th>Message</th><th>Result file</th></tr></thead><tbody>${tableRows}</tbody></table>${params.rows.length ? '<button class="submit" type="submit">Apply selected changes</button>' : ''}</form></body></html>`;
}

function webhookDeliveryLabel(delivery: WebhookDeliverySummary | undefined, webhookUrl: string | null) {
  if (!webhookUrl) return '<strong>Not configured</strong>';
  if (!delivery) return '<strong>Not sent</strong><small>No delivery has been recorded yet.</small>';
  const response = delivery.lastResponseStatus === null ? '' : ` · HTTP ${delivery.lastResponseStatus}`;
  const attemptedAt = delivery.deliveredAt ?? delivery.lastAttemptAt;
  const when = attemptedAt ? `<small>${escapeHtml(attemptedAt.toLocaleString())} · ${delivery.attemptCount} attempt${delivery.attemptCount === 1 ? '' : 's'}${response}</small>` : '';
  if (delivery.status === 'DELIVERED') return `<strong>Delivered</strong>${when}`;
  const problem = delivery.lastError ? `<small>${escapeHtml(delivery.lastError)}</small>` : '';
  return `<strong>${escapeHtml(delivery.status === 'FAILED' ? 'Failed' : 'Awaiting delivery')}</strong>${when}${problem}`;
}

function renderResendPage(params: {
  rows: Array<PartnerManualTransaction & { partner: { businessName: string; email: string; webhookUrl: string | null } }>;
  deliveriesByReference: Map<string, WebhookDeliverySummary>;
  flash?: string;
}) {
  const actionFor = (transaction: PartnerManualTransaction & { partner: { webhookUrl: string | null } }) => {
    const delivery = params.deliveriesByReference.get(transaction.reference);
    if (!transaction.partner.webhookUrl) return '<button type="submit" disabled title="This partner has no webhook URL">Retry webhook</button>';
    if (delivery?.status === 'DELIVERED') return '<small>Latest update is already delivered.</small>';
    if (delivery && delivery.status !== 'FAILED') return '<small>Automatic retry is pending.</small>';
    const deliveryId = delivery ? `<input type="hidden" name="deliveryId" value="${escapeHtml(delivery.id)}">` : '';
    return `<form method="post" action="/admin/partner-manual-requests/${encodeURIComponent(transaction.id)}/resend-update">${deliveryId}<button type="submit">${delivery ? 'Retry webhook' : 'Send update'}</button></form>`;
  };
  const rows = params.rows.length
    ? params.rows.map((transaction) => `<tr><td><strong>${escapeHtml(transaction.partner.businessName)}</strong><br><small>${escapeHtml(transaction.partner.email)}</small></td><td><strong>${escapeHtml(serviceLabel(transaction))}</strong><br><small>${escapeHtml(transaction.reference)}</small></td><td>${escapeHtml(requestIdentifier(transaction))}</td><td>${escapeHtml(transaction.status)}</td><td>${escapeHtml(transaction.updatedAt.toLocaleString())}</td><td>${webhookDeliveryLabel(params.deliveriesByReference.get(transaction.reference), transaction.partner.webhookUrl)}</td><td>${actionFor(transaction)}</td></tr>`).join('')
    : '<tr><td colspan="7" class="empty">No resolved partner API requests found.</td></tr>';
  return `<!doctype html><html><head><meta charset="utf-8"><title>Partner API Activity & Webhook Recovery</title><style>body{font:14px Arial,sans-serif;background:#f5f6f8;color:#18212f;margin:0;padding:28px}a{color:#0756b8;font-weight:600;text-decoration:none}.top{display:flex;justify-content:space-between;align-items:center;gap:16px}.flash{background:#e6f4ea;border:1px solid #8fd1a1;color:#155724;padding:12px 15px;border-radius:8px;margin:16px 0}table{border-collapse:collapse;width:100%;background:#fff;box-shadow:0 1px 4px #0001}th,td{text-align:left;padding:12px;border-bottom:1px solid #e7edf4;vertical-align:top}th{background:#0b2f73;color:#fff}button{background:#0b2f73;color:#fff;border:0;border-radius:7px;padding:9px 12px;font-weight:bold;cursor:pointer}button:disabled{cursor:not-allowed;opacity:.5}.empty{text-align:center;padding:32px}.hint{color:#536273}</style></head><body><div class="top"><div><h1>Partner API activity &amp; webhook recovery</h1><p class="hint">Recent completed, declined and refunded Partner API services. The delivery column shows whether the partner endpoint received the latest update. Failed deliveries can be retried with the same event ID, so a partner that already received it can safely deduplicate it.</p></div><a href="/admin/partner-manual-requests">← Partner bulk queue</a></div>${params.flash ? `<p class="flash">${escapeHtml(params.flash)}</p>` : ''}<table><thead><tr><th>Partner</th><th>Request</th><th>Submitted ID</th><th>Status</th><th>Resolved</th><th>Webhook delivery</th><th>Action</th></tr></thead><tbody>${rows}</tbody></table></body></html>`;
}

function renderPage(params: {
  transactionId: string;
  reference: string;
  status: string;
  type: string;
  pii: Record<string, unknown> | null;
  flash?: string;
}) {
  const { transactionId, reference, status, type, pii, flash } = params;
  const isPending = status === 'PENDING';
  const rows = pii
    ? Object.entries(pii)
        .filter(([key]) => !key.startsWith('pdf_') && !key.startsWith('submission_pdf') && key !== 'delivered_file_base64')
        .map(([key, value]) => `<dt>${escapeHtml(key.replace(/_/g, ' '))}</dt><dd>${escapeHtml(String(value ?? '\u2014'))}</dd>`)
        .join('')
    : '<dt>No data</dt><dd>\u2014</dd>';

  return `<!doctype html><html><head><meta charset="utf-8"><title>Partner Request ${escapeHtml(reference)}</title>
<style>
  body{font:14px Arial,sans-serif;background:#f6f3ea;color:#201708;max-width:680px;margin:32px auto;padding:0 16px}
  a{color:#8a6712}
  section{background:#fff;border:1px solid #d4af37;border-radius:14px;padding:22px;margin:16px 0}
  dl{display:grid;grid-template-columns:220px 1fr;gap:8px 14px;margin:0}
  dt{font-weight:600;color:#6c5a2a;text-transform:capitalize}
  dd{margin:0;word-break:break-word}
  input[type=file],textarea{display:block;margin:10px 0;width:100%;font-family:inherit}
  textarea{padding:8px;border-radius:8px;border:1px solid #d4af37}
  button{background:#171106;color:#ffe9a3;border:0;border-radius:8px;padding:11px 18px;font-weight:bold;cursor:pointer;font-size:1rem;margin-right:10px}
  button.decline{background:#7a1f1f;color:#ffe0e0}
  .badge{display:inline-block;padding:3px 12px;border-radius:12px;font-size:.8rem;font-weight:700}
  .pending{background:#fff3cd;color:#856404}
  .success{background:#d4edda;color:#155724}
  .failed{background:#f8d7da;color:#721c24}
  .flash{background:#fdecea;color:#a12622;border-radius:8px;padding:10px 14px;margin-bottom:16px}
  .hint{color:#6c5a2a;font-size:.9rem}
</style></head><body>
  <p><a href="/admin/resources/PartnerTransaction/records/${transactionId}/show">&larr; Back to transaction</a></p>
  <h1 style="margin-bottom:4px">${escapeHtml(type.replace(/_/g, ' '))}</h1>
  <p class="hint">${escapeHtml(reference)}</p>
  ${flash ? `<p class="flash">${escapeHtml(flash)}</p>` : ''}
  <section>
    <p><span class="badge ${isPending ? 'pending' : status === 'SUCCESS' ? 'success' : 'failed'}">${escapeHtml(status)}</span></p>
    <dl>${rows}</dl>
  </section>
  ${
    isPending
      ? `<section>
          <h2 style="margin-top:0">Mark complete</h2>
          <p class="hint">Attach a final document only if this service actually produces one to hand back (a certificate, a gazette clipping, a JAMB printout). Leave it blank for requests that are just processed externally with nothing to deliver.</p>
          <form method="post" action="?action=complete" enctype="multipart/form-data">
            <input type="file" name="file" accept="application/pdf,image/png,image/jpeg">
            <textarea name="note" rows="2" placeholder="Optional note for the partner"></textarea>
            <button type="submit">Mark complete &amp; notify partner</button>
          </form>
        </section>
        <section>
          <h2 style="margin-top:0">Decline</h2>
          <form method="post" action="?action=decline">
            <textarea name="reason" required minlength="4" rows="2" placeholder="Reason - required"></textarea>
            <button type="submit" class="decline">Decline &amp; refund wallet</button>
          </form>
        </section>`
      : `<p class="hint">This request is already ${escapeHtml(status)} - nothing more to do here.</p>`
  }
</body></html>`;
}

export function registerPartnerManualRequestRoutes(router: Router) {
  router.get('/partner-manual-requests', async (req: Request, res) => {
    const admin = req.session?.adminUser;
    if (!admin) return res.redirect('/admin/login');

    const rows = await prisma.partnerTransaction.findMany({
      where: { status: 'PENDING' },
      include: { partner: { select: { businessName: true, email: true } } },
      orderBy: { createdAt: 'asc' }
    });
    res.type('html').send(renderBatchPage({
      rows: rows.filter(isAdminManageablePartnerRequest),
      flash: typeof req.query.flash === 'string' ? req.query.flash : undefined
    }));
  });

  router.get('/partner-manual-requests/resend', async (req: Request, res) => {
    const admin = req.session?.adminUser;
    if (!admin) return res.redirect('/admin/login');
    const rows = await prisma.partnerTransaction.findMany({
      where: { status: { not: 'PENDING' } },
      include: { partner: { select: { businessName: true, email: true, webhookUrl: true } } },
      orderBy: { updatedAt: 'desc' },
      take: 250
    });
    // A delivery stores a signed immutable payload rather than a foreign key
    // to the transaction. Its reference is therefore the stable, safe join
    // key for both old records and newly retried events.
    const relevantReferences = new Set(rows.map((row) => row.reference));
    const relevantPartnerIds = [...new Set(rows.map((row) => row.partnerId))];
    const deliveries = await prisma.partnerWebhookDelivery.findMany({
      where: { event: 'transaction.updated', partnerId: { in: relevantPartnerIds } },
      select: { id: true, payload: true, status: true, attemptCount: true, deliveredAt: true, lastAttemptAt: true, lastResponseStatus: true, lastError: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      take: 2_000
    });
    const deliveriesByReference = new Map<string, WebhookDeliverySummary>();
    for (const delivery of deliveries) {
      const data = (delivery.payload as { data?: { reference?: unknown } } | null)?.data;
      const reference = typeof data?.reference === 'string' ? data.reference : null;
      if (!reference || !relevantReferences.has(reference) || deliveriesByReference.has(reference)) continue;
      deliveriesByReference.set(reference, delivery);
    }
    res.type('html').send(renderResendPage({
      rows,
      deliveriesByReference,
      flash: typeof req.query.flash === 'string' ? req.query.flash : undefined
    }));
  });

  router.post('/partner-manual-requests/:transactionId/resend-update', async (req: Request, res) => {
    const admin = req.session?.adminUser;
    if (!admin) return res.redirect('/admin/login');
    if (admin.role === 'SUPPORT') return res.status(403).type('html').send('<p>Finance or Super Admin access required to resend partner updates.</p>');
    const transactionId = routeParam(req, 'transactionId');
    try {
      const transaction = await prisma.partnerTransaction.findUnique({ where: { id: transactionId } });
      if (!transaction || transaction.status === 'PENDING') throw new Error('Only a resolved partner request can be resent.');
      const delivery = await resendPartnerTransactionWebhook(transaction, field(req, 'deliveryId').trim() || undefined);
      if (!delivery) throw new Error('This partner has no configured webhook URL. Configure it before resending an update.');
      await logAdminAction({ adminId: admin.id, action: 'RESEND_PARTNER_TRANSACTION_WEBHOOK', targetType: 'PartnerTransaction', targetId: transaction.id, metadata: { eventId: delivery?.eventId ?? null } });
      const result = delivery?.status === 'DELIVERED' ? 'Update delivered to partner.' : `Update queued for retry${delivery?.lastError ? `: ${delivery.lastError}` : '.'}`;
      res.redirect(`/admin/partner-manual-requests/resend?flash=${encodeURIComponent(result)}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not resend the partner update.';
      res.redirect(`/admin/partner-manual-requests/resend?flash=${encodeURIComponent(message)}`);
    }
  });

  router.post('/partner-manual-requests/batch', async (req: Request, res) => {
    const admin = req.session?.adminUser;
    if (!admin) return res.redirect('/admin/login');
    if (admin.role === 'SUPPORT') return res.status(403).type('html').send('<p>Finance or Super Admin access required to act on partner requests.</p>');

    const actions = Object.entries(fields(req))
      .filter(([name, value]) => name.startsWith('action_') && (value === 'complete' || value === 'decline')) as Array<[string, 'complete' | 'decline']>;
    let completed = 0;
    let declined = 0;
    let failures = 0;

    for (const [name, action] of actions) {
      const transactionId = name.slice('action_'.length);
      try {
        const transaction = await prisma.partnerTransaction.findUnique({ where: { id: transactionId } });
        if (!transaction || transaction.status !== 'PENDING' || !isAdminManageablePartnerRequest(transaction)) throw new Error('Unavailable');

        const note = field(req, `note_${transactionId}`).trim();
        if (action === 'decline') {
          if (!note) throw new Error('A decline reason is required');
          await declinePartnerManualRequest({ transactionId, reason: note });
          await logAdminAction({ adminId: admin.id, action: 'DECLINE_PARTNER_MANUAL_REQUEST', targetType: 'PartnerTransaction', targetId: transactionId, metadata: { reason: note, batch: true } });
          declined += 1;
          continue;
        }

        const file = uploadedFile(req, `file_${transactionId}`);
        const filePath = file?.filepath ?? file?.path;
        let fileBase64: string | undefined;
        let fileName: string | undefined;
        let fileMime: string | undefined;
        if (filePath) {
          const bytes = await readFile(filePath);
          fileBase64 = bytes.toString('base64');
          fileName = file?.originalFilename ?? file?.name ?? 'document';
          fileMime = file?.mimetype ?? file?.type ?? 'application/octet-stream';
        }
        await completePartnerManualRequest({ transactionId, fileBase64, fileName, fileMime, note: note || undefined });
        await logAdminAction({ adminId: admin.id, action: 'COMPLETE_PARTNER_MANUAL_REQUEST', targetType: 'PartnerTransaction', targetId: transactionId, metadata: { fileName: fileName ?? null, batch: true } });
        completed += 1;
      } catch {
        failures += 1;
      }
    }

    const summary = actions.length
      ? `${completed} request(s) completed; ${declined} request(s) declined.${failures ? ` ${failures} row(s) could not be processed.` : ''}`
      : 'Choose at least one action before applying changes.';
    res.redirect(`/admin/partner-manual-requests?flash=${encodeURIComponent(summary)}`);
  });

  router.get('/partner-manual-request/:transactionId', async (req: Request, res) => {
    const admin = req.session?.adminUser;
    if (!admin) return res.redirect('/admin/login');

    // Existing AdminJS/manual-request bookmarks used this singular URL.
    // Keep them working, but always open the bulk workflow.
    return res.redirect('/admin/partner-manual-requests');
  });

  router.post('/partner-manual-request/:transactionId', async (req: Request, res) => {
    const admin = req.session?.adminUser;
    if (!admin) return res.redirect('/admin/login');
    if (admin.role === 'SUPPORT') {
      return res.status(403).type('html').send('<p>Finance or Super Admin access required to act on partner requests.</p>');
    }

    const transactionId = Array.isArray(req.params.transactionId) ? req.params.transactionId[0] : req.params.transactionId;
    const action = req.query.action === 'decline' ? 'decline' : 'complete';
    const redirectBack = (flash: string) => res.redirect(`/admin/partner-manual-request/${transactionId}?flash=${encodeURIComponent(flash)}`);

    try {
      if (action === 'decline') {
        const reason = field(req, 'reason').trim();
        if (!reason) return redirectBack('A reason is required to decline.');
        await declinePartnerManualRequest({ transactionId, reason });
        await logAdminAction({ adminId: admin.id, action: 'DECLINE_PARTNER_MANUAL_REQUEST', targetType: 'PartnerTransaction', targetId: transactionId, metadata: { reason } });
        return res.redirect(`/admin/resources/PartnerTransaction/records/${transactionId}/show`);
      }

      const file = uploadedFile(req);
      const filePath = file?.filepath ?? file?.path;
      const note = field(req, 'note').trim();

      let fileBase64: string | undefined;
      let fileName: string | undefined;
      let fileMime: string | undefined;
      if (filePath) {
        const bytes = await readFile(filePath);
        fileBase64 = bytes.toString('base64');
        fileName = file?.originalFilename ?? file?.name ?? 'document';
        fileMime = file?.mimetype ?? file?.type ?? 'application/octet-stream';
      }

      await completePartnerManualRequest({ transactionId, fileBase64, fileName, fileMime, note: note || undefined });
      await logAdminAction({ adminId: admin.id, action: 'COMPLETE_PARTNER_MANUAL_REQUEST', targetType: 'PartnerTransaction', targetId: transactionId, metadata: { fileName: fileName ?? null } });
      return res.redirect(`/admin/resources/PartnerTransaction/records/${transactionId}/show`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not complete this action.';
      return redirectBack(message);
    }
  });
}
