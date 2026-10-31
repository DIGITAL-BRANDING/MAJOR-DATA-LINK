import { TransactionType } from '@prisma/client';
import { env } from '../config/env.js';
import { prisma } from '../lib/prisma.js';
import { sendAdminEmail } from '../lib/email.js';

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

/** Email all active admin accounts when a new request enters a manual queue. */
export async function emailAdminsForManualRequest(params: {
  source: 'Customer' | 'Partner';
  reference: string;
  type: TransactionType;
  description: string;
  createdAt: Date;
}) {
  try {
    const admins = await prisma.adminUser.findMany({ where: { isActive: true }, select: { email: true } });
    const recipients = [...new Set(admins.map((admin) => admin.email.trim().toLowerCase()).filter(Boolean))];
    if (!recipients.length) {
      console.warn('[manual-request-email] no active admin recipients are configured');
      return;
    }

    const queueUrl = `${env.PUBLIC_WEB_URL.replace(/\/$/, '')}/admin/manual-requests`;
    const message = [
      'A new request has been submitted and is waiting for manual processing.',
      '',
      `Source: ${params.source}`,
      `Request: ${params.description}`,
      `Type: ${params.type.replace(/_/g, ' ')}`,
      `Reference: ${params.reference}`,
      `Submitted: ${params.createdAt.toLocaleString('en-GB', { timeZone: 'Africa/Lagos' })} (Africa/Lagos)`,
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
