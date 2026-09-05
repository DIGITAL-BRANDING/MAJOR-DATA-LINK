import { Prisma, TransactionStatus, TransactionType } from '@prisma/client';
import { nanoid } from 'nanoid';
import { koboToNaira, nairaToKobo } from '../lib/money.js';
import { prisma } from '../lib/prisma.js';
import { ApiError } from '../middleware/error.js';

export async function debitPartnerWallet(input: {
  partnerId: string;
  amount: number;
  type: TransactionType;
  description: string;
  metadata: Prisma.InputJsonValue;
  idempotencyKey: string;
}) {
  const existing = await prisma.partnerTransaction.findUnique({
    where: { partnerId_idempotencyKey: { partnerId: input.partnerId, idempotencyKey: input.idempotencyKey } }
  });
  if (existing) return { transaction: existing, reused: true };

  const amountKobo = nairaToKobo(input.amount);
  return prisma.$transaction(async (tx) => {
    const replay = await tx.partnerTransaction.findUnique({
      where: { partnerId_idempotencyKey: { partnerId: input.partnerId, idempotencyKey: input.idempotencyKey } }
    });
    if (replay) return { transaction: replay, reused: true };

    const partner = await tx.partner.findUnique({ where: { id: input.partnerId } });
    if (!partner || partner.status !== 'ACTIVE') throw new ApiError(403, 'Partner account is not active', 'PARTNER_SUSPENDED');
    if (partner.walletBalanceKobo < amountKobo) {
      throw new ApiError(400, 'Insufficient partner wallet balance', 'INSUFFICIENT_BALANCE');
    }
    const balanceAfterKobo = partner.walletBalanceKobo - amountKobo;
    await tx.partner.update({ where: { id: partner.id }, data: { walletBalanceKobo: balanceAfterKobo } });
    const transaction = await tx.partnerTransaction.create({
      data: {
        partnerId: partner.id,
        type: input.type,
        amountKobo,
        balanceBeforeKobo: partner.walletBalanceKobo,
        balanceAfterKobo,
        reference: `MDL-${Date.now()}-${nanoid(8).toUpperCase()}`,
        idempotencyKey: input.idempotencyKey,
        description: input.description,
        metadata: input.metadata
      }
    });
    return { transaction, reused: false };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function completePartnerPurchase(transactionId: string, provider: string, providerRef?: string) {
  const transaction = await prisma.partnerTransaction.update({
    where: { id: transactionId },
    data: { status: TransactionStatus.SUCCESS, provider, providerRef: providerRef ?? null }
  });
  void import('./partner-webhook.service.js').then(({ enqueuePartnerTransactionWebhook, deliverDuePartnerWebhooks }) =>
    enqueuePartnerTransactionWebhook(transaction).then(() => deliverDuePartnerWebhooks(1)).catch((error) => console.error('[partner-webhooks] could not queue success event', error))
  );
  return transaction;
}

export async function reversePartnerPurchase(transactionId: string, message: string) {
  const transaction = await prisma.$transaction(async (tx) => {
    const original = await tx.partnerTransaction.findUniqueOrThrow({ where: { id: transactionId } });
    if (original.status !== TransactionStatus.PENDING) return original;
    const partner = await tx.partner.findUniqueOrThrow({ where: { id: original.partnerId } });
    const balanceAfterKobo = partner.walletBalanceKobo + original.amountKobo;
    await tx.partner.update({ where: { id: partner.id }, data: { walletBalanceKobo: balanceAfterKobo } });
    await tx.partnerTransaction.update({ where: { id: original.id }, data: { status: TransactionStatus.REVERSED } });
    await tx.partnerTransaction.create({
      data: {
        partnerId: original.partnerId,
        type: TransactionType.REFUND,
        status: TransactionStatus.SUCCESS,
        amountKobo: original.amountKobo,
        balanceBeforeKobo: partner.walletBalanceKobo,
        balanceAfterKobo,
        reference: `${original.reference}-R`,
        idempotencyKey: `refund:${original.id}`,
        description: `Refund for ${original.reference}: ${message}`,
        metadata: { original_reference: original.reference }
      }
    });
    return { ...original, status: TransactionStatus.REVERSED, balanceAfterKobo };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  void import('./partner-webhook.service.js').then(({ enqueuePartnerTransactionWebhook, deliverDuePartnerWebhooks }) =>
    enqueuePartnerTransactionWebhook(transaction).then(() => deliverDuePartnerWebhooks(1)).catch((error) => console.error('[partner-webhooks] could not queue reversal event', error))
  );
  return transaction;
}

export function partnerTransactionResponse(tx: { reference: string; status: TransactionStatus; amountKobo: bigint; balanceAfterKobo: bigint; type: TransactionType; createdAt: Date }) {
  return {
    reference: tx.reference,
    status: tx.status.toLowerCase(),
    type: tx.type.toLowerCase(),
    amount: koboToNaira(tx.amountKobo),
    balance_after: koboToNaira(tx.balanceAfterKobo),
    created_at: tx.createdAt.toISOString()
  };
}
