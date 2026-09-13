import { readFile } from 'node:fs/promises';
import type { Request, Router } from 'express';
import { TransactionStatus, TransactionType } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { openPII } from '../lib/pii.js';
import { JAMB_SERVICES } from '../routes/jamb.routes.js';
import { createUserDelivery } from '../services/user-delivery.service.js';
import { notifyUser } from '../services/notification.service.js';
import { logAdminAction } from './audit.js';
import type { AdminSessionUser } from './auth.js';

declare module 'express-session' {
  interface SessionData {
    adminUser?: AdminSessionUser;
  }
}

// Same req.files shape as admin/user-deliveries.ts - this router already has
// express-formidable mounted ahead of every route on it (see
// buildAuthenticatedRouter() in setup.ts), so this file must not add a
// second body parser of its own.
type Upload = { filepath?: string; path?: string; originalFilename?: string; name?: string; mimetype?: string; type?: string };
function uploadedFile(req: Request) {
  const files = (req as unknown as { files?: Record<string, Upload | Upload[]> }).files;
  const value = files?.file;
  return Array.isArray(value) ? value[0] : value;
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

type JambPII = { registration_number?: string; candidate_full_name?: string; exam_year?: number | string };

function renderPage(params: { transactionId: string; reference: string; status: string; serviceLabel: string; pii: JambPII | null; flash?: string }) {
  const { transactionId, reference, status, serviceLabel, pii, flash } = params;
  const isPending = status === 'PENDING';
  return `<!doctype html><html><head><meta charset="utf-8"><title>Fulfil JAMB Request ${escapeHtml(reference)}</title>
<style>
  body{font:14px Arial,sans-serif;background:#f6f3ea;color:#201708;max-width:640px;margin:32px auto;padding:0 16px}
  a{color:#8a6712}
  section{background:#fff;border:1px solid #d4af37;border-radius:14px;padding:22px;margin:16px 0}
  dl{display:grid;grid-template-columns:200px 1fr;gap:8px 12px;margin:0}
  dt{font-weight:600;color:#6c5a2a}
  dd{margin:0}
  input[type=file]{display:block;margin:12px 0}
  button{background:#171106;color:#ffe9a3;border:0;border-radius:8px;padding:11px 18px;font-weight:bold;cursor:pointer;font-size:1rem}
  .badge{display:inline-block;padding:3px 12px;border-radius:12px;font-size:.8rem;font-weight:700}
  .pending{background:#fff3cd;color:#856404}
  .success{background:#d4edda;color:#155724}
  .flash{background:#fdecea;color:#a12622;border-radius:8px;padding:10px 14px;margin-bottom:16px}
  .hint{color:#6c5a2a;font-size:.9rem}
</style></head><body>
  <p><a href="/admin/resources/Transaction/records/${transactionId}/show">&larr; Back to transaction</a></p>
  <h1 style="margin-bottom:4px">JAMB Request</h1>
  <p class="hint">${escapeHtml(reference)}</p>
  ${flash ? `<p class="flash">${escapeHtml(flash)}</p>` : ''}
  <section>
    <p><span class="badge ${isPending ? 'pending' : 'success'}">${escapeHtml(status)}</span></p>
    <dl>
      <dt>Service</dt><dd>${escapeHtml(serviceLabel)}</dd>
      <dt>JAMB Registration Number</dt><dd>${escapeHtml(String(pii?.registration_number ?? '\u2014'))}</dd>
      <dt>Candidate Full Name</dt><dd>${escapeHtml(String(pii?.candidate_full_name ?? '\u2014'))}</dd>
      <dt>Exam Year</dt><dd>${escapeHtml(String(pii?.exam_year ?? '\u2014'))}</dd>
    </dl>
  </section>
  ${
    isPending
      ? `<section>
          <h2 style="margin-top:0">Upload the document</h2>
          <p class="hint">PDF, PNG, or JPEG only, max 10MB. This is sent straight to the customer's Deliveries inbox and the request is marked complete.</p>
          <form method="post" enctype="multipart/form-data">
            <input type="file" name="file" accept="application/pdf,image/png,image/jpeg" required>
            <button type="submit">Deliver &amp; mark complete</button>
          </form>
        </section>`
      : `<p class="hint">This request is already ${escapeHtml(status)} - the document has been sent to the customer's Deliveries inbox.</p>`
  }
</body></html>`;
}

export function registerJambRoutes(router: Router) {
  router.get('/jamb/:transactionId/fulfil', async (req: Request, res) => {
    const admin = req.session?.adminUser;
    if (!admin) return res.redirect('/admin/login');
    if (admin.role === 'SUPPORT') {
      return res.status(403).type('html').send('<p>Finance or Super Admin access required to fulfil JAMB requests.</p>');
    }

    const transactionId = Array.isArray(req.params.transactionId) ? req.params.transactionId[0] : req.params.transactionId;
    const transaction = await prisma.transaction.findUnique({ where: { id: transactionId } });
    if (!transaction || transaction.type !== TransactionType.JAMB_SERVICE_REQUEST) {
      return res.status(404).type('html').send('<p>JAMB request not found.</p>');
    }

    const metadata = transaction.metadata as Record<string, unknown> | null;
    const jambService = typeof metadata?.jamb_service === 'string' ? (metadata.jamb_service as keyof typeof JAMB_SERVICES) : undefined;
    const serviceLabel = jambService ? JAMB_SERVICES[jambService]?.label ?? jambService : 'Unknown JAMB service';
    const pii = openPII<JambPII>(metadata?.pii);

    res.type('html').send(
      renderPage({
        transactionId: transaction.id,
        reference: transaction.reference,
        status: transaction.status,
        serviceLabel,
        pii,
        flash: typeof req.query.flash === 'string' ? req.query.flash : undefined
      })
    );
  });

  router.post('/jamb/:transactionId/fulfil', async (req: Request, res) => {
    const admin = req.session?.adminUser;
    if (!admin) return res.redirect('/admin/login');
    if (admin.role === 'SUPPORT') {
      return res.status(403).type('html').send('<p>Finance or Super Admin access required to fulfil JAMB requests.</p>');
    }

    const transactionId = Array.isArray(req.params.transactionId) ? req.params.transactionId[0] : req.params.transactionId;
    const redirectBack = (flash: string) => res.redirect(`/admin/jamb/${transactionId}/fulfil?flash=${encodeURIComponent(flash)}`);

    const transaction = await prisma.transaction.findUnique({ where: { id: transactionId } });
    if (!transaction || transaction.type !== TransactionType.JAMB_SERVICE_REQUEST) {
      return res.status(404).type('html').send('<p>JAMB request not found.</p>');
    }
    if (transaction.status !== TransactionStatus.PENDING) {
      return redirectBack('This request is no longer pending.');
    }

    const file = uploadedFile(req);
    const filePath = file?.filepath ?? file?.path;
    if (!filePath) {
      return redirectBack('No file was uploaded. Please choose a file and try again.');
    }

    const metadata = transaction.metadata as Record<string, unknown> | null;
    const jambService = typeof metadata?.jamb_service === 'string' ? (metadata.jamb_service as keyof typeof JAMB_SERVICES) : undefined;
    const serviceLabel = jambService ? JAMB_SERVICES[jambService]?.label ?? 'JAMB Service Request' : 'JAMB Service Request';

    try {
      const bytes = await readFile(filePath);
      const mime = file?.mimetype ?? file?.type ?? 'application/octet-stream';
      const fileName = file?.originalFilename ?? file?.name ?? 'jamb-document';

      // Deliver first, mark SUCCESS only after the delivery actually
      // exists - a failed delivery must never leave the transaction marked
      // done with nothing sent to the customer.
      const delivery = await createUserDelivery({
        userId: transaction.userId,
        adminId: admin.id,
        title: serviceLabel,
        description: `Your ${serviceLabel} is ready. Reference: ${transaction.reference}`,
        fileName,
        mimeType: mime,
        base64: bytes.toString('base64'),
        reference: transaction.reference
      });

      await prisma.transaction.update({ where: { id: transaction.id }, data: { status: TransactionStatus.SUCCESS } });

      await notifyUser({
        userId: transaction.userId,
        type: 'TRANSACTION',
        title: `${serviceLabel} ready`,
        body: `Your ${serviceLabel} has been delivered. Open Deliveries to download it. Reference: ${transaction.reference}`,
        data: { transactionId: transaction.id, reference: transaction.reference, deliveryId: delivery.id }
      });

      await logAdminAction({
        adminId: admin.id,
        action: 'COMPLETE_JAMB_REQUEST',
        targetType: 'Transaction',
        targetId: transaction.id,
        metadata: { reference: transaction.reference, fileName, deliveryId: delivery.id }
      });

      res.redirect(`/admin/resources/Transaction/records/${transaction.id}/show`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not complete this request.';
      redirectBack(message);
    }
  });
}
