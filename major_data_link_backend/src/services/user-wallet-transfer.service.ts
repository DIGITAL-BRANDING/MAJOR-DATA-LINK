import { nanoid } from 'nanoid';
import { Prisma, TransactionStatus, TransactionType } from '@prisma/client';
import { koboToNaira } from '../lib/money.js';
import { prisma } from '../lib/prisma.js';
import { ApiError } from '../middleware/error.js';

function transferMetadata(direction: 'incoming' | 'outgoing', transferReference: string, counterpartyName: string) {
  return { wallet_transfer: { direction, transfer_reference: transferReference, counterparty_name: counterpartyName } };
}

function sameRequest(transaction: { amountKobo: bigint; metadata: Prisma.JsonValue | null }, amountKobo: bigint, recipientId: string) {
  if (transaction.amountKobo !== amountKobo || !transaction.metadata || typeof transaction.metadata !== 'object' || Array.isArray(transaction.metadata)) return false;
  const transfer = (transaction.metadata as Record<string, unknown>).wallet_transfer;
  return Boolean(transfer && typeof transfer === 'object' && !Array.isArray(transfer) && (transfer as Record<string, unknown>).recipient_id === recipientId);
}

function transferReferenceOf(metadata: Prisma.JsonValue | null, fallback: string) {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return fallback;
  const transfer = (metadata as Record<string, unknown>).wallet_transfer;
  if (!transfer || typeof transfer !== 'object' || Array.isArray(transfer)) return fallback;
  const reference = (transfer as Record<string, unknown>).transfer_reference;
  return typeof reference === 'string' ? reference : fallback;
}

async function findRecipientByPhone(phone: string) {
  const digits = phone.replace(/\D/g, '');
  const national = digits.startsWith('234') ? `0${digits.slice(3)}` : digits.startsWith('0') ? digits : `0${digits}`;
  const localDigits = national.slice(1);
  const phoneCandidates = [...new Set([phone.trim(), national, `+234${localDigits}`, `234${localDigits}`])];
  const matches = await prisma.user.findMany({
    where: { phone: { in: phoneCandidates } },
    select: { id: true, fullName: true, phone: true, accountStatus: true }
  });
  if (matches.length > 1) throw new ApiError(409, 'This phone number matches more than one account format. Contact support before sending money.', 'TRANSFER_RECIPIENT_AMBIGUOUS');
  return matches[0] ?? null;
}

export async function lookupWalletTransferRecipient(senderId: string, phone: string) {
  const recipient = await findRecipientByPhone(phone);
  if (!recipient || recipient.accountStatus !== 'ACTIVE') throw new ApiError(404, 'No active K-Tech user was found with that phone number', 'TRANSFER_RECIPIENT_NOT_FOUND');
  if (recipient.id === senderId) throw new ApiError(400, 'You cannot transfer money to your own account', 'TRANSFER_TO_SELF');
  return { fullName: recipient.fullName, phoneLast4: recipient.phone.replace(/\D/g, '').slice(-4) };
}

export async function transferWalletToUser(params: {
  senderId: string;
  recipientPhone: string;
  amountKobo: bigint;
  idempotencyKey: string;
  retryCount?: number;
}) {
  const previous = await prisma.transaction.findFirst({
    where: { userId: params.senderId, idempotencyKey: params.idempotencyKey, type: TransactionType.WALLET_TRANSFER }
  });

  const recipient = await findRecipientByPhone(params.recipientPhone);
  if (!recipient) throw new ApiError(404, 'No active K-Tech user was found with that phone number', 'TRANSFER_RECIPIENT_NOT_FOUND');
  if (recipient.id === params.senderId) throw new ApiError(400, 'You cannot transfer money to your own account', 'TRANSFER_TO_SELF');

  if (previous) {
    if (!sameRequest(previous, params.amountKobo, recipient.id)) {
      throw new ApiError(409, 'This transfer key was already used for different details', 'IDEMPOTENCY_KEY_REUSED');
    }
    return {
      reference: previous.reference,
      transferReference: transferReferenceOf(previous.metadata, previous.reference),
      balanceAfter: koboToNaira(previous.balanceAfterKobo),
      recipientName: recipient.fullName,
      recipientId: recipient.id,
      senderName: '',
      reused: true
    };
  }
  if (recipient.accountStatus !== 'ACTIVE') throw new ApiError(404, 'No active K-Tech user was found with that phone number', 'TRANSFER_RECIPIENT_NOT_FOUND');

  const transferReference = `TRF-${Date.now()}-${nanoid(8).toUpperCase()}`;
  let result: {
    reference: string;
    transferReference: string;
    balanceAfter: number;
    recipientName: string;
    recipientId: string;
    senderName: string;
    reused: boolean;
  };

  try {
    result = await prisma.$transaction(async (tx) => {
      const [senderBefore, recipientBefore] = await Promise.all([
        tx.user.findUnique({ where: { id: params.senderId }, select: { id: true, fullName: true, walletBalanceKobo: true, accountStatus: true } }),
        tx.user.findUnique({ where: { id: recipient.id }, select: { id: true, fullName: true, walletBalanceKobo: true, accountStatus: true } })
      ]);
      if (!senderBefore || senderBefore.accountStatus !== 'ACTIVE') throw new ApiError(403, 'Your account cannot send transfers', 'TRANSFER_SENDER_INACTIVE');
      if (!recipientBefore || recipientBefore.accountStatus !== 'ACTIVE') throw new ApiError(404, 'The recipient account is unavailable', 'TRANSFER_RECIPIENT_NOT_FOUND');

      // Conditional update protects the sender from concurrent spending. The serializable
      // transaction keeps both balance snapshots and both ledger rows consistent.
      const debited = await tx.user.updateMany({
        where: { id: params.senderId, accountStatus: 'ACTIVE', walletBalanceKobo: { gte: params.amountKobo } },
        data: { walletBalanceKobo: { decrement: params.amountKobo } }
      });
      if (!debited.count) throw new ApiError(402, 'Insufficient wallet balance', 'INSUFFICIENT_BALANCE');

      const credited = await tx.user.updateMany({
        where: { id: recipient.id, accountStatus: 'ACTIVE' },
        data: { walletBalanceKobo: { increment: params.amountKobo } }
      });
      if (!credited.count) throw new ApiError(404, 'The recipient account is unavailable', 'TRANSFER_RECIPIENT_NOT_FOUND');

      const [senderAfter, recipientAfter] = await Promise.all([
        tx.user.findUniqueOrThrow({ where: { id: params.senderId }, select: { walletBalanceKobo: true } }),
        tx.user.findUniqueOrThrow({ where: { id: recipient.id }, select: { walletBalanceKobo: true } })
      ]);
      const senderBeforeKobo = senderAfter.walletBalanceKobo + params.amountKobo;
      const recipientBeforeKobo = recipientAfter.walletBalanceKobo - params.amountKobo;
      const senderReference = `${transferReference}-OUT`;
      const recipientReference = `${transferReference}-IN`;

      const outgoingMetadata = {
        wallet_transfer: { direction: 'outgoing', transfer_reference: transferReference, counterparty_name: recipient.fullName, recipient_id: recipient.id }
      };
      const incomingMetadata = transferMetadata('incoming', transferReference, senderBefore.fullName);

      await tx.transaction.createMany({
        data: [
          {
            id: nanoid(), userId: params.senderId, type: TransactionType.WALLET_TRANSFER, status: TransactionStatus.SUCCESS,
            amountKobo: params.amountKobo, balanceBeforeKobo: senderBeforeKobo, balanceAfterKobo: senderAfter.walletBalanceKobo,
            reference: senderReference, idempotencyKey: params.idempotencyKey,
            description: `Transfer to ${recipient.fullName}`, metadata: outgoingMetadata
          },
          {
            id: nanoid(), userId: recipient.id, type: TransactionType.WALLET_TRANSFER, status: TransactionStatus.SUCCESS,
            amountKobo: params.amountKobo, balanceBeforeKobo: recipientBeforeKobo, balanceAfterKobo: recipientAfter.walletBalanceKobo,
            reference: recipientReference,
            description: `Transfer from ${senderBefore.fullName}`, metadata: incomingMetadata
          }
        ]
      });

      return {
        reference: senderReference,
        transferReference,
        balanceAfter: koboToNaira(senderAfter.walletBalanceKobo),
        recipientName: recipient.fullName,
        recipientId: recipient.id,
        senderName: senderBefore.fullName,
        reused: false
      };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034' && (params.retryCount ?? 0) < 2) {
      return transferWalletToUser({ ...params, retryCount: (params.retryCount ?? 0) + 1 });
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      const duplicate = await prisma.transaction.findFirst({
        where: { userId: params.senderId, idempotencyKey: params.idempotencyKey, type: TransactionType.WALLET_TRANSFER }
      });
      if (duplicate) {
        if (!sameRequest(duplicate, params.amountKobo, recipient.id)) {
          throw new ApiError(409, 'This transfer key was already used for different details', 'IDEMPOTENCY_KEY_REUSED');
        }
        return {
          reference: duplicate.reference,
          transferReference: transferReferenceOf(duplicate.metadata, duplicate.reference),
          balanceAfter: koboToNaira(duplicate.balanceAfterKobo),
          recipientName: recipient.fullName,
          recipientId: recipient.id,
          senderName: '',
          reused: true
        };
      }
    }
    throw error;
  }

  return result;
}
