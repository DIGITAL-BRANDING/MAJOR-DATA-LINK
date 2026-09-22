import { readFile } from 'node:fs/promises';
import type { Request, Router } from 'express';
import { prisma } from '../lib/prisma.js';
import {
  isAdminManageablePartnerRequest,
  decryptPartnerManualPII,
  completePartnerManualRequest,
  declinePartnerManualRequest
} from '../services/partner-manual-admin.service.js';
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
function uploadedFile(req: Request) {
  const files = (req as unknown as { files?: Record<string, Upload | Upload[]> }).files;
  const value = files?.file;
  return Array.isArray(value) ? value[0] : value;
}
function field(req: Request, name: string): string {
  const v = (req as unknown as { fields?: Record<string, string | string[] | undefined> }).fields?.[name];
  return typeof v === 'string' ? v : '';
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
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
  router.get('/partner-manual-request/:transactionId', async (req: Request, res) => {
    const admin = req.session?.adminUser;
    if (!admin) return res.redirect('/admin/login');

    const transactionId = Array.isArray(req.params.transactionId) ? req.params.transactionId[0] : req.params.transactionId;
    const transaction = await prisma.partnerTransaction.findUnique({ where: { id: transactionId } });
    if (!transaction || !isAdminManageablePartnerRequest(transaction)) {
      return res.status(404).type('html').send('<p>Request not found.</p>');
    }

    res.type('html').send(
      renderPage({
        transactionId: transaction.id,
        reference: transaction.reference,
        status: transaction.status,
        type: transaction.type,
        pii: decryptPartnerManualPII(transaction),
        flash: typeof req.query.flash === 'string' ? req.query.flash : undefined
      })
    );
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
