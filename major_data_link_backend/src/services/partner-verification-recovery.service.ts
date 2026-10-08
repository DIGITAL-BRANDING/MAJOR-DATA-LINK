import { Prisma, TransactionStatus, TransactionType } from '@prisma/client';
import { nanoid } from 'nanoid';
import { prisma } from '../lib/prisma.js';
import { ApiError } from '../middleware/error.js';

/** Reopens an accepted FranceVerified ticket after an erroneous local refund.
 * The upstream request is never submitted again; a new ledger debit/request
 * is created and the same FranceVerified ticket is polled by the worker. */
export async function recoverRefundedFranceVerification(transactionId: string) {
  const original = await prisma.partnerTransaction.findUnique({ where: { id: transactionId } });
  if (!original) throw new ApiError(404, 'Partner request not found.', 'PARTNER_REQUEST_NOT_FOUND');
  const originalMetadata = (original.metadata as Record<string, unknown> | null) ?? {};
  const service = typeof originalMetadata.service === 'string' ? originalMetadata.service : '';
  const ticketId = original.providerRef ?? (typeof originalMetadata.ticket_id === 'string' ? originalMetadata.ticket_id : '');
  if (original.type !== TransactionType.IDENTITY_SERVICE_REQUEST || original.status !== TransactionStatus.REVERSED || original.provider !== 'franceverified' || !ticketId || !(service === 'IPE_CLEARANCE' || service.startsWith('NIN_VALIDATION_'))) {
    throw new ApiError(409, 'Only a reversed FranceVerified NIN validation or IPE ticket can be recovered.', 'PARTNER_TICKET_NOT_RECOVERABLE');
  }

  const idempotencyKey = `manual-recovery:${original.id}`;
  return prisma.$transaction(async (tx) => {
    const priorRecovery = await tx.partnerTransaction.findUnique({ where: { partnerId_idempotencyKey: { partnerId: original.partnerId, idempotencyKey } } });
    if (priorRecovery) return { transaction: priorRecovery, alreadyRecovered: true };

    const refund = await tx.partnerTransaction.findUnique({ where: { partnerId_idempotencyKey: { partnerId: original.partnerId, idempotencyKey: `refund:${original.id}` } } });
    if (!refund || refund.type !== TransactionType.REFUND || refund.status !== TransactionStatus.SUCCESS) {
      throw new ApiError(409, 'The original request has no completed refund to recover.', 'PARTNER_REFUND_NOT_FOUND');
    }

    const partner = await tx.partner.findUnique({ where: { id: original.partnerId } });
    if (!partner || partner.status !== 'ACTIVE') throw new ApiError(403, 'Partner account is not active.', 'PARTNER_SUSPENDED');
    const debit = await tx.partner.updateMany({
      where: { id: partner.id, walletBalanceKobo: { gte: original.amountKobo } },
      data: { walletBalanceKobo: { decrement: original.amountKobo } }
    });
    if (!debit.count) throw new ApiError(400, 'Partner wallet does not have enough balance to restore this request.', 'INSUFFICIENT_BALANCE');
    const after = await tx.partner.findUniqueOrThrow({ where: { id: partner.id } });
    const { failure_reason: _failureReason, failed_at: _failedAt, ...metadata } = originalMetadata;
    const recoveryMetadata = {
      ...metadata,
      recovery: { recoveredFrom: original.id, recoveredAt: new Date().toISOString(), ticket_id: ticketId }
    } as Prisma.InputJsonValue;
    const transaction = await tx.partnerTransaction.create({
      data: {
        partnerId: original.partnerId,
        type: TransactionType.IDENTITY_SERVICE_REQUEST,
        status: TransactionStatus.PENDING,
        amountKobo: original.amountKobo,
        balanceBeforeKobo: partner.walletBalanceKobo,
        balanceAfterKobo: after.walletBalanceKobo,
        costKobo: original.costKobo,
        provider: 'franceverified',
        providerRef: ticketId,
        reference: `MDL-${Date.now()}-${nanoid(8).toUpperCase()}`,
        idempotencyKey,
        description: `Recovered ${original.description} (${original.reference})`,
        metadata: recoveryMetadata
      }
    });
    return { transaction, alreadyRecovered: false };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}
