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
type ManualTransaction = Awaited<ReturnType<typeof prisma.transaction.findUniqueOrThrow>>;
const verificationTypes: TransactionType[] = [TransactionType.IDENTITY_SERVICE_REQUEST, TransactionType.NIN_VERIFICATION, TransactionType.BVN_VERIFICATION];

function files(req: Request) { return (req as unknown as { files?: Record<string, Upload | Upload[]> }).files ?? {}; }
function uploadedFile(req: Request, name = 'file') { const value = files(req)[name]; return Array.isArray(value) ? value[0] : value; }
function fields(req: Request) { return (req as unknown as { fields?: Record<string, string | string[] | undefined> }).fields ?? {}; }
function field(req: Request, name: string) { const value = fields(req)[name]; return typeof value === 'string' ? value.trim() : ''; }
function escapeHtml(value: string) { return value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!); }
function isManualVerification(transaction: { type: TransactionType; provider: string | null }) { return transaction.provider === 'manual' && verificationTypes.includes(transaction.type); }
function serviceLabel(metadata: unknown, fallback: string) { const service = typeof metadata === 'object' && metadata !== null ? (metadata as Record<string, unknown>).service : undefined; return typeof service === 'string' ? service.replace(/_/g, ' ') : fallback.replace(/_/g, ' '); }
function groupFor(transaction: { type: TransactionType; metadata: unknown }) { const service = typeof transaction.metadata === 'object' && transaction.metadata !== null ? (transaction.metadata as Record<string, unknown>).service : undefined; return transaction.type === TransactionType.BVN_VERIFICATION || (typeof service === 'string' && service.startsWith('BVN_')) ? 'BVN' : 'NIN'; }
function requestIdentifier(pii: Record<string, unknown> | null) { if (!pii) return '—'; for (const key of ['nin', 'tracking_id', 'trackingId', 'bvn', 'phone']) { const value = pii[key]; if (typeof value === 'string' && value.trim()) return value.trim(); } return '—'; }

async function sendUpdate(transaction: ManualTransaction, admin: AdminSessionUser, note: string) {
  if (!note) throw new Error('Write an update before sending.');
  await notifyUser({ userId: transaction.userId, type: 'TRANSACTION', title: 'Service request update', body: note, data: { transactionId: transaction.id, reference: transaction.reference } });
  await logAdminAction({ adminId: admin.id, action: 'UPDATE_MANUAL_VERIFICATION', targetType: 'Transaction', targetId: transaction.id, metadata: { reference: transaction.reference } });
}

async function completeRequest(transaction: ManualTransaction, admin: AdminSessionUser, note: string, file?: Upload) {
  let deliveryId: string | undefined;
  const filePath = file?.filepath ?? file?.path;
  if (filePath) {
    const bytes = await readFile(filePath);
    const delivery = await createUserDelivery({ userId: transaction.userId, adminId: admin.id, title: `${serviceLabel(transaction.metadata, transaction.type)} result`, description: note || `Your request is complete. Reference: ${transaction.reference}`, fileName: file?.originalFilename ?? file?.name ?? 'service-result', mimeType: file?.mimetype ?? file?.type ?? 'application/octet-stream', base64: bytes.toString('base64'), reference: transaction.reference });
    deliveryId = delivery.id;
  }
  const metadata = (transaction.metadata as Record<string, unknown> | null) ?? {};
  await prisma.transaction.update({ where: { id: transaction.id }, data: { status: TransactionStatus.SUCCESS, metadata: { ...metadata, pii: mergeSealedPII(metadata.pii, { ...(note ? { admin_note: note } : {}), ...(deliveryId ? { delivery_id: deliveryId } : {}) }) } as Prisma.InputJsonValue } });
  await notifyUser({ userId: transaction.userId, type: 'TRANSACTION', title: `${serviceLabel(transaction.metadata, transaction.type)} complete`, body: deliveryId ? `Your result is ready. Open Deliveries to download it. Reference: ${transaction.reference}` : (note || `Your request is complete. Reference: ${transaction.reference}`), data: { transactionId: transaction.id, reference: transaction.reference, ...(deliveryId ? { deliveryId } : {}) } });
  await logAdminAction({ adminId: admin.id, action: 'COMPLETE_MANUAL_VERIFICATION_WITH_DELIVERY', targetType: 'Transaction', targetId: transaction.id, metadata: { reference: transaction.reference, deliveryId: deliveryId ?? null } });
}

function renderBatchPage(params: { rows: Array<ManualTransaction & { user: { fullName: string; email: string } }>; group: 'NIN' | 'BVN'; flash?: string }) {
  const { rows, group, flash } = params;
  const tableRows = rows.length ? rows.map((transaction) => {
    const pii = openPII<Record<string, unknown>>((transaction.metadata as Record<string, unknown> | null)?.pii); const id = transaction.id;
    return `<tr><td><strong>${escapeHtml(serviceLabel(transaction.metadata, transaction.type))}</strong><br><small>${escapeHtml(transaction.reference)}</small></td><td>${escapeHtml(transaction.user.fullName)}<br><small>${escapeHtml(transaction.user.email)}</small></td><td>${escapeHtml(requestIdentifier(pii))}</td><td>${escapeHtml(transaction.createdAt.toLocaleString())}</td><td><select name="action_${id}"><option value="">No change</option><option value="update">Send update</option><option value="complete">Complete request</option></select></td><td><textarea name="note_${id}" rows="2" placeholder="Update or completion note"></textarea></td><td><input type="file" name="file_${id}" accept="application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/png,image/jpeg"><small>Optional; only used when completing.</small></td></tr>`;
  }).join('') : '<tr><td colspan="7" class="empty">No pending requests in this queue.</td></tr>';
  return `<!doctype html><html><head><meta charset="utf-8"><title>${group} Verification Queue</title><style>body{font:14px Arial,sans-serif;background:#f5f6f8;color:#18212f;margin:0;padding:28px}a{color:#0756b8;font-weight:600;text-decoration:none}.top{display:flex;justify-content:space-between;align-items:center;gap:16px}.tabs{display:flex;gap:10px;margin:22px 0}.tab{background:#fff;border:1px solid #d8e0ea;border-radius:9px;padding:10px 14px}.tab.active{background:#0b2f73;color:#fff}.flash{background:#e6f4ea;border:1px solid #8fd1a1;color:#155724;padding:12px 15px;border-radius:8px;margin:16px 0}form{overflow-x:auto}table{border-collapse:collapse;width:100%;min-width:1180px;background:#fff;box-shadow:0 1px 4px #0001}th,td{text-align:left;padding:12px;border-bottom:1px solid #e7edf4;vertical-align:top}th{background:#0b2f73;color:#fff}textarea,select,input[type=file]{box-sizing:border-box;width:100%;font:inherit;border:1px solid #bdc9d8;border-radius:6px;padding:8px;background:#fff}input[type=file]{font-size:12px}small{display:block;color:#5b6878;margin-top:4px}.empty{text-align:center;padding:32px}.submit{margin-top:16px;background:#0b2f73;color:#fff;border:0;border-radius:8px;padding:12px 20px;font-size:15px;font-weight:bold;cursor:pointer}.hint{color:#536273}</style></head><body><div class="top"><div><h1>${group} verification queue</h1><p class="hint">Process many pending customer requests on one page. Choose an action only for rows you want to change.</p></div><a href="/admin">← Admin Dashboard</a></div><div class="tabs"><a class="tab ${group === 'NIN' ? 'active' : ''}" href="/admin/manual-verifications?group=NIN">NIN requests</a><a class="tab ${group === 'BVN' ? 'active' : ''}" href="/admin/manual-verifications?group=BVN">BVN requests</a><a class="tab" href="/admin/manual-requests">Other manual requests</a></div>${flash ? `<p class="flash">${escapeHtml(flash)}</p>` : ''}<form method="post" action="/admin/manual-verifications/batch?group=${group}" enctype="multipart/form-data"><table><thead><tr><th>Request</th><th>Customer</th><th>Submitted ID</th><th>Submitted</th><th>Action</th><th>Message</th><th>Result file</th></tr></thead><tbody>${tableRows}</tbody></table>${rows.length ? '<button class="submit" type="submit">Apply selected changes</button>' : ''}</form></body></html>`;
}

function renderPage(params: { transaction: ManualTransaction; pii: Record<string, unknown> | null; flash?: string }) {
  const { transaction, pii, flash } = params; const pending = transaction.status === TransactionStatus.PENDING;
  const dataRows = pii ? Object.entries(pii).filter(([key]) => !/(pdf|image|photo|raw|file)/i.test(key)).map(([key, value]) => `<dt>${escapeHtml(key.replace(/_/g, ' '))}</dt><dd>${escapeHtml(typeof value === 'object' ? JSON.stringify(value) : String(value ?? '—'))}</dd>`).join('') : '<dt>Submitted details</dt><dd>—</dd>';
  return `<!doctype html><html><head><meta charset="utf-8"><title>Process ${escapeHtml(transaction.reference)}</title><style>body{font:14px Arial,sans-serif;background:#f6f3ea;color:#201708;max-width:720px;margin:32px auto;padding:0 16px}a{color:#8a6712}section{background:#fff;border:1px solid #d4af37;border-radius:14px;padding:22px;margin:16px 0}dl{display:grid;grid-template-columns:220px 1fr;gap:8px 14px;margin:0}dt{font-weight:600;color:#6c5a2a;text-transform:capitalize}dd{margin:0;word-break:break-word}input[type=file],textarea{display:block;box-sizing:border-box;margin:10px 0;width:100%;font-family:inherit}textarea{padding:9px;border:1px solid #d4af37;border-radius:8px}button{background:#171106;color:#ffe9a3;border:0;border-radius:8px;padding:11px 18px;font-weight:bold;cursor:pointer;font-size:1rem;margin-right:8px}.secondary{background:#0b4f82}.badge{display:inline-block;padding:3px 12px;border-radius:12px;font-size:.8rem;font-weight:700}.pending{background:#fff3cd;color:#856404}.success{background:#d4edda;color:#155724}.flash{background:#e6f4ea;color:#155724;border-radius:8px;padding:10px 14px;margin-bottom:16px}.hint{color:#6c5a2a;font-size:.9rem}</style></head><body><p><a href="/admin/manual-verifications?group=${groupFor(transaction)}">← Back to verification queue</a></p><h1 style="margin-bottom:4px">${escapeHtml(serviceLabel(transaction.metadata, transaction.type))}</h1><p class="hint">Reference: ${escapeHtml(transaction.reference)}</p>${flash ? `<p class="flash">${escapeHtml(flash)}</p>` : ''}<section><p><span class="badge ${pending ? 'pending' : 'success'}">${escapeHtml(transaction.status)}</span></p><h2>Submitted request details</h2><dl>${dataRows}</dl></section>${pending ? `<section><h2 style="margin-top:0">Send customer an update</h2><form method="post" action="?action=update"><textarea name="note" required rows="3"></textarea><button class="secondary" type="submit">Send update</button></form></section><section><h2 style="margin-top:0">Deliver result & mark complete</h2><form method="post" action="?action=complete" enctype="multipart/form-data"><input type="file" name="file" accept="application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/png,image/jpeg"><textarea name="note" rows="3" placeholder="Optional completion note"></textarea><button type="submit">Complete & notify customer</button></form></section>` : '<p class="hint">This request is already complete.</p>'}</body></html>`;
}

export function registerManualVerificationRoutes(router: Router) {
  router.get('/manual-verifications', async (req, res) => {
    const admin = req.session?.adminUser as AdminSessionUser | undefined; if (!admin) return res.redirect('/admin/login');
    const group = req.query.group === 'BVN' ? 'BVN' : 'NIN';
    const pending = await prisma.transaction.findMany({ where: { status: TransactionStatus.PENDING, provider: 'manual', type: { in: verificationTypes } }, include: { user: { select: { fullName: true, email: true } } }, orderBy: { createdAt: 'asc' } });
    res.type('html').send(renderBatchPage({ rows: pending.filter((row) => groupFor(row) === group), group, flash: typeof req.query.flash === 'string' ? req.query.flash : undefined }));
  });
  router.post('/manual-verifications/batch', async (req, res) => {
    const admin = req.session?.adminUser as AdminSessionUser | undefined; const group = req.query.group === 'BVN' ? 'BVN' : 'NIN';
    if (!admin) return res.redirect('/admin/login'); if (admin.role === 'SUPPORT') return res.status(403).type('html').send('<p>Finance or Super Admin access is required.</p>');
    const actions = Object.entries(fields(req)).filter(([name, value]) => name.startsWith('action_') && (value === 'update' || value === 'complete')) as Array<[string, 'update' | 'complete']>;
    let completed = 0; let updated = 0; let failures = 0;
    for (const [name, action] of actions) { const id = name.slice('action_'.length); try { const transaction = await prisma.transaction.findUnique({ where: { id } }); if (!transaction || !isManualVerification(transaction) || transaction.status !== TransactionStatus.PENDING || groupFor(transaction) !== group) throw new Error('Unavailable'); const note = field(req, `note_${id}`); if (action === 'update') { await sendUpdate(transaction, admin, note); updated += 1; } else { await completeRequest(transaction, admin, note, uploadedFile(req, `file_${id}`)); completed += 1; } } catch { failures += 1; } }
    const summary = actions.length ? `${updated} update(s) sent; ${completed} request(s) completed.${failures ? ` ${failures} row(s) could not be processed.` : ''}` : 'Choose at least one action before applying changes.';
    res.redirect(`/admin/manual-verifications?group=${group}&flash=${encodeURIComponent(summary)}`);
  });
  router.get('/manual-verification/:transactionId', async (req, res) => {
    const admin = req.session?.adminUser as AdminSessionUser | undefined; if (!admin) return res.redirect('/admin/login');
    const transaction = await prisma.transaction.findUnique({ where: { id: req.params.transactionId } }); if (!transaction || !isManualVerification(transaction)) return res.status(404).type('html').send('<p>Manual verification request not found.</p>');
    const metadata = transaction.metadata as Record<string, unknown> | null; res.type('html').send(renderPage({ transaction, pii: openPII<Record<string, unknown>>(metadata?.pii), flash: typeof req.query.flash === 'string' ? req.query.flash : undefined }));
  });
  router.post('/manual-verification/:transactionId', async (req, res) => {
    const admin = req.session?.adminUser as AdminSessionUser | undefined; if (!admin) return res.redirect('/admin/login'); if (admin.role === 'SUPPORT') return res.status(403).type('html').send('<p>Finance or Super Admin access is required.</p>');
    const transaction = await prisma.transaction.findUnique({ where: { id: req.params.transactionId } }); const redirectBack = (message: string) => res.redirect(`/admin/manual-verification/${req.params.transactionId}?flash=${encodeURIComponent(message)}`);
    if (!transaction || !isManualVerification(transaction)) return res.status(404).type('html').send('<p>Manual verification request not found.</p>'); if (transaction.status !== TransactionStatus.PENDING) return redirectBack('This request is no longer pending.');
    try { if (req.query.action === 'update') { await sendUpdate(transaction, admin, field(req, 'note')); return redirectBack('Update sent to the customer.'); } await completeRequest(transaction, admin, field(req, 'note'), uploadedFile(req)); return res.redirect(`/admin/manual-verifications?group=${groupFor(transaction)}&flash=${encodeURIComponent('Request completed successfully.')}`); } catch (error) { return redirectBack(error instanceof Error ? error.message : 'Could not complete this request.'); }
  });
}
