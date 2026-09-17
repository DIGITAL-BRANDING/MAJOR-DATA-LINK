import { readFile } from 'node:fs/promises';
import type { Request, Router } from 'express';
import { TransactionStatus, TransactionType } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { completeCacRequest, decryptCacPII, updateCacProgressNotes } from '../services/cac.service.js';
import { logAdminAction } from './audit.js';
import type { AdminSessionUser } from './auth.js';

declare module 'express-session' {
  interface SessionData {
    adminUser?: AdminSessionUser;
  }
}

/**
 * Custom admin page for handling a CAC request while it's PENDING - same
 * shape as admin/newspaper-publication.ts/admin/birth-attestation.ts
 * (progress notes + upload-to-complete), adapted from infoverify's
 * admin/cac.ts. Two differences from those two:
 *  - The certificate upload here marks the request SUCCESS but keeps the
 *    final PDF alongside the submission PDF in sealed PII (matching
 *    infoverify's completeCacRequest()) rather than going through
 *    Deliveries - CAC customers already have a dedicated "Progress Notes +
 *    download" history table on their own CAC page, so a second inbox
 *    (Deliveries) would just be a second place to check for the same file.
 *  - Customer-uploaded supporting documents (ID, passport photo, proof of
 *    address, signature) each get their own download route, since there
 *    can be several per request.
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
  cacType: string;
  pii: ReturnType<typeof decryptCacPII>;
  progressNotes: string;
  flash?: string;
}) {
  const { transactionId, reference, status, cacType, pii, progressNotes, flash } = params;
  const isPending = status === 'PENDING';
  const hasCertificate = typeof pii?.certificate_pdf_base64 === 'string' && pii.certificate_pdf_base64.length > 0;
  const hasSubmissionForm = typeof pii?.submission_pdf_base64 === 'string' && pii.submission_pdf_base64.length > 0;
  const documents = Array.isArray(pii?.supporting_documents) ? pii.supporting_documents : [];

  const row = (label: string, value: unknown) => `<dt>${escapeHtml(label)}</dt><dd>${escapeHtml(String(value ?? '\u2014'))}</dd>`;

  return `<!doctype html><html><head><meta charset="utf-8"><title>CAC Request ${escapeHtml(reference)}</title>
<style>
  body{font:14px Arial,sans-serif;background:#f6f3ea;color:#201708;max-width:680px;margin:32px auto;padding:0 16px}
  a{color:#8a6712}
  section{background:#fff;border:1px solid #d4af37;border-radius:14px;padding:22px;margin:16px 0}
  dl{display:grid;grid-template-columns:230px 1fr;gap:6px 12px;margin:0}
  dt{font-weight:600;color:#6c5a2a}
  dd{margin:0}
  h2{margin:0 0 10px;font-size:15px}
  input[type=file],textarea{display:block;width:100%;box-sizing:border-box;margin:12px 0;font:inherit;padding:8px}
  textarea{min-height:90px}
  button{background:#171106;color:#ffe9a3;border:0;border-radius:8px;padding:11px 18px;font-weight:bold;cursor:pointer;font-size:1rem}
  .badge{display:inline-block;padding:3px 12px;border-radius:12px;font-size:.8rem;font-weight:700}
  .pending{background:#fff3cd;color:#856404}
  .success{background:#d4edda;color:#155724}
  .flash{background:#fdecea;color:#a12622;border-radius:8px;padding:10px 14px;margin-bottom:16px}
  .hint{color:#6c5a2a;font-size:.9rem}
  ul.docs{list-style:none;margin:0;padding:0}
  ul.docs li{padding:8px 0;border-bottom:1px solid #eee}
  ul.docs li:last-child{border-bottom:0}
</style></head><body>
  <p><a href="/admin/resources/Transaction/records/${transactionId}/show">&larr; Back to transaction</a></p>
  <h1 style="margin-bottom:4px">CAC Request</h1>
  <p class="hint">${escapeHtml(reference)} &middot; ${escapeHtml(cacType)}</p>
  ${flash ? `<p class="flash">${escapeHtml(flash)}</p>` : ''}

  <section>
    <p><span class="badge ${isPending ? 'pending' : 'success'}">${escapeHtml(status)}</span></p>
    <p><strong>Proposed name 1:</strong> ${escapeHtml(pii?.proposed_name_1 ?? '\u2014')}<br><strong>Proposed name 2:</strong> ${escapeHtml(pii?.proposed_name_2 ?? '\u2014')}</p>
    <h2>Business Details</h2>
    <dl>
      ${row('Nature of business', pii?.business_nature)}
      ${row('Business address', pii?.business_address)}
    </dl>
    <h2 style="margin-top:16px">Proprietor / Applicant Details</h2>
    <dl>
      ${row('Full name', pii?.proprietor_full_name)}
      ${row('Phone', pii?.proprietor_phone)}
      ${row('Email', pii?.proprietor_email)}
      ${row('Date of birth', pii?.proprietor_date_of_birth)}
      ${row('Gender', pii?.proprietor_gender)}
      ${row('NIN', pii?.proprietor_nin)}
      ${row('Residential address', pii?.proprietor_residential_address)}
    </dl>
    ${
      hasSubmissionForm
        ? `<p class="hint" style="margin-top:16px"><a href="/admin/cac/${transactionId}/submission-pdf">Download submission form (PDF)</a> - file this with CAC when registering the business.</p>`
        : '<p class="hint">No submission form was generated for this request.</p>'
    }
    ${hasCertificate ? `<p class="hint"><a href="/admin/cac/${transactionId}/certificate-pdf">Download the attached certificate</a>.</p>` : ''}
  </section>

  <section>
    <h2>Customer uploads</h2>
    ${
      documents.length
        ? `<ul class="docs">${documents.map((document, index) => `<li><a href="/admin/cac/${transactionId}/upload/${index}">${escapeHtml(document.label)} &mdash; ${escapeHtml(document.name)}</a></li>`).join('')}</ul>`
        : '<p class="hint">No supporting documents were uploaded.</p>'
    }
  </section>

  <section>
    <h2>Progress note</h2>
    <p class="hint">Visible to the customer on their CAC history table.</p>
    <form method="post" action="/admin/cac/${transactionId}/notes">
      <textarea name="progress_notes" placeholder="e.g. Name reservation submitted, awaiting CAC approval">${escapeHtml(progressNotes)}</textarea>
      <button type="submit">Save progress note</button>
    </form>
  </section>

  ${
    isPending
      ? `<section>
          <h2>Complete request</h2>
          <p class="hint">Upload the final CAC certificate once registration is done. This marks the request complete and lets the customer download it immediately.</p>
          <form method="post" action="/admin/cac/${transactionId}/complete" enctype="multipart/form-data">
            <input type="file" name="file" accept="application/pdf" required>
            <button type="submit">Mark complete &amp; attach certificate</button>
          </form>
        </section>`
      : `<p class="hint">This request is already ${escapeHtml(status)}.</p>`
  }
</body></html>`;
}

export function registerCacRoutes(router: Router) {
  async function loadTransaction(req: Request) {
    const transactionId = Array.isArray(req.params.transactionId) ? req.params.transactionId[0] : req.params.transactionId;
    const transaction = await prisma.transaction.findUnique({ where: { id: transactionId } });
    if (!transaction || transaction.type !== TransactionType.CAC_SERVICE_REQUEST) return null;
    return transaction;
  }

  router.get('/cac/:transactionId/manage', async (req: Request, res) => {
    const admin = req.session?.adminUser;
    if (!admin) return res.redirect('/admin/login');
    if (admin.role === 'SUPPORT') return res.status(403).type('html').send('<p>Support admins cannot manage CAC requests.</p>');

    const transaction = await loadTransaction(req);
    if (!transaction) return res.status(404).type('html').send('<p>CAC request not found.</p>');

    await logAdminAction({
      adminId: admin.id,
      action: 'VIEW_TRANSACTION_PII',
      targetType: 'Transaction',
      targetId: transaction.id,
      metadata: { reference: transaction.reference, via: 'cac_manage' }
    });

    const metadata = transaction.metadata as Record<string, unknown> | null;
    const pii = decryptCacPII(transaction);
    const progressNotes = typeof metadata?.progress_notes === 'string' ? metadata.progress_notes : '';

    res.type('html').send(
      renderPage({
        transactionId: transaction.id,
        reference: transaction.reference,
        status: transaction.status,
        cacType: typeof metadata?.cac_type === 'string' ? metadata.cac_type : '',
        pii,
        progressNotes,
        flash: typeof req.query.flash === 'string' ? req.query.flash : undefined
      })
    );
  });

  router.get('/cac/:transactionId/upload/:index', async (req: Request, res) => {
    const admin = req.session?.adminUser;
    if (!admin) return res.redirect('/admin/login');
    if (admin.role === 'SUPPORT') return res.status(403).type('html').send('<p>Support admins cannot download customer documents.</p>');

    const transaction = await loadTransaction(req);
    if (!transaction) return res.status(404).type('html').send('<p>CAC request not found.</p>');

    const index = Number(req.params.index);
    const documents = decryptCacPII(transaction)?.supporting_documents ?? [];
    const document = Number.isInteger(index) ? documents[index] : undefined;
    if (!document?.base64 || !document.name || !document.mime_type) {
      return res.status(404).type('html').send('<p>Document not found.</p>');
    }

    await logAdminAction({
      adminId: admin.id,
      action: 'DOWNLOAD_CAC_CUSTOMER_UPLOAD',
      targetType: 'Transaction',
      targetId: transaction.id,
      metadata: { reference: transaction.reference, fileName: document.name }
    });

    res
      .type(document.mime_type)
      .setHeader('Content-Disposition', `attachment; filename="${document.name.replace(/[^a-zA-Z0-9._-]/g, '_')}"`)
      .send(Buffer.from(document.base64.replace(/^data:[^;]+;base64,/, ''), 'base64'));
  });

  router.get('/cac/:transactionId/submission-pdf', async (req: Request, res) => {
    const admin = req.session?.adminUser;
    if (!admin) return res.redirect('/admin/login');
    if (admin.role !== 'SUPER_ADMIN') {
      return res.status(403).type('html').send('<p>Only a Super Admin can open CAC submission PDFs.</p>');
    }

    const transaction = await loadTransaction(req);
    if (!transaction) return res.status(404).type('html').send('<p>CAC request not found.</p>');

    const pii = decryptCacPII(transaction);
    if (!pii?.submission_pdf_base64) return res.status(404).type('html').send('<p>No submission form was generated for this request.</p>');

    await logAdminAction({
      adminId: admin.id,
      action: 'DOWNLOAD_CAC_SUBMISSION_PDF',
      targetType: 'Transaction',
      targetId: transaction.id,
      metadata: { reference: transaction.reference }
    });

    res
      .type('application/pdf')
      .setHeader('Content-Disposition', `inline; filename="${transaction.reference}-submission-form.pdf"`)
      .send(Buffer.from(pii.submission_pdf_base64.replace(/^data:[^;]+;base64,/, ''), 'base64'));
  });

  router.get('/cac/:transactionId/certificate-pdf', async (req: Request, res) => {
    const admin = req.session?.adminUser;
    if (!admin) return res.redirect('/admin/login');
    if (admin.role !== 'SUPER_ADMIN') {
      return res.status(403).type('html').send('<p>Only a Super Admin can open CAC certificates.</p>');
    }

    const transaction = await loadTransaction(req);
    if (!transaction) return res.status(404).type('html').send('<p>CAC request not found.</p>');

    const pii = decryptCacPII(transaction);
    if (!pii?.certificate_pdf_base64) return res.status(404).type('html').send('<p>No certificate has been attached to this request yet.</p>');

    await logAdminAction({
      adminId: admin.id,
      action: 'DOWNLOAD_CAC_CERTIFICATE_PDF',
      targetType: 'Transaction',
      targetId: transaction.id,
      metadata: { reference: transaction.reference }
    });

    res
      .type('application/pdf')
      .setHeader('Content-Disposition', `inline; filename="${transaction.reference}-certificate.pdf"`)
      .send(Buffer.from(pii.certificate_pdf_base64.replace(/^data:[^;]+;base64,/, ''), 'base64'));
  });

  router.post('/cac/:transactionId/notes', async (req: Request, res) => {
    const admin = req.session?.adminUser;
    if (!admin) return res.redirect('/admin/login');
    if (admin.role === 'SUPPORT') return res.status(403).type('html').send('<p>Support admins cannot manage CAC requests.</p>');

    const transaction = await loadTransaction(req);
    if (!transaction) return res.status(404).type('html').send('<p>CAC request not found.</p>');

    await updateCacProgressNotes({ transactionId: transaction.id, notes: formField(req, 'progress_notes').slice(0, 2000) });
    await logAdminAction({
      adminId: admin.id,
      action: 'UPDATE_CAC_PROGRESS',
      targetType: 'Transaction',
      targetId: transaction.id,
      metadata: { reference: transaction.reference }
    });

    res.redirect(`/admin/cac/${transaction.id}/manage?flash=${encodeURIComponent('Progress note saved.')}`);
  });

  router.post('/cac/:transactionId/complete', async (req: Request, res) => {
    const admin = req.session?.adminUser;
    if (!admin) return res.redirect('/admin/login');
    if (admin.role === 'SUPPORT') return res.status(403).type('html').send('<p>Support admins cannot manage CAC requests.</p>');

    const transaction = await loadTransaction(req);
    const redirectBack = (flash: string) => res.redirect(`/admin/cac/${req.params.transactionId as string}/manage?flash=${encodeURIComponent(flash)}`);

    if (!transaction) return res.status(404).type('html').send('<p>CAC request not found.</p>');
    if (transaction.status !== TransactionStatus.PENDING) {
      return redirectBack('This request is no longer pending.');
    }

    const file = uploadedFile(req);
    const filePath = file?.filepath ?? file?.path;
    if (!filePath) {
      return redirectBack('No file was uploaded. Please choose a PDF and try again.');
    }
    const mime = file?.mimetype ?? file?.type ?? '';
    if (mime !== 'application/pdf') {
      return redirectBack('Please upload the certificate as a PDF file.');
    }

    try {
      const bytes = await readFile(filePath);
      await completeCacRequest({ transactionId: transaction.id, certificatePdfBase64: bytes.toString('base64') });

      await logAdminAction({
        adminId: admin.id,
        action: 'COMPLETE_CAC_REQUEST',
        targetType: 'Transaction',
        targetId: transaction.id,
        metadata: { reference: transaction.reference }
      });

      res.redirect(`/admin/resources/Transaction/records/${transaction.id}/show`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not complete this request.';
      redirectBack(message);
    }
  });
}
