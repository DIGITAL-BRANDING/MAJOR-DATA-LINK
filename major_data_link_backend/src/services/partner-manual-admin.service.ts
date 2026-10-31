import { Prisma, TransactionStatus, TransactionType } from '@prisma/client';
import { notifyPartnerSafely } from './notification.service.js';
import { prisma } from '../lib/prisma.js';
import { openPII, mergeSealedPII } from '../lib/pii.js';
import { ApiError } from '../middleware/error.js';
import { completePartnerPurchase, reversePartnerPurchase } from './partner-wallet.service.js';
import { enqueuePartnerRequestUpdateWebhook, deliverDuePartnerWebhooks } from './partner-webhook.service.js';

/**
 * Every manual/non-instant service a partner can submit (see
 * partner-manual-services.service.ts's eight submit* functions) lands here
 * as a PENDING PartnerTransaction of one of these types. WALLET_FUNDING is
 * excluded on purpose - that has its own dedicated review flow with
 * different semantics (crediting money in, not delivering a service).
 * IDENTITY_SERVICE_REQUEST/NIN_VERIFICATION/BVN_VERIFICATION are also
 * excluded from this list because only the ones explicitly routed to the
 * manual provider are actionable by an admin (see
 * isAdminManageablePartnerRequest below).
 */
export const MANUAL_SERVICE_TRANSACTION_TYPES: TransactionType[] = [
  TransactionType.NIN_MODIFICATION,
  TransactionType.BVN_MODIFICATION,
  TransactionType.BVN_CRM,
  TransactionType.BVN_LICENSE_ONBOARDING,
  TransactionType.NEWSPAPER_PUBLICATION,
  TransactionType.BIRTH_ATTESTATION,
  TransactionType.CAC_SERVICE_REQUEST,
  TransactionType.JAMB_SERVICE_REQUEST
];

const MANUAL_VERIFICATION_TYPES: TransactionType[] = [
  TransactionType.IDENTITY_SERVICE_REQUEST,
  TransactionType.NIN_VERIFICATION,
  TransactionType.BVN_VERIFICATION
];

/** Requests which can be fulfilled by an admin, including a provider that was deliberately routed to manual. */
export function isAdminManageablePartnerRequest(transaction: { type: TransactionType; provider?: string | null }) {
  return MANUAL_SERVICE_TRANSACTION_TYPES.includes(transaction.type) ||
    (MANUAL_VERIFICATION_TYPES.includes(transaction.type) && transaction.provider === 'manual');
}

export function decryptPartnerManualPII(transaction: { metadata: unknown }) {
  const metadata = transaction.metadata as Record<string, unknown> | null;
  return openPII<Record<string, unknown>>(metadata?.pii);
}

/**
 * Marks a pending manual-service request done. A delivered file is
 * OPTIONAL: NIN/BVN Modification, BVN CRM, and BVN License Onboarding have
 * nothing further to hand back (the submission PDF already generated at
 * submit time *is* the deliverable an admin acts on externally) - for
 * those, leave file fields undefined and this just flips the status.
 * Newspaper Publication, Birth Attestation, CAC, and JAMB genuinely produce
 * a final document (a certificate, a gazette clipping, a JAMB printout) -
 * attach it and it is stored on the transaction's own sealed metadata,
 * retrievable by the partner from GET /identity/requests/:reference, and a
 * webhook fires either way so the partner does not have to poll.
 */
export async function completePartnerManualRequest(params: {
  transactionId: string;
  fileBase64?: string;
  fileName?: string;
  fileMime?: string;
  note?: string;
}) {
  const transaction = await prisma.partnerTransaction.findUnique({ where: { id: params.transactionId } });
  if (!transaction || !isAdminManageablePartnerRequest(transaction)) {
    throw new ApiError(404, 'Manual service request not found', 'MANUAL_REQUEST_NOT_FOUND');
  }
  if (transaction.status !== TransactionStatus.PENDING && transaction.status !== TransactionStatus.PROCESSING) {
    throw new ApiError(422, 'Only an active request can be marked complete', 'INVALID_STATUS');
  }

  const existingMetadata = (transaction.metadata as Record<string, unknown> | null) ?? {};
  let completionMetadata: Record<string, unknown> | undefined;
  if (params.fileBase64 || params.note) {
    const sealed = mergeSealedPII(existingMetadata.pii, {
      ...(params.fileBase64 ? { delivered_file_base64: params.fileBase64, delivered_file_name: params.fileName ?? 'document', delivered_file_mime: params.fileMime ?? 'application/octet-stream' } : {}),
      ...(params.note ? { admin_note: params.note } : {})
    });
    completionMetadata = { pii: sealed };
  }

  // No real upstream provider for any of these - 'manual' plus whatever
  // costKobo was already captured at submit time (NIN/BVN Modification, CAC,
  // Newspaper Publication and Birth Attestation all set it then) so the
  // Provider Ledger still reflects what these requests actually cost,
  // recorded once, here.
  // Retain the MANUAL-* ticket issued at submission so the partner's
  // completion webhook and subsequent status checks can identify this row.
  await completePartnerPurchase(transaction.id, 'manual', transaction.providerRef ?? undefined, transaction.costKobo ?? undefined, undefined, completionMetadata);
  notifyPartnerSafely({
    partnerId: transaction.partnerId,
    type: 'TRANSACTION',
    title: 'Request completed',
    body: `${transaction.description} (${transaction.reference}) is complete. Open your portal to view the result.`,
    data: { reference: transaction.reference }
  });
  return prisma.partnerTransaction.findUniqueOrThrow({ where: { id: transaction.id } });
}

/** Marks a manually handled partner request as in progress and notifies the partner via API/webhook. */
export async function markPartnerManualRequestProcessing(params: { transactionId: string; note?: string }) {
  const transaction = await prisma.partnerTransaction.findUnique({ where: { id: params.transactionId } });
  if (!transaction || !isAdminManageablePartnerRequest(transaction)) {
    throw new ApiError(404, 'Manual service request not found', 'MANUAL_REQUEST_NOT_FOUND');
  }
  if (transaction.status !== TransactionStatus.PENDING && transaction.status !== TransactionStatus.PROCESSING) {
    throw new ApiError(422, 'Only an active request can be marked processing', 'INVALID_STATUS');
  }
  const updated = await prisma.partnerTransaction.update({
    where: { id: transaction.id },
    data: { status: TransactionStatus.PROCESSING }
  });
  const message = params.note?.trim() || 'Your request is now being processed.';
  const update = await prisma.partnerRequestUpdate.create({
    data: { partnerId: updated.partnerId, partnerTransactionId: updated.id, message }
  });
  await enqueuePartnerRequestUpdateWebhook({
    partnerId: updated.partnerId,
    reference: updated.reference,
    updateId: update.id,
    message,
    status: TransactionStatus.PROCESSING
  });
  void deliverDuePartnerWebhooks(1).catch((error) => console.error('[partner-webhooks] could not deliver processing update', error));
  notifyPartnerSafely({
    partnerId: updated.partnerId,
    type: 'TRANSACTION',
    title: 'Request is processing',
    body: `${updated.description} (${updated.reference}) is now being processed.`,
    data: { reference: updated.reference, status: 'processing' }
  });
  return updated;
}

/** Declines a pending manual-service request and refunds the partner's wallet, via the exact same reversePartnerPurchase() every async verification submit failure already uses. */
export async function declinePartnerManualRequest(params: { transactionId: string; reason: string }) {
  const transaction = await prisma.partnerTransaction.findUnique({ where: { id: params.transactionId } });
  if (!transaction || !isAdminManageablePartnerRequest(transaction)) {
    throw new ApiError(404, 'Manual service request not found', 'MANUAL_REQUEST_NOT_FOUND');
  }
  if (transaction.status !== TransactionStatus.PENDING && transaction.status !== TransactionStatus.PROCESSING) {
    throw new ApiError(422, 'Only an active request can be declined', 'INVALID_STATUS');
  }
  await reversePartnerPurchase(transaction.id, params.reason);
  notifyPartnerSafely({
    partnerId: transaction.partnerId,
    type: 'TRANSACTION',
    title: 'Request declined and refunded',
    body: `${transaction.description} (${transaction.reference}) was declined: ${params.reason}. The amount has been refunded to your wallet.`,
    data: { reference: transaction.reference }
  });
  return prisma.partnerTransaction.findUniqueOrThrow({ where: { id: transaction.id } });
}
