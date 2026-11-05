import { prisma } from '../lib/prisma.js';
import { sendAdminEmail } from '../lib/email.js';

type RequestSource = 'user' | 'partner';
type RequestStatus = 'SUCCESS' | 'FAILED' | 'PROCESSING' | 'PENDING' | 'REVERSED';

/** Email only the account that submitted a manual request after an admin update. */
export async function emailManualRequestStatus(params: {
  source: RequestSource;
  requesterId: string;
  reference: string;
  description: string;
  status: RequestStatus | string;
  note?: string;
}) {
  try {
    const requester = params.source === 'user'
      ? await prisma.user.findUnique({ where: { id: params.requesterId }, select: { email: true, fullName: true } })
      : await prisma.partner.findUnique({ where: { id: params.requesterId }, select: { email: true, businessName: true } });
    const email = requester?.email?.trim();
    if (!email) {
      console.warn(`[manual-request-email] no ${params.source} email for request ${params.reference}`);
      return;
    }

    const name = params.source === 'user'
      ? (requester as { fullName: string } | null)?.fullName
      : (requester as { businessName: string } | null)?.businessName;
    const statusLabels: Record<RequestStatus, string> = {
      SUCCESS: 'Completed successfully',
      FAILED: 'Failed',
      PROCESSING: 'Processing',
      PENDING: 'Pending',
      REVERSED: 'Declined and refunded'
    };
    const statusLabel = statusLabels[params.status as RequestStatus] ?? params.status.replace(/_/g, ' ');
    const message = [
      `Hello${name ? ` ${name}` : ''},`,
      '',
      `There is an update to your request: ${params.description}.`,
      `Reference: ${params.reference}`,
      `Status: ${statusLabel}`,
      ...(params.note?.trim() ? [`Admin update: ${params.note.trim()}`] : []),
      '',
      'You can view the request and any available result in your K-TECH SOLUTIONS account.'
    ].join('\n');
    const result = await sendAdminEmail({
      recipients: [email],
      subject: `Request update: ${statusLabel} (${params.reference})`,
      message
    });
    if (!result.sent) console.error(`[manual-request-email] could not email ${params.source} for ${params.reference}: ${result.error ?? 'send failed'}`);
  } catch (error) {
    // Email delivery must never undo a status change, completion, or refund.
    console.error(`[manual-request-email] failed for ${params.source} request ${params.reference}`, error);
  }
}

export async function emailUserManualTransactionStatus(transactionId: string, status: string, note?: string) {
  try {
    const transaction = await prisma.transaction.findUnique({
      where: { id: transactionId },
      select: { userId: true, reference: true, description: true }
    });
    if (!transaction) return;
    await emailManualRequestStatus({
      source: 'user',
      requesterId: transaction.userId,
      reference: transaction.reference,
      description: transaction.description,
      status,
      note
    });
  } catch (error) {
    console.error(`[manual-request-email] could not load request ${transactionId}`, error);
  }
}
