import { Prisma, TransactionStatus, TransactionType } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { openPII, mergeSealedPII } from '../lib/pii.js';
import { ApiError } from '../middleware/error.js';
import { completePartnerPurchase, reversePartnerPurchase } from './partner-wallet.service.js';

/**
 * Every manual/non-instant service a partner can submit (see
 * partner-manual-services.service.ts's eight submit* functions) lands here
 * as a PENDING PartnerTransaction of one of these types. WALLET_FUNDING is
 * excluded on purpose - that has its own dedicated review flow with
 * different semantics (crediting money in, not delivering a service).
 * IDENTITY_SERVICE_REQUEST/NIN_VERIFICATION/BVN_VERIFICATION are also
 * excluded - those already have their own completeManualVerification/
 * reverseManualVerification actions on the PartnerTransaction resource
 * (for a manually-routed verification, a different scenario).
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

export function decryptPartnerManualPII(transaction: { metadata: unknown }) {
  const metadata = transaction.metadata as Record<string, unknown> | null;
  return openPII<Record<string, unknown>>(metadata?.pii);
}

async function queuePartnerWebhook(transactionId: string) {
  // Same dynamic-import + fire-and-forget pattern already used in
  // partner-funding.service.ts, to avoid a circular import
  // (partner-webhook.service.ts pulls in other services that eventually
  // lead back here).
  const fresh = await prisma.partnerTransaction.findUnique({ where: { id: transactionId } });
  if (!fresh) return;
  void import('./partner-webhook.service.js').then(({ enqueuePartnerTransactionWebhook, deliverDuePartnerWebhooks }) =>
    enqueuePartnerTransactionWebhook(fresh)
      .then(() => deliverDuePartnerWebhooks(1))
      .catch((error) => console.error('[partner-webhooks] could not queue manual-service completion event', error))
  );
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
  if (!transaction || !MANUAL_SERVICE_TRANSACTION_TYPES.includes(transaction.type)) {
    throw new ApiError(404, 'Manual service request not found', 'MANUAL_REQUEST_NOT_FOUND');
  }
  if (transaction.status !== TransactionStatus.PENDING) {
    throw new ApiError(422, 'Only a pending request can be marked complete', 'INVALID_STATUS');
  }

  const existingMetadata = (transaction.metadata as Record<string, unknown> | null) ?? {};
  if (params.fileBase64 || params.note) {
    const sealed = mergeSealedPII(existingMetadata.pii, {
      ...(params.fileBase64 ? { delivered_file_base64: params.fileBase64, delivered_file_name: params.fileName ?? 'document', delivered_file_mime: params.fileMime ?? 'application/octet-stream' } : {}),
      ...(params.note ? { admin_note: params.note } : {})
    });
    await prisma.partnerTransaction.update({ where: { id: transaction.id }, data: { metadata: { ...existingMetadata, pii: sealed } as Prisma.InputJsonValue } });
  }

  // No real upstream provider for any of these - 'manual' plus whatever
  // costKobo was already captured at submit time (NIN/BVN Modification, CAC,
  // Newspaper Publication and Birth Attestation all set it then) so the
  // Provider Ledger still reflects what these requests actually cost,
  // recorded once, here.
  await completePartnerPurchase(transaction.id, 'manual', undefined, transaction.costKobo ?? undefined);
  await queuePartnerWebhook(transaction.id);
  return prisma.partnerTransaction.findUniqueOrThrow({ where: { id: transaction.id } });
}

/** Declines a pending manual-service request and refunds the partner's wallet, via the exact same reversePartnerPurchase() every async verification submit failure already uses. */
export async function declinePartnerManualRequest(params: { transactionId: string; reason: string }) {
  const transaction = await prisma.partnerTransaction.findUnique({ where: { id: params.transactionId } });
  if (!transaction || !MANUAL_SERVICE_TRANSACTION_TYPES.includes(transaction.type)) {
    throw new ApiError(404, 'Manual service request not found', 'MANUAL_REQUEST_NOT_FOUND');
  }
  if (transaction.status !== TransactionStatus.PENDING) {
    throw new ApiError(422, 'Only a pending request can be declined', 'INVALID_STATUS');
  }
  await reversePartnerPurchase(transaction.id, params.reason);
  await queuePartnerWebhook(transaction.id);
  return prisma.partnerTransaction.findUniqueOrThrow({ where: { id: transaction.id } });
}
