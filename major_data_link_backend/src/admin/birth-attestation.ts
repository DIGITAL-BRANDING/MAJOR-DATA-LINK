import { readFile } from 'node:fs/promises';
import type { Request, Router } from 'express';
import { TransactionStatus, TransactionType } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import {
  BIRTH_ATTESTATION_FIELDS,
  decryptBirthAttestationPII,
  updateBirthAttestationProgressNotes
} from '../services/birth-attestation.service.js';
import { createUserDelivery } from '../services/user-delivery.service.js';
import { notifyUser } from '../services/notification.service.js';
import { logAdminAction } from './audit.js';
import type { AdminSessionUser } from './auth.js';

declare module 'express-session' {
  interface SessionData {
    adminUser?: AdminSessionUser;
  }
}

/**
 * Custom admin page for handling a Birth Attestation request while it's
 * PENDING - same shape as admin/newspaper-publication.ts (progress notes +
 * upload-to-complete via Deliveries), adapted from infoverify's
 * admin/birth-attestation.ts. See newspaper-publication.ts's comment for
 * why this uses plain multipart form posts (formidable) instead of
 * infoverify's fetch()+JSON+base64 approach, and Deliveries instead of
 * infoverify's sealed-PII storage for the final document.
 */

type Upload = { filepath?: string; path?: string; originalFilename?: string; name?: string; mimetype?: string; type?: string };
function uploadedFile(req: Request) {
  const files = (req as unknown as { files?: Record<string, Upload | Upload[]> }).files;
  const value = files?.file;
  return Array.isArray(value) ? value[0] : value;
}
function formField(req: Request, key: string): string {
  const fields = (req as unknown as { fields?: Record<string, string | string[]> }).fields;
  const value = fields?.[key];
  return Array.isArray(value) ? (value[0] ?? '') : (value ?? '');
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

function renderPage(params: {
  transactionId: string;
  reference: string;
  status: string;
  pii: (Record<string, unknown> & { pdf_base64?: string }) | null;
  progressNotes: string;
  flash?: string;
}) {
  const { transactionId, reference, status, pii, progressNotes, flash } = params;
  const isPending = status === 'PENDING';
  const row = (label: string, value: unknown) => `<dt>${escapeHtml(label)}</dt><dd>${escapeHtml(String(value ?? '\u2014'))}</dd>`;

  const sections: string[] = [];
  let currentSection = '';
  let rowsHtml = '';
  for (const field of BIRTH_ATTESTATION_FIELDS) {
    if (field.input === 'image') continue;
    if (field.section && field.section !== currentSection) {
      if (currentSection) sections.push(`<h2 style="font-size:15px">${escapeHtml(currentSection)}</h2><dl>${rowsHtml}</dl>`);
      currentSection = field.section;
      rowsHtml = '';
    }
    rowsHtml += row(field.label, pii?.[field.key]);
  }
  if (currentSection) sections.push(`<h2 style="font-size:15px">${escapeHtml(currentSection)}</h2><dl>${rowsHtml}</dl>`);

  const photo = typeof pii?.clean_picture === 'string' && pii.clean_picture.startsWith('data:image/') ? pii.clean_picture : null;

  return `<!doctype html><html><head><meta charset="utf-8"><title>Birth Attestation ${escapeHtml(reference)}</title>
<style>
  body{font:14px Arial,sans-serif;background:#f6f3ea;color:#201708;max-width:680px;margin:32px auto;padding:0 16px}
  a{color:#8a6712}
  section{background:#fff;border:1px solid #d4af37;border-radius:14px;padding:22px;margin:16px 0}
  dl{display:grid;grid-template-columns:230px 1fr;gap:6px 12px;margin:0 0 14px}
  dt{font-weight:600;color:#6c5a2a}
  dd{margin:0}
  h2{margin:14px 0 6px;color:#6b4f0b}
  h2:first-child{margin-top:0}
  input[type=file],textarea{display:block;width:100%;box-sizing:border-box;margin:12px 0;font:inherit;padding:8px}
  textarea{min-height:90px}
  button{background:#171106;color:#ffe9a3;border:0;border-radius:8px;padding:11px 18px;font-weight:bold;cursor:pointer;font-size:1rem}
  .badge{display:inline-block;padding:3px 12px;border-radius:12px;font-size:.8rem;font-weight:700}
  .pending{background:#fff3cd;color:#856404}
  .success{background:#d4edda;color:#155724}
  .flash{background:#fdecea;color:#a12622;border-radius:8px;padding:10px 14px;margin-bottom:16px}
  .hint{color:#6c5a2a;font-size:.9rem}
  img.photo{max-width:200px;border-radius:8px;border:1px solid #d4af37;display:block;margin-top:8px}
</style></head><body>
  <p><a href="/admin/resources/Transaction/records/${transactionId}/show">&larr; Back to transaction</a></p>
  <h1 style="margin-bottom:4px">Birth Attestation</h1>
  <p class="hint">${escapeHtml(reference)} &middot; NPC Birth Attestation &amp; Instant approval</p>
  ${flash ? `<p class="flash">${escapeHtml(flash)}</p>` : ''}

  <section>
    <p><span class="badge ${isPending ? 'pending' : 'success'}">${escapeHtml(status)}</span></p>
    ${sections.join('')}
    ${photo ? `<h2 style="font-size:15px">Photo</h2><img class="photo" src="${photo}" alt="Clean picture">` : ''}
    ${
      pii?.pdf_base64
        ? `<p class="hint" style="margin-top:16px"><a href="/admin/birth-attestation/${transactionId}/submission-pdf">Download submission form (PDF)</a> - file this with NPC when processing.</p>`
        : '<p class="hint">No submission form was generated for this request.</p>'
    }
  </section>

  <section>
    <h2 style="font-size:15px;margin-top:0">Progress note</h2>
    <p class="hint">Visible to the customer on their Birth Attestation history.</p>
    <form method="post" action="/admin/birth-attestation/${transactionId}/notes">
      <textarea name="progress_notes" placeholder="e.g. Submitted to NPC, awaiting attestation">${escapeHtml(progressNotes)}</textarea>
      <button type="submit">Save progress note</button>
    </form>
  </section>

  ${
    isPending
      ? `<section>
          <h2 style="font-size:15px;margin-top:0">Complete request</h2>
          <p class="hint">Upload the NPC-issued attestation once it's ready. This sends it to the customer's Deliveries inbox and marks the request complete.</p>
          <form method="post" action="/admin/birth-attestation/${transactionId}/complete" enctype="multipart/form-data">
            <input type="file" name="file" accept="application/pdf,image/png,image/jpeg" required>
            <button type="submit">Deliver &amp; mark complete</button>
          </form>
        </section>`
      : `<p class="hint">This request is already ${escapeHtml(status)} - the attestation has been sent to the customer's Deliveries inbox.</p>`
  }
</body></html>`;
}

export function registerBirthAttestationRoutes(router: Router) {
  async function loadTransaction(req: Request) {
    const transactionId = Array.isArray(req.params.transactionId) ? req.params.transactionId[0] : req.params.transactionId;
    const transaction = await prisma.transaction.findUnique({ where: { id: transactionId } });
    if (!transaction || transaction.type !== TransactionType.BIRTH_ATTESTATION) return null;
    return transaction;
  }

  router.get('/birth-attestation/:transactionId/manage', async (req: Request, res) => {
    const admin = req.session?.adminUser;
    if (!admin) return res.redirect('/admin/login');
    if (admin.role === 'SUPPORT') {
      return res.status(403).type('html').send('<p>Support admins cannot manage Birth Attestation requests.</p>');
    }

    const transaction = await loadTransaction(req);
    if (!transaction) return res.status(404).type('html').send('<p>Birth Attestation request not found.</p>');

    await logAdminAction({
      adminId: admin.id,
      action: 'VIEW_TRANSACTION_PII',
      targetType: 'Transaction',
      targetId: transaction.id,
      metadata: { reference: transaction.reference, via: 'birth_attestation_manage' }
    });

    const metadata = transaction.metadata as Record<string, unknown> | null;
    const pii = decryptBirthAttestationPII(transaction);
    const progressNotes = typeof metadata?.progress_notes === 'string' ? metadata.progress_notes : '';

    res.type('html').send(
      renderPage({
        transactionId: transaction.id,
        reference: transaction.reference,
        status: transaction.status,
        pii,
        progressNotes,
        flash: typeof req.query.flash === 'string' ? req.query.flash : undefined
      })
    );
  });

  router.get('/birth-attestation/:transactionId/submission-pdf', async (req: Request, res) => {
    const admin = req.session?.adminUser;
    if (!admin) return res.redirect('/admin/login');
    if (admin.role !== 'SUPER_ADMIN') {
      return res.status(403).type('html').send('<p>Only a Super Admin can open Birth Attestation submission PDFs.</p>');
    }

    const transaction = await loadTransaction(req);
    if (!transaction) return res.status(404).type('html').send('<p>Birth Attestation request not found.</p>');

    const pii = decryptBirthAttestationPII(transaction);
    if (!pii?.pdf_base64 || typeof pii.pdf_base64 !== 'string') {
      return res.status(404).type('html').send('<p>No PDF was generated for this request.</p>');
    }

    await logAdminAction({
      adminId: admin.id,
      action: 'VIEW_TRANSACTION_PII',
      targetType: 'Transaction',
      targetId: transaction.id,
      metadata: { reference: transaction.reference, via: 'birth_attestation_submission_pdf' }
    });

    const buffer = Buffer.from(pii.pdf_base64, 'base64');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${transaction.reference}-submission-form.pdf"`);
    res.send(buffer);
  });

  router.post('/birth-attestation/:transactionId/notes', async (req: Request, res) => {
    const admin = req.session?.adminUser;
    if (!admin) return res.redirect('/admin/login');
    if (admin.role === 'SUPPORT') {
      return res.status(403).type('html').send('<p>Support admins cannot manage Birth Attestation requests.</p>');
    }

    const transaction = await loadTransaction(req);
    if (!transaction) return res.status(404).type('html').send('<p>Birth Attestation request not found.</p>');

    await updateBirthAttestationProgressNotes({
      transactionId: transaction.id,
      notes: formField(req, 'progress_notes').slice(0, 2000)
    });
    await logAdminAction({
      adminId: admin.id,
      action: 'UPDATE_BIRTH_ATTESTATION_PROGRESS',
      targetType: 'Transaction',
      targetId: transaction.id,
      metadata: { reference: transaction.reference }
    });

    res.redirect(`/admin/birth-attestation/${transaction.id}/manage?flash=${encodeURIComponent('Progress note saved.')}`);
  });

  router.post('/birth-attestation/:transactionId/complete', async (req: Request, res) => {
    const admin = req.session?.adminUser;
    if (!admin) return res.redirect('/admin/login');
    if (admin.role === 'SUPPORT') {
      return res.status(403).type('html').send('<p>Support admins cannot manage Birth Attestation requests.</p>');
    }

    const transaction = await loadTransaction(req);
    const redirectBack = (flash: string) =>
      res.redirect(`/admin/birth-attestation/${req.params.transactionId as string}/manage?flash=${encodeURIComponent(flash)}`);

    if (!transaction) return res.status(404).type('html').send('<p>Birth Attestation request not found.</p>');
    if (transaction.status !== TransactionStatus.PENDING) {
      return redirectBack('This request is no longer pending.');
    }

    const file = uploadedFile(req);
    const filePath = file?.filepath ?? file?.path;
    if (!filePath) {
      return redirectBack('No file was uploaded. Please choose a file and try again.');
    }

    try {
      const bytes = await readFile(filePath);
      const mime = file?.mimetype ?? file?.type ?? 'application/octet-stream';
      const fileName = file?.originalFilename ?? file?.name ?? 'birth-attestation';

      // Deliver first, mark SUCCESS only after the delivery actually exists.
      const delivery = await createUserDelivery({
        userId: transaction.userId,
        adminId: admin.id,
        title: 'Birth Attestation',
        description: `Your NPC Birth Attestation is ready. Reference: ${transaction.reference}`,
        fileName,
        mimeType: mime,
        base64: bytes.toString('base64'),
        reference: transaction.reference
      });

      await prisma.transaction.update({ where: { id: transaction.id }, data: { status: TransactionStatus.SUCCESS } });

      await notifyUser({
        userId: transaction.userId,
        type: 'TRANSACTION',
        title: 'Birth Attestation ready',
        body: `Your Birth Attestation has been delivered. Open Deliveries to download it. Reference: ${transaction.reference}`,
        data: { transactionId: transaction.id, reference: transaction.reference, deliveryId: delivery.id }
      });

      await logAdminAction({
        adminId: admin.id,
        action: 'COMPLETE_BIRTH_ATTESTATION',
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
