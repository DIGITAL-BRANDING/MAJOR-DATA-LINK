import { readFile } from 'node:fs/promises';
import type { Request, Router } from 'express';
import { Prisma, TransactionStatus, TransactionType } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { mergeSealedPII, openPII } from '../lib/pii.js';
import { createUserDelivery } from '../services/user-delivery.service.js';
import { notifyUser } from '../services/notification.service.js';
import { logAdminAction } from './audit.js';
import type { AdminSessionUser } from './auth.js';

type Upload = { filepath?: string; path?: string; originalFilename?: string; name?: string; mimetype?: string; type?: string };
const verificationTypes: TransactionType[] = [TransactionType.IDENTITY_SERVICE_REQUEST, TransactionType.NIN_VERIFICATION, TransactionType.BVN_VERIFICATION];

function uploadedFile(req: Request) {
  const files = (req as unknown as { files?: Record<string, Upload | Upload[]> }).files;
  const file = files?.file;
  return Array.isArray(file) ? file[0] : file;
}
function field(req: Request, name: string) {
  const value = (req as unknown as { fields?: Record<string, string | string[] | undefined> }).fields?.[name];
  return typeof value === 'string' ? value.trim() : '';
}
function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!);
}
function isManualVerification(transaction: { type: TransactionType; provider: string | null }) {
  return transaction.provider === 'manual' && verificationTypes.includes(transaction.type);
}
function serviceLabel(metadata: unknown, fallback: string) {
  const service = typeof metadata === 'object' && metadata !== null ? (metadata as Record<string, unknown>).service : undefined;
  return typeof service === 'string' ? service.replace(/_/g, ' ') : fallback.replace(/_/g, ' ');
}

function renderPage(params: { transaction: { id: string; reference: string; type: TransactionType; status: TransactionStatus; metadata: unknown }; pii: Record<string, unknown> | null; flash?: string }) {
  const { transaction, pii, flash } = params;
  const pending = transaction.status === TransactionStatus.PENDING;
  const dataRows = pii ? Object.entries(pii)
    .filter(([key]) => !/(pdf|image|photo|raw|file)/i.test(key))
    .map(([key, value]) => `<dt>${escapeHtml(key.replace(/_/g, ' '))}</dt><dd>${escapeHtml(typeof value === 'object' ? JSON.stringify(value) : String(value ?? '—'))}</dd>`).join('')
    : '<dt>Submitted details</dt><dd>—</dd>';
  return `<!doctype html><html><head><meta charset="utf-8"><title>Process ${escapeHtml(transaction.reference)}</title><style>body{font:14px Arial,sans-serif;background:#f6f3ea;color:#201708;max-width:720px;margin:32px auto;padding:0 16px}a{color:#8a6712}section{background:#fff;border:1px solid #d4af37;border-radius:14px;padding:22px;margin:16px 0}dl{display:grid;grid-template-columns:220px 1fr;gap:8px 14px;margin:0}dt{font-weight:600;color:#6c5a2a;text-transform:capitalize}dd{margin:0;word-break:break-word}input[type=file],textarea{display:block;box-sizing:border-box;margin:10px 0;width:100%;font-family:inherit}textarea{padding:9px;border:1px solid #d4af37;border-radius:8px}button{background:#171106;color:#ffe9a3;border:0;border-radius:8px;padding:11px 18px;font-weight:bold;cursor:pointer;font-size:1rem;margin-right:8px}.secondary{background:#0b4f82}.badge{display:inline-block;padding:3px 12px;border-radius:12px;font-size:.8rem;font-weight:700}.pending{background:#fff3cd;color:#856404}.success{background:#d4edda;color:#155724}.flash{background:#e6f4ea;color:#155724;border-radius:8px;padding:10px 14px;margin-bottom:16px}.hint{color:#6c5a2a;font-size:.9rem}</style></head><body><p><a href="/admin/manual-requests?group=NIN">← Back to manual requests</a></p><h1 style="margin-bottom:4px">${escapeHtml(serviceLabel(transaction.metadata, transaction.type))}</h1><p class="hint">Reference: ${escapeHtml(transaction.reference)}</p>${flash ? `<p class="flash">${escapeHtml(flash)}</p>` : ''}<section><p><span class="badge ${pending ? 'pending' : 'success'}">${escapeHtml(transaction.status)}</span></p><h2>Submitted request details</h2><p class="hint">For Validation, use the submitted NIN. For Personalization or IPE, use the submitted Tracking ID.</p><dl>${dataRows}</dl></section>${pending ? `<section><h2 style="margin-top:0">Send customer an update</h2><form method="post" action="?action=update"><textarea name="note" required rows="3" placeholder="Example: Your request is being processed and will be ready soon."></textarea><button class="secondary" type="submit">Send update</button></form></section><section><h2 style="margin-top:0">Deliver result & mark complete</h2><p class="hint">Upload PDF, Word document, PNG, or JPEG (max 10 MB). The file appears in the customer's Deliveries inbox and they receive a notification.</p><form method="post" action="?action=complete" enctype="multipart/form-data"><input type="file" name="file" accept="application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/png,image/jpeg"><textarea name="note" rows="3" placeholder="Optional completion note to the customer"></textarea><button type="submit">Complete & notify customer</button></form></section>` : '<p class="hint">This request is already complete. Any delivered file is available in the customer’s Deliveries inbox.</p>'}</body></html>`;
}

export function registerManualVerificationRoutes(router: Router) {
  router.get('/manual-verification/:transactionId', async (req, res) => {
    const admin = req.session?.adminUser as AdminSessionUser | undefined;
    if (!admin) return res.redirect('/admin/login');
    const transaction = await prisma.transaction.findUnique({ where: { id: req.params.transactionId } });
    if (!transaction || !isManualVerification(transaction)) return res.status(404).type('html').send('<p>Manual verification request not found.</p>');
    const metadata = transaction.metadata as Record<string, unknown> | null;
    res.type('html').send(renderPage({ transaction, pii: openPII<Record<string, unknown>>(metadata?.pii), flash: typeof req.query.flash === 'string' ? req.query.flash : undefined }));
  });

  router.post('/manual-verification/:transactionId', async (req, res) => {
    const admin = req.session?.adminUser as AdminSessionUser | undefined;
    if (!admin) return res.redirect('/admin/login');
    if (admin.role === 'SUPPORT') return res.status(403).type('html').send('<p>Finance or Super Admin access is required.</p>');
    const transaction = await prisma.transaction.findUnique({ where: { id: req.params.transactionId } });
    const redirectBack = (message: string) => res.redirect(`/admin/manual-verification/${req.params.transactionId}?flash=${encodeURIComponent(message)}`);
    if (!transaction || !isManualVerification(transaction)) return res.status(404).type('html').send('<p>Manual verification request not found.</p>');
    if (transaction.status !== TransactionStatus.PENDING) return redirectBack('This request is no longer pending.');

    const note = field(req, 'note');
    const action = req.query.action === 'update' ? 'update' : 'complete';
    if (action === 'update') {
      if (!note) return redirectBack('Write an update before sending.');
      await notifyUser({ userId: transaction.userId, type: 'TRANSACTION', title: 'Service request update', body: note, data: { transactionId: transaction.id, reference: transaction.reference } });
      await logAdminAction({ adminId: admin.id, action: 'UPDATE_MANUAL_VERIFICATION', targetType: 'Transaction', targetId: transaction.id, metadata: { reference: transaction.reference } });
      return redirectBack('Update sent to the customer.');
    }

    try {
      const file = uploadedFile(req); const filePath = file?.filepath ?? file?.path;
      let deliveryId: string | undefined;
      if (filePath) {
        const bytes = await readFile(filePath);
        const delivery = await createUserDelivery({ userId: transaction.userId, adminId: admin.id, title: `${serviceLabel(transaction.metadata, transaction.type)} result`, description: note || `Your request is complete. Reference: ${transaction.reference}`, fileName: file?.originalFilename ?? file?.name ?? 'service-result', mimeType: file?.mimetype ?? file?.type ?? 'application/octet-stream', base64: bytes.toString('base64'), reference: transaction.reference });
        deliveryId = delivery.id;
      }
      const metadata = (transaction.metadata as Record<string, unknown> | null) ?? {};
      await prisma.transaction.update({ where: { id: transaction.id }, data: { status: TransactionStatus.SUCCESS, metadata: { ...metadata, pii: mergeSealedPII(metadata.pii, { ...(note ? { admin_note: note } : {}), ...(deliveryId ? { delivery_id: deliveryId } : {}) }) } as Prisma.InputJsonValue } });
      await notifyUser({ userId: transaction.userId, type: 'TRANSACTION', title: `${serviceLabel(transaction.metadata, transaction.type)} complete`, body: deliveryId ? `Your result is ready. Open Deliveries to download it. Reference: ${transaction.reference}` : (note || `Your request is complete. Reference: ${transaction.reference}`), data: { transactionId: transaction.id, reference: transaction.reference, ...(deliveryId ? { deliveryId } : {}) } });
      await logAdminAction({ adminId: admin.id, action: 'COMPLETE_MANUAL_VERIFICATION_WITH_DELIVERY', targetType: 'Transaction', targetId: transaction.id, metadata: { reference: transaction.reference, deliveryId: deliveryId ?? null } });
      return res.redirect(`/admin/resources/Transaction/records/${transaction.id}/show`);
    } catch (error) { return redirectBack(error instanceof Error ? error.message : 'Could not complete this request.'); }
  });
}
