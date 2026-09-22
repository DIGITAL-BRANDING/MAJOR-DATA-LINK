import type { Request, Router } from 'express';
import { TransactionStatus, TransactionType } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import type { AdminSessionUser } from './auth.js';

type QueueGroup = 'NIN' | 'BVN' | 'CAC' | 'JAMB' | 'TIN_OTHER';

export const MANUAL_TRANSACTION_TYPES: TransactionType[] = [
  TransactionType.NIN_MODIFICATION,
  TransactionType.BVN_MODIFICATION,
  TransactionType.BVN_CRM,
  TransactionType.BVN_LICENSE_ONBOARDING,
  TransactionType.NEWSPAPER_PUBLICATION,
  TransactionType.BIRTH_ATTESTATION,
  TransactionType.CAC_SERVICE_REQUEST,
  TransactionType.JAMB_SERVICE_REQUEST
];

export const MANUAL_VERIFICATION_TRANSACTION_TYPES: TransactionType[] = [
  TransactionType.IDENTITY_SERVICE_REQUEST,
  TransactionType.NIN_VERIFICATION,
  TransactionType.BVN_VERIFICATION
];

export const QUEUE_GROUPS: Array<{ id: QueueGroup; label: string }> = [
  { id: 'NIN', label: 'NIN Services' },
  { id: 'BVN', label: 'BVN Services' },
  { id: 'CAC', label: 'CAC Services' },
  { id: 'JAMB', label: 'JAMB Services' },
  { id: 'TIN_OTHER', label: 'TIN & Other Services' }
];

export function groupFor(type: TransactionType, metadata: unknown): QueueGroup {
  const service = typeof metadata === 'object' && metadata !== null && typeof (metadata as Record<string, unknown>).service === 'string'
    ? (metadata as Record<string, unknown>).service as string
    : '';
  if (type === TransactionType.CAC_SERVICE_REQUEST) return 'CAC';
  if (type === TransactionType.JAMB_SERVICE_REQUEST) return 'JAMB';
  if (type === TransactionType.BVN_MODIFICATION || type === TransactionType.BVN_CRM || type === TransactionType.BVN_LICENSE_ONBOARDING || service.startsWith('BVN_')) return 'BVN';
  if (type === TransactionType.NIN_MODIFICATION || service.startsWith('NIN_') || service === 'IPE_CLEARANCE') return 'NIN';
  // TIN is reserved here for the upcoming TIN workflow; until then this tile
  // is also the deliberate home for Birth Attestation, Newspaper and any new
  // manually routed service rather than leaving it invisible to an admin.
  return 'TIN_OTHER';
}

export function isManualWorkItem(row: { type: TransactionType; provider: string | null }) {
  return MANUAL_TRANSACTION_TYPES.includes(row.type)
    || (row.provider === 'manual' && MANUAL_VERIFICATION_TRANSACTION_TYPES.includes(row.type));
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!);
}

export function registerManualRequestRoutes(router: Router) {
  router.get('/manual-requests', async (req: Request, res) => {
    const admin = req.session?.adminUser as AdminSessionUser | undefined;
    if (!admin) return res.redirect('/admin/login');

    const requestedGroup = QUEUE_GROUPS.some((group) => group.id === req.query.group) ? req.query.group as QueueGroup : undefined;
    const [customerRows, partnerRows] = await Promise.all([
      prisma.transaction.findMany({ where: { status: TransactionStatus.PENDING }, select: { id: true, reference: true, type: true, provider: true, metadata: true, description: true, createdAt: true }, orderBy: { createdAt: 'asc' } }),
      prisma.partnerTransaction.findMany({ where: { status: TransactionStatus.PENDING }, select: { id: true, reference: true, type: true, provider: true, metadata: true, description: true, createdAt: true }, orderBy: { createdAt: 'asc' } })
    ]);
    const rows = [
      ...customerRows.filter(isManualWorkItem).map((row) => ({ ...row, source: 'Customer', href: row.type === TransactionType.JAMB_SERVICE_REQUEST ? `/admin/jamb/${row.id}/fulfil` : row.provider === 'manual' && MANUAL_VERIFICATION_TRANSACTION_TYPES.includes(row.type) ? `/admin/manual-verifications?group=${groupFor(row.type, row.metadata)}` : `/admin/resources/Transaction/records/${row.id}/show`, group: groupFor(row.type, row.metadata) })),
      ...partnerRows.filter(isManualWorkItem).map((row) => ({ ...row, source: 'Partner API', href: `/admin/partner-manual-request/${row.id}`, group: groupFor(row.type, row.metadata) }))
    ].filter((row) => !requestedGroup || row.group === requestedGroup);

    const tabs = QUEUE_GROUPS.map((group) => {
      const count = [...customerRows, ...partnerRows].filter(isManualWorkItem).filter((row) => groupFor(row.type, row.metadata) === group.id).length;
      return `<a class="tab" href="/admin/manual-requests?group=${group.id}">${escapeHtml(group.label)} <strong>${count}</strong></a>`;
    }).join('');
    const table = rows.length ? rows.map((row) => `<tr><td>${escapeHtml(row.source)}</td><td><a href="${row.href}">${escapeHtml(row.reference)}</a></td><td>${escapeHtml(row.description)}</td><td>${escapeHtml(row.type.replace(/_/g, ' '))}</td><td>${row.createdAt.toLocaleString()}</td></tr>`).join('') : '<tr><td colspan="5">No pending manual requests in this group.</td></tr>';

    const partnerCount = partnerRows.filter(isManualWorkItem).length;
    res.type('html').send(`<!doctype html><html><head><meta charset="utf-8"><title>Manual Service Requests</title><style>body{font-family:Arial,sans-serif;background:#f5f6f8;color:#18212f;margin:0;padding:28px}a{color:#0756b8;font-weight:600;text-decoration:none}.top{display:flex;justify-content:space-between;align-items:center;gap:16px}.tabs{display:flex;flex-wrap:wrap;gap:10px;margin:22px 0}.tab{background:#fff;border:1px solid #d8e0ea;border-radius:9px;padding:10px 14px}.tab strong{background:#dbeafe;border-radius:999px;margin-left:6px;padding:2px 7px}table{border-collapse:collapse;width:100%;background:#fff;box-shadow:0 1px 4px #0001}th,td{text-align:left;padding:12px;border-bottom:1px solid #e7edf4;vertical-align:top}th{background:#0b2f73;color:#fff}</style></head><body><div class="top"><div><h1>${requestedGroup ? escapeHtml(QUEUE_GROUPS.find((group) => group.id === requestedGroup)!.label) : 'All Manual Service Requests'}</h1><p>Customer and Partner API requests waiting for manual processing.</p></div><a href="/admin">← Admin Dashboard</a></div><div class="tabs"><a class="tab" href="/admin/manual-requests">All requests <strong>${customerRows.filter(isManualWorkItem).length + partnerCount}</strong></a><a class="tab" href="/admin/partner-manual-requests">Partner bulk queue <strong>${partnerCount}</strong></a>${tabs}</div><table><thead><tr><th>Source</th><th>Reference</th><th>Request</th><th>Type</th><th>Submitted</th></tr></thead><tbody>${table}</tbody></table></body></html>`);
  });
}
