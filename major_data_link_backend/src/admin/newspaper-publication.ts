import { readFile } from 'node:fs/promises';
import type { Request, Router } from 'express';
import { TransactionStatus, TransactionType } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import {
  NEWSPAPER_PUBLICATION_FIELDS,
  decryptNewspaperPublicationPII,
  updateNewspaperPublicationProgressNotes
} from '../services/newspaper-publication.service.js';
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
 * Custom admin page (not an AdminJS record action) for handling a
 * Newspaper Publication request while it's PENDING - reached via the
 * "manageNewspaperPublication" action's redirectUrl on the Transaction
 * resource. Ported from infoverify's admin/newspaper-publication.ts, but
 * rebuilt as plain multipart form posts + redirects (matching
 * admin/jamb.ts) instead of infoverify's fetch()+JSON+base64 approach -
 * this router has express-formidable mounted ahead of every route on it
 * (see buildAuthenticatedRouter() in setup.ts), which parses bodies into
 * req.fields/req.files, not req.body/JSON, so infoverify's original
 * approach would not have worked here unmodified.
 *
 * The final newspaper cutting is delivered via user-delivery.service.ts
 * ("My Deliveries") instead of infoverify's sealed-PII storage - see the
 * comment on newspaper-publication.service.ts for why.
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
  const oldRows = NEWSPAPER_PUBLICATION_FIELDS.filter((f) => f.key.startsWith('old_'));
  const newRows = NEWSPAPER_PUBLICATION_FIELDS.filter((f) => f.key.startsWith('new_'));
  const row = (label: string, value: unknown) => `<dt>${escapeHtml(label)}</dt><dd>${escapeHtml(String(value ?? '\u2014'))}</dd>`;

  return `<!doctype html><html><head><meta charset="utf-8"><title>Newspaper Publication ${escapeHtml(reference)}</title>
<style>
  body{font:14px Arial,sans-serif;background:#f6f3ea;color:#201708;max-width:640px;margin:32px auto;padding:0 16px}
  a{color:#8a6712}
  section{background:#fff;border:1px solid #d4af37;border-radius:14px;padding:22px;margin:16px 0}
  dl{display:grid;grid-template-columns:200px 1fr;gap:8px 12px;margin:0}
  dt{font-weight:600;color:#6c5a2a}
  dd{margin:0}
  h2{margin-top:0}
  input[type=file],textarea{display:block;width:100%;box-sizing:border-box;margin:12px 0;font:inherit;padding:8px}
  textarea{min-height:90px}
  button{background:#171106;color:#ffe9a3;border:0;border-radius:8px;padding:11px 18px;font-weight:bold;cursor:pointer;font-size:1rem}
  .badge{display:inline-block;padding:3px 12px;border-radius:12px;font-size:.8rem;font-weight:700}
  .pending{background:#fff3cd;color:#856404}
  .success{background:#d4edda;color:#155724}
  .flash{background:#fdecea;color:#a12622;border-radius:8px;padding:10px 14px;margin-bottom:16px}
  .hint{color:#6c5a2a;font-size:.9rem}
</style></head><body>
  <p><a href="/admin/resources/Transaction/records/${transactionId}/show">&larr; Back to transaction</a></p>
  <h1 style="margin-bottom:4px">Newspaper Publication</h1>
  <p class="hint">${escapeHtml(reference)} &middot; Name only or Name &amp; DoB (BluePrint/DailyTrust)</p>
  ${flash ? `<p class="flash">${escapeHtml(flash)}</p>` : ''}

  <section>
    <p><span class="badge ${isPending ? 'pending' : 'success'}">${escapeHtml(status)}</span></p>
    <h2 style="font-size:15px">Old Details</h2>
    <dl>${oldRows.map((f) => row(f.label, pii?.[f.key])).join('')}</dl>
    <h2 style="font-size:15px;margin-top:20px">New Details</h2>
    <dl>${newRows.map((f) => row(f.label, pii?.[f.key])).join('')}</dl>
    ${
      pii?.pdf_base64
        ? `<p class="hint" style="margin-top:16px"><a href="/admin/newspaper-publication/${transactionId}/submission-pdf">Download submission form (PDF)</a> - file this with the newspaper before placing the publication.</p>`
        : '<p class="hint">No submission form was generated for this request.</p>'
    }
  </section>

  <section>
    <h2 style="font-size:15px">Progress note</h2>
    <p class="hint">Visible to the customer on their Newspaper Publication history.</p>
    <form method="post" action="/admin/newspaper-publication/${transactionId}/notes">
      <textarea name="progress_notes" placeholder="e.g. Submitted to BluePrint, awaiting publication date">${escapeHtml(progressNotes)}</textarea>
      <button type="submit">Save progress note</button>
    </form>
  </section>

  ${
    isPending
      ? `<section>
          <h2 style="font-size:15px">Complete request</h2>
          <p class="hint">Upload the scanned newspaper cutting/affidavit once the publication has run. This sends it to the customer's Deliveries inbox and marks the request complete.</p>
          <form method="post" action="/admin/newspaper-publication/${transactionId}/complete" enctype="multipart/form-data">
            <input type="file" name="file" accept="application/pdf,image/png,image/jpeg" required>
            <button type="submit">Deliver &amp; mark complete</button>
          </form>
        </section>`
      : `<p class="hint">This request is already ${escapeHtml(status)} - the cutting has been sent to the customer's Deliveries inbox.</p>`
  }
</body></html>`;
}

export function registerNewspaperPublicationRoutes(router: Router) {
  async function loadTransaction(req: Request) {
    const transactionId = Array.isArray(req.params.transactionId) ? req.params.transactionId[0] : req.params.transactionId;
    const transaction = await prisma.transaction.findUnique({ where: { id: transactionId } });
    if (!transaction || transaction.type !== TransactionType.NEWSPAPER_PUBLICATION) return null;
    return transaction;
  }

  router.get('/newspaper-publication/:transactionId/manage', async (req: Request, res) => {
    const admin = req.session?.adminUser;
    if (!admin) return res.redirect('/admin/login');
    if (admin.role === 'SUPPORT') {
      return res.status(403).type('html').send('<p>Support admins cannot manage Newspaper Publication requests.</p>');
    }

    const transaction = await loadTransaction(req);
    if (!transaction) return res.status(404).type('html').send('<p>Newspaper Publication request not found.</p>');

    await logAdminAction({
      adminId: admin.id,
      action: 'VIEW_TRANSACTION_PII',
      targetType: 'Transaction',
      targetId: transaction.id,
      metadata: { reference: transaction.reference, via: 'newspaper_publication_manage' }
    });

    const metadata = transaction.metadata as Record<string, unknown> | null;
    const pii = decryptNewspaperPublicationPII(transaction);
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

  router.get('/newspaper-publication/:transactionId/submission-pdf', async (req: Request, res) => {
    const admin = req.session?.adminUser;
    if (!admin) return res.redirect('/admin/login');
    if (admin.role !== 'SUPER_ADMIN') {
      return res.status(403).type('html').send('<p>Only a Super Admin can open Newspaper Publication submission PDFs.</p>');
    }

    const transaction = await loadTransaction(req);
    if (!transaction) return res.status(404).type('html').send('<p>Newspaper Publication request not found.</p>');

    const pii = decryptNewspaperPublicationPII(transaction);
    if (!pii?.pdf_base64 || typeof pii.pdf_base64 !== 'string') {
      return res.status(404).type('html').send('<p>No PDF was generated for this request.</p>');
    }

    await logAdminAction({
      adminId: admin.id,
      action: 'VIEW_TRANSACTION_PII',
      targetType: 'Transaction',
      targetId: transaction.id,
      metadata: { reference: transaction.reference, via: 'newspaper_publication_submission_pdf' }
    });

    const buffer = Buffer.from(pii.pdf_base64, 'base64');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${transaction.reference}-submission-form.pdf"`);
    res.send(buffer);
  });

  router.post('/newspaper-publication/:transactionId/notes', async (req: Request, res) => {
    const admin = req.session?.adminUser;
    if (!admin) return res.redirect('/admin/login');
    if (admin.role === 'SUPPORT') {
      return res.status(403).type('html').send('<p>Support admins cannot manage Newspaper Publication requests.</p>');
    }

    const transaction = await loadTransaction(req);
    if (!transaction) return res.status(404).type('html').send('<p>Newspaper Publication request not found.</p>');

    await updateNewspaperPublicationProgressNotes({
      transactionId: transaction.id,
      notes: formField(req, 'progress_notes').slice(0, 2000)
    });
    await logAdminAction({
      adminId: admin.id,
      action: 'UPDATE_NEWSPAPER_PUBLICATION_PROGRESS',
      targetType: 'Transaction',
      targetId: transaction.id,
      metadata: { reference: transaction.reference }
    });

    res.redirect(`/admin/newspaper-publication/${transaction.id}/manage?flash=${encodeURIComponent('Progress note saved.')}`);
  });

  router.post('/newspaper-publication/:transactionId/complete', async (req: Request, res) => {
    const admin = req.session?.adminUser;
    if (!admin) return res.redirect('/admin/login');
    if (admin.role === 'SUPPORT') {
      return res.status(403).type('html').send('<p>Support admins cannot manage Newspaper Publication requests.</p>');
    }

    const transaction = await loadTransaction(req);
    const redirectBack = (flash: string) =>
      res.redirect(`/admin/newspaper-publication/${req.params.transactionId as string}/manage?flash=${encodeURIComponent(flash)}`);

    if (!transaction) return res.status(404).type('html').send('<p>Newspaper Publication request not found.</p>');
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
      const fileName = file?.originalFilename ?? file?.name ?? 'newspaper-publication';

      // Deliver first, mark SUCCESS only after the delivery actually
      // exists - a failed delivery must never leave the transaction marked
      // done with nothing sent to the customer (same order as admin/jamb.ts).
      const delivery = await createUserDelivery({
        userId: transaction.userId,
        adminId: admin.id,
        title: 'Newspaper Publication',
        description: `Your Newspaper Publication cutting is ready. Reference: ${transaction.reference}`,
        fileName,
        mimeType: mime,
        base64: bytes.toString('base64'),
        reference: transaction.reference
      });

      await prisma.transaction.update({ where: { id: transaction.id }, data: { status: TransactionStatus.SUCCESS } });

      await notifyUser({
        userId: transaction.userId,
        type: 'TRANSACTION',
        title: 'Newspaper Publication ready',
        body: `Your Newspaper Publication cutting has been delivered. Open Deliveries to download it. Reference: ${transaction.reference}`,
        data: { transactionId: transaction.id, reference: transaction.reference, deliveryId: delivery.id }
      });

      await logAdminAction({
        adminId: admin.id,
        action: 'COMPLETE_NEWSPAPER_PUBLICATION',
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
