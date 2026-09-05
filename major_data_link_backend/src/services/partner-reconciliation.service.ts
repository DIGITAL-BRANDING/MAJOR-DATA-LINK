import { Prisma, TransactionStatus } from '@prisma/client';
import { ApiError } from '../middleware/error.js';
import { koboToNaira } from '../lib/money.js';
import { prisma } from '../lib/prisma.js';
import { completePartnerPurchase, reversePartnerPurchase } from './partner-wallet.service.js';

/**
 * Manual reconciliation for partner data/airtime purchases left PENDING by
 * an ambiguous provider status (BilalSadaSub's "process" - see the
 * doc-comment on normalize() in bilalsadasub.service.ts). This is the
 * data/airtime counterpart to reconcilePendingPartnerVerificationTickets()
 * in partner-verification.service.ts - that one self-resolves by actively
 * re-polling Techhub, which has a real ticket-status endpoint; BilalSadaSub
 * has no confirmed requery endpoint, so there is nothing to poll here, and
 * a human admin has to check BilalSadaSub's own merchant dashboard/support
 * for the real outcome instead. Scoped ONLY to type DATA_PURCHASE/
 * AIRTIME_PURCHASE with provider bilalsadasub - verification tickets never
 * need this path, since they already self-resolve automatically.
 */

export async function flagPartnerPendingReconciliation(params: {
  transactionId: string;
  provider: string;
  providerRef?: string;
  providerMessage?: string;
  rawStatus?: unknown;
}) {
  const existing = await prisma.partnerTransaction.findUniqueOrThrow({ where: { id: params.transactionId } });
  const existingMetadata = (existing.metadata as Record<string, unknown> | null) ?? {};

  await prisma.partnerTransaction.update({
    where: { id: params.transactionId },
    data: {
      provider: params.provider,
      providerRef: params.providerRef ?? null,
      metadata: {
        ...existingMetadata,
        reconciliation: {
          flaggedAt: new Date().toISOString(),
          providerMessage: params.providerMessage ?? null,
          rawStatus: params.rawStatus ?? null
        }
      } as Prisma.InputJsonValue
    }
  });

  console.error(
    `[reconcile][partner][${params.provider}] partner transaction ${params.transactionId} left PENDING - provider returned an ambiguous in-progress status, needs manual review at /admin/provider-reconciliation`
  );
}

export type PendingPartnerReconciliationRow = Prisma.PartnerTransactionGetPayload<{
  include: { partner: { select: { id: true; businessName: true; email: true } } };
}>;

export async function listPendingPartnerReconciliations(): Promise<PendingPartnerReconciliationRow[]> {
  return prisma.partnerTransaction.findMany({
    where: {
      status: TransactionStatus.PENDING,
      // Only rows flagPendingReconciliation() above actually flagged -
      // reconcilePendingPartnerVerificationTickets() handles the
      // Techhub/IDENTITY_SERVICE_REQUEST side entirely on its own, so those
      // never get this metadata key and never need to show up here.
      metadata: { path: ['reconciliation'], not: Prisma.JsonNull }
    },
    orderBy: { createdAt: 'asc' },
    include: { partner: { select: { id: true, businessName: true, email: true } } }
  });
}

async function loadResolvablePartnerTransaction(transactionId: string) {
  const transaction = await prisma.partnerTransaction.findUnique({ where: { id: transactionId } });
  if (!transaction) throw new ApiError(404, 'Partner transaction not found', 'TRANSACTION_NOT_FOUND');
  return transaction;
}

/**
 * Admin has confirmed (via BilalSadaSub's own dashboard/support) that the
 * partner's purchase actually went through. Delegates to
 * completePartnerPurchase() - the same function the live purchase route
 * uses on a confirmed success - so the provider ledger debit and the
 * partner's `transaction.updated` webhook happen exactly the same way here
 * as they would have for an immediate success.
 */
export async function resolvePartnerReconciliationAsSuccess(params: {
  transactionId: string;
  adminId: string;
  providerRef?: string;
  costKobo?: bigint;
  note?: string;
}) {
  const transaction = await loadResolvablePartnerTransaction(params.transactionId);
  if (transaction.status !== TransactionStatus.PENDING) {
    return { transaction, alreadyResolved: true as const };
  }

  const existingMetadata = (transaction.metadata as Record<string, unknown> | null) ?? {};
  // For data/airtime the partner is charged our exact wholesale cost with no
  // markup (see PARTNER_API_DOCUMENTATION.md's pricing section), so
  // amountKobo already IS our cost when no more specific figure was given.
  const finalCostKobo = params.costKobo ?? transaction.costKobo ?? transaction.amountKobo;
  const resolvedProvider = transaction.provider ?? 'unknown';

  await prisma.partnerTransaction.update({
    where: { id: transaction.id },
    data: {
      metadata: {
        ...existingMetadata,
        reconciliation: {
          ...((existingMetadata.reconciliation as Record<string, unknown> | undefined) ?? {}),
          resolvedAt: new Date().toISOString(),
          resolvedByAdminId: params.adminId,
          resolvedAs: 'success',
          note: params.note ?? null
        }
      } as Prisma.InputJsonValue
    }
  });

  const updated = await completePartnerPurchase(transaction.id, resolvedProvider, params.providerRef ?? transaction.providerRef ?? undefined, finalCostKobo);
  return { transaction: updated, alreadyResolved: false as const };
}

/**
 * Admin has confirmed the partner's purchase did NOT go through. Delegates
 * to reversePartnerPurchase() - the same refund path (and webhook) the live
 * purchase route uses on a confirmed failure.
 */
export async function resolvePartnerReconciliationAsFailed(params: {
  transactionId: string;
  adminId: string;
  reason: string;
}) {
  const transaction = await loadResolvablePartnerTransaction(params.transactionId);
  if (transaction.status !== TransactionStatus.PENDING) {
    return { transaction, alreadyResolved: true as const };
  }

  const existingMetadata = (transaction.metadata as Record<string, unknown> | null) ?? {};

  await prisma.partnerTransaction.update({
    where: { id: transaction.id },
    data: {
      metadata: {
        ...existingMetadata,
        reconciliation: {
          ...((existingMetadata.reconciliation as Record<string, unknown> | undefined) ?? {}),
          resolvedAt: new Date().toISOString(),
          resolvedByAdminId: params.adminId,
          resolvedAs: 'failed',
          note: params.reason
        }
      } as Prisma.InputJsonValue
    }
  });

  const reversed = await reversePartnerPurchase(transaction.id, params.reason);
  return { transaction: reversed, alreadyResolved: false as const, balanceAfter: koboToNaira(reversed.balanceAfterKobo) };
}
