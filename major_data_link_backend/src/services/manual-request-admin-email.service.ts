import { TransactionType } from '@prisma/client';
import { env } from '../config/env.js';
import { prisma } from '../lib/prisma.js';
import { sendAdminEmail } from '../lib/email.js';
import { openPII } from '../lib/pii.js';

const MANUAL_REQUEST_TYPES = new Set<TransactionType>([
  TransactionType.NIN_MODIFICATION,
  TransactionType.BVN_MODIFICATION,
  TransactionType.BVN_CRM,
  TransactionType.BVN_LICENSE_ONBOARDING,
  TransactionType.NEWSPAPER_PUBLICATION,
  TransactionType.BIRTH_ATTESTATION,
  TransactionType.CAC_SERVICE_REQUEST,
  TransactionType.JAMB_SERVICE_REQUEST,
  TransactionType.SCHOOL_WEBSITE_SUBSCRIPTION,
  TransactionType.TIN_SERVICE_REQUEST
]);

const MANUAL_VERIFICATION_TYPES = new Set<TransactionType>([
  TransactionType.IDENTITY_SERVICE_REQUEST,
  TransactionType.NIN_VERIFICATION,
  TransactionType.BVN_VERIFICATION
]);

export function isManualRequestSubmission(params: {
  type: TransactionType;
  provider?: string | null;
  metadata?: unknown;
}) {
  if (MANUAL_REQUEST_TYPES.has(params.type)) return true;
  if (!MANUAL_VERIFICATION_TYPES.has(params.type)) return false;
  const metadata = params.metadata as Record<string, unknown> | null | undefined;
  return params.provider === 'manual' || params.provider === 'hubbu' || metadata?.manual_processing === true;
}

function requestFields(metadata: unknown) {
  const values = (metadata && typeof metadata === 'object' ? metadata : {}) as Record<string, unknown>;
  const hiddenKey = /(pdf|base64|image|photo|document|file|raw|token|password|secret|hash|response|url)/i;
  const entries: Array<[string, unknown]> = [];
  for (const [key, value] of Object.entries(values)) {
    if (key === 'pii' || hiddenKey.test(key) || value == null) continue;
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') entries.push([key, value]);
  }
  const pii = openPII<Record<string, unknown>>(values.pii);
  if (pii) {
    for (const [key, value] of Object.entries(pii)) {
      if (!hiddenKey.test(key) && value != null && (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean')) entries.push([key, value]);
    }
  }
  return entries.map(([key, value]) => `- ${key.replace(/_/g, ' ')}: ${String(value)}`).join('\n') || '- No additional fields';
}

/** Email active Super Admin accounts when a new request enters a manual queue. */
export async function emailAdminsForManualRequest(params: {
  source: 'Customer' | 'Partner';
  requesterId: string;
  reference: string;
  type: TransactionType;
  description: string;
  createdAt: Date;
  amountKobo: bigint;
  metadata: unknown;
}) {
  try {
    const [admins, requester] = await Promise.all([
      prisma.adminUser.findMany({ where: { isActive: true, role: 'SUPER_ADMIN' }, select: { email: true } }),
      params.source === 'Customer'
        ? prisma.user.findUnique({ where: { id: params.requesterId }, select: { fullName: true, email: true } })
        : prisma.partner.findUnique({ where: { id: params.requesterId }, select: { businessName: true, email: true } })
    ]);
    const recipients = [...new Set(admins.map((admin) => admin.email.trim().toLowerCase()).filter(Boolean))];
    if (!recipients.length) {
      console.warn('[manual-request-email] no active admin recipients are configured');
      return;
    }

    const queueUrl = `${env.PUBLIC_WEB_URL.replace(/\/$/, '')}/admin/manual-requests`;
    const requesterName = requester
      ? ('fullName' in requester ? requester.fullName : requester.businessName)
      : params.source;
    const message = [
      'A new request has been submitted and is waiting for manual processing.',
      '',
      `Source: ${params.source}`,
      `Submitted by: ${requesterName}`,
      `Email: ${requester?.email ?? 'Unavailable'}`,
      `Request: ${params.description}`,
      `Type: ${params.type.replace(/_/g, ' ')}`,
      `Reference: ${params.reference}`,
      `Amount: NGN${(Number(params.amountKobo) / 100).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      `Submitted: ${params.createdAt.toLocaleString('en-GB', { timeZone: 'Africa/Lagos' })} (Africa/Lagos)`,
      '',
      'Request details:',
      requestFields(params.metadata),
      '',
      `Open the manual request queue: ${queueUrl}`
    ].join('\n');

    const result = await sendAdminEmail({ recipients, subject: 'New manual request submitted', message });
    if (!result.sent || (result.failed ?? 0) > 0) {
      console.error('[manual-request-email] admin notification email was not accepted for every recipient', {
        sent: result.sent, delivered: result.delivered, failed: result.failed, error: result.error
      });
    }
  } catch (error) {
    console.error('[manual-request-email] could not notify admins about a manual request', error instanceof Error ? error.message : 'unknown error');
  }
}
