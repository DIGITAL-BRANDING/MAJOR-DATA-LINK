import bcrypt from 'bcryptjs';
import { nanoid } from 'nanoid';
import { Prisma, TransactionStatus, TransactionType } from '@prisma/client';
import { ApiError } from '../middleware/error.js';
import { koboToNaira, nairaToKobo } from '../lib/money.js';
import { prisma } from '../lib/prisma.js';
import { notifyUser } from './notification.service.js';

function formatNaira(kobo: bigint) {
  return `NGN${koboToNaira(kobo).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export async function setPin(userId: string, pin: string) {
  if (!/^\d{4}$/.test(pin)) throw new ApiError(422, 'PIN must be 4 digits', 'INVALID_PIN');
  const pinHash = await bcrypt.hash(pin, 12);
  await prisma.user.update({ where: { id: userId }, data: { pinHash, pinFailures: 0, pinLockedUntil: null } });
}

export async function verifyPin(userId: string, pin: string) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  if (user.pinLockedUntil && user.pinLockedUntil > new Date()) {
    throw new ApiError(423, 'PIN is temporarily locked', 'PIN_LOCKED');
  }
  if (!user.pinHash) throw new ApiError(400, 'Transaction PIN has not been set', 'PIN_NOT_SET');

  const ok = await bcrypt.compare(pin, user.pinHash);
  if (!ok) {
    const failures = user.pinFailures + 1;
    await prisma.user.update({
      where: { id: userId },
      data: {
        pinFailures: failures,
        pinLockedUntil: failures >= 5 ? new Date(Date.now() + 30 * 60 * 1000) : null
      }
    });
    throw new ApiError(401, 'Invalid transaction PIN', 'INVALID_PIN');
  }

  await prisma.user.update({ where: { id: userId }, data: { pinFailures: 0, pinLockedUntil: null } });
  return true;
}

export type DebitResult = {
  transaction: Prisma.TransactionGetPayload<Record<string, never>>;
  reference: string;
  balanceAfter: number;
  /** true when an existing transaction with the same idempotency key was returned instead of creating a new debit */
  reused: boolean;
};

/**
 * Debits a user's wallet atomically and idempotently.
 *
 * - Atomic: uses a conditional `updateMany` (WHERE balance >= amount) so two concurrent
 *   requests can never both succeed against the same balance (no read-then-write race).
 * - Idempotent: if `idempotencyKey` is provided and a transaction with that key already
 *   exists for this user, the existing transaction is returned instead of debiting again.
 *   Callers (route handlers) should check `reused` and, if the prior transaction already
 *   reached a final state (SUCCESS/FAILED/REVERSED), skip calling the provider again.
 */
export async function debitWallet(params: {
  userId: string;
  amount: number;
  type: TransactionType;
  description: string;
  metadata?: Prisma.InputJsonValue;
  idempotencyKey?: string;
}): Promise<DebitResult> {
  if (params.idempotencyKey) {
    const existing = await prisma.transaction.findFirst({
      where: { userId: params.userId, idempotencyKey: params.idempotencyKey }
    });
    if (existing) {
      return {
        transaction: existing,
        reference: existing.reference,
        balanceAfter: koboToNaira(existing.balanceAfterKobo),
        reused: true
      };
    }
  }

  const amountKobo = nairaToKobo(params.amount);
  const reference = `IDS-${Date.now()}-${nanoid(8).toUpperCase()}`;

  return prisma.$transaction(async (tx) => {
    const before = await tx.user.findUnique({ where: { id: params.userId } });
    if (!before) throw new ApiError(404, 'User not found', 'USER_NOT_FOUND');

    // Conditional update: only decrements if the balance is still sufficient at write time.
    // This closes the race window that a read-then-write (findUnique + update) leaves open
    // between two concurrent debits.
    const updateResult = await tx.user.updateMany({
      where: { id: params.userId, walletBalanceKobo: { gte: amountKobo } },
      data: { walletBalanceKobo: { decrement: amountKobo } }
    });

    if (updateResult.count === 0) {
      throw new ApiError(402, 'Insufficient wallet balance', 'INSUFFICIENT_BALANCE');
    }

    const after = await tx.user.findUniqueOrThrow({ where: { id: params.userId } });

    let transaction;
    try {
      transaction = await tx.transaction.create({
        data: {
          id: nanoid(),
          userId: params.userId,
          type: params.type,
          status: TransactionStatus.PENDING,
          amountKobo,
          balanceBeforeKobo: before.walletBalanceKobo,
          balanceAfterKobo: after.walletBalanceKobo,
          reference,
          idempotencyKey: params.idempotencyKey,
          description: params.description,
          metadata: params.metadata
        }
      });
    } catch (error) {
      // Unique constraint race: two requests with the same idempotency key arrived
      // at (almost) the same time and both passed the initial lookup above.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ApiError(409, 'Duplicate request', 'DUPLICATE_IDEMPOTENCY_KEY');
      }
      throw error;
    }

    return {
      transaction,
      reference,
      balanceAfter: koboToNaira(after.walletBalanceKobo),
      reused: false
    };
  });
}

/**
 * Records a wallet funding attempt as PENDING before redirecting the user to Paystack.
 * The balance is NOT touched here - it only changes once the payment is confirmed via
 * `creditWalletByReference`, which is called from the webhook (and can also be called
 * from a manual "verify payment" endpoint as a fallback if the webhook is ever missed).
 */
export async function createPendingFunding(params: {
  userId: string;
  amount: number;
  reference: string;
  metadata?: Prisma.InputJsonValue;
}) {
  const amountKobo = nairaToKobo(params.amount);
  const user = await prisma.user.findUniqueOrThrow({ where: { id: params.userId } });

  return prisma.transaction.create({
    data: {
      id: nanoid(),
      userId: params.userId,
      type: TransactionType.WALLET_FUNDING,
      status: TransactionStatus.PENDING,
      amountKobo,
      balanceBeforeKobo: user.walletBalanceKobo,
      balanceAfterKobo: user.walletBalanceKobo, // unchanged until the payment is confirmed
      reference: params.reference,
      description: 'Wallet funding via Paystack',
      metadata: params.metadata
    }
  });
}

/**
 * Confirms a funding transaction and credits the wallet. Idempotent: if the transaction
 * is already SUCCESS (e.g. the webhook fired twice, which Paystack does not guarantee
 * against), this is a no-op and returns the existing record without crediting again.
 */
export async function creditWalletByReference(reference: string) {
  const result = await prisma.$transaction(async (tx) => {
    const transaction = await tx.transaction.findUnique({ where: { reference } });
    if (!transaction) throw new ApiError(404, 'Transaction not found', 'TRANSACTION_NOT_FOUND');
    if (transaction.status === TransactionStatus.SUCCESS) return { transaction, alreadyCredited: true };

    const user = await tx.user.update({
      where: { id: transaction.userId },
      data: { walletBalanceKobo: { increment: transaction.amountKobo } }
    });

    const updated = await tx.transaction.update({
      where: { id: transaction.id },
      data: { status: TransactionStatus.SUCCESS, balanceAfterKobo: user.walletBalanceKobo }
    });

    return { transaction: updated, alreadyCredited: false };
  });

  // Fired only for THIS transaction's userId, and only once (skipped on the
  // idempotent replay branch above) - never a broadcast to every user.
  if (!result.alreadyCredited) {
    await notifyUser({
      userId: result.transaction.userId,
      type: 'WALLET',
      title: 'Wallet funded',
      body: `Your wallet was credited with ${formatNaira(result.transaction.amountKobo)}. New balance: ${formatNaira(result.transaction.balanceAfterKobo)}.`,
      data: { transactionId: result.transaction.id, reference: result.transaction.reference }
    });
  }

  return result.transaction;
}

/**
 * Credits a wallet for a bank transfer that arrived with NO pre-created pending
 * transaction - i.e. the user transferred directly into their permanent Dedicated
 * Virtual Account out-of-band, rather than going through /wallet/fund or
 * /wallet/fund/dynamic. The webhook calls this once it's confirmed (via
 * `verifyTransaction`) that no existing transaction matches the reference.
 *
 * Idempotent: `reference` is Paystack's own transaction reference, which is
 * globally unique, and `Transaction.reference` has a unique constraint - so if
 * Paystack redelivers the same webhook, the second insert fails with P2002 and we
 * simply return the transaction the first delivery already created.
 */
export async function creditDirectDeposit(params: {
  reference: string;
  amountKobo: bigint;
  customerCode: string;
  channel: string;
}) {
  const user = await prisma.user.findFirst({ where: { paystackCustomerCode: params.customerCode } });
  if (!user) {
    throw new ApiError(404, 'No wallet matches this payment\'s customer', 'USER_NOT_FOUND_FOR_PAYMENT');
  }

  try {
    const transaction = await prisma.$transaction(async (tx) => {
      const before = await tx.user.findUniqueOrThrow({ where: { id: user.id } });
      const after = await tx.user.update({
        where: { id: user.id },
        data: { walletBalanceKobo: { increment: params.amountKobo } }
      });

      return tx.transaction.create({
        data: {
          id: nanoid(),
          userId: user.id,
          type: TransactionType.WALLET_FUNDING,
          status: TransactionStatus.SUCCESS,
          amountKobo: params.amountKobo,
          balanceBeforeKobo: before.walletBalanceKobo,
          balanceAfterKobo: after.walletBalanceKobo,
          provider: 'paystack',
          providerRef: params.reference,
          reference: params.reference,
          description: `Wallet funded via direct bank transfer (${params.channel})`,
          metadata: { channel: params.channel, customerCode: params.customerCode }
        }
      });
    });

    // Scoped to this one depositor (resolved above by their unique paystackCustomerCode)
    // - every other user's wallet and notification feed is untouched.
    await notifyUser({
      userId: transaction.userId,
      type: 'WALLET',
      title: 'Wallet funded',
      body: `Your wallet was credited with ${formatNaira(transaction.amountKobo)} via bank transfer. New balance: ${formatNaira(transaction.balanceAfterKobo)}.`,
      data: { transactionId: transaction.id, reference: transaction.reference }
    });

    return transaction;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return prisma.transaction.findUniqueOrThrow({ where: { reference: params.reference } });
    }
    throw error;
  }
}

/**
 * Redeems a prepaid "Fund with Coupon" code and credits its value to the user's
 * wallet. Atomic: the `updateMany` claim only succeeds if the coupon is still
 * unredeemed at write time, so two requests racing to redeem the same code can't
 * both succeed (same guard pattern as debitWallet's balance check).
 */
export async function redeemCoupon(userId: string, rawCode: string) {
  const code = rawCode.trim().toUpperCase();

  const result = await prisma.$transaction(async (tx) => {
    const coupon = await tx.coupon.findUnique({ where: { code } });
    if (!coupon) throw new ApiError(404, 'Invalid coupon code', 'COUPON_NOT_FOUND');
    if (coupon.isRedeemed) throw new ApiError(409, 'This coupon has already been used', 'COUPON_ALREADY_REDEEMED');
    if (coupon.expiresAt && coupon.expiresAt < new Date()) {
      throw new ApiError(410, 'This coupon has expired', 'COUPON_EXPIRED');
    }

    const claim = await tx.coupon.updateMany({
      where: { code, isRedeemed: false },
      data: { isRedeemed: true, redeemedByUserId: userId, redeemedAt: new Date() }
    });
    if (claim.count === 0) {
      // Lost the race to another request redeeming the same code at the same time.
      throw new ApiError(409, 'This coupon has already been used', 'COUPON_ALREADY_REDEEMED');
    }

    const before = await tx.user.findUniqueOrThrow({ where: { id: userId } });
    const after = await tx.user.update({
      where: { id: userId },
      data: { walletBalanceKobo: { increment: coupon.valueKobo } }
    });

    const transaction = await tx.transaction.create({
      data: {
        id: nanoid(),
        userId,
        type: TransactionType.COUPON_REDEMPTION,
        status: TransactionStatus.SUCCESS,
        amountKobo: coupon.valueKobo,
        balanceBeforeKobo: before.walletBalanceKobo,
        balanceAfterKobo: after.walletBalanceKobo,
        reference: `IDS-CPN-${Date.now()}-${nanoid(8).toUpperCase()}`,
        description: `Wallet funded via coupon ${code}`,
        metadata: { couponId: coupon.id }
      }
    });

    return { transaction, balanceAfter: koboToNaira(after.walletBalanceKobo) };
  });

  await notifyUser({
    userId,
    type: 'WALLET',
    title: 'Coupon redeemed',
    body: `${formatNaira(result.transaction.amountKobo)} was added to your wallet from coupon ${code}. New balance: ${formatNaira(result.transaction.balanceAfterKobo)}.`,
    data: { transactionId: result.transaction.id }
  });

  return result;
}

/** Marks a pending funding attempt as failed (payment declined, expired, etc). Idempotent. */
export async function markFundingFailed(reference: string) {
  return prisma.transaction.updateMany({
    where: { reference, status: TransactionStatus.PENDING },
    data: { status: TransactionStatus.FAILED }
  });
}

/**
 * Admin-initiated wallet credit or debit (e.g. compensating a customer, correcting an
 * error). Always creates a MANUAL_ADJUSTMENT transaction record for the audit trail -
 * this should never be called without a human-readable reason attached.
 */
export async function manualWalletAdjustment(params: {
  userId: string;
  direction: 'credit' | 'debit';
  amount: number;
  reason: string;
  adminId: string;
}) {
  const amountKobo = nairaToKobo(params.amount);

  const result = await prisma.$transaction(async (tx) => {
    const before = await tx.user.findUnique({ where: { id: params.userId } });
    if (!before) throw new ApiError(404, 'User not found', 'USER_NOT_FOUND');

    let after;
    if (params.direction === 'debit') {
      const updateResult = await tx.user.updateMany({
        where: { id: params.userId, walletBalanceKobo: { gte: amountKobo } },
        data: { walletBalanceKobo: { decrement: amountKobo } }
      });
      if (updateResult.count === 0) {
        throw new ApiError(402, 'Insufficient wallet balance for this debit', 'INSUFFICIENT_BALANCE');
      }
      after = await tx.user.findUniqueOrThrow({ where: { id: params.userId } });
    } else {
      after = await tx.user.update({
        where: { id: params.userId },
        data: { walletBalanceKobo: { increment: amountKobo } }
      });
    }

    const transaction = await tx.transaction.create({
      data: {
        id: nanoid(),
        userId: params.userId,
        type: TransactionType.MANUAL_ADJUSTMENT,
        status: TransactionStatus.SUCCESS,
        amountKobo,
        balanceBeforeKobo: before.walletBalanceKobo,
        balanceAfterKobo: after.walletBalanceKobo,
        reference: `IDS-ADJ-${Date.now()}-${nanoid(8).toUpperCase()}`,
        description: `Manual ${params.direction} by admin: ${params.reason}`,
        metadata: { adminId: params.adminId, direction: params.direction, reason: params.reason }
      }
    });

    return { transaction, balanceAfter: after.walletBalanceKobo };
  });

  await notifyUser({
    userId: params.userId,
    type: 'WALLET',
    title: params.direction === 'credit' ? 'Wallet credited by support' : 'Wallet debited by support',
    body: `${formatNaira(amountKobo)} was ${params.direction === 'credit' ? 'added to' : 'deducted from'} your wallet: ${params.reason}. New balance: ${formatNaira(result.balanceAfter)}.`,
    data: { transactionId: result.transaction.id }
  });

  return result;
}

/**
 * Reverses a debit: credits the amount back to the user's wallet and marks the
 * transaction REVERSED. Safe to call more than once for the same transaction
 * (no-ops if it's already REVERSED).
 */
export async function refundWallet(params: { transactionId: string; userId: string }) {
  const result = await prisma.$transaction(async (tx) => {
    const transaction = await tx.transaction.findFirst({
      where: { id: params.transactionId, userId: params.userId }
    });
    if (!transaction) throw new ApiError(404, 'Transaction not found', 'TRANSACTION_NOT_FOUND');
    if (transaction.status === TransactionStatus.REVERSED) return { transaction, alreadyReversed: true };

    const user = await tx.user.update({
      where: { id: params.userId },
      data: { walletBalanceKobo: { increment: transaction.amountKobo } }
    });

    const updated = await tx.transaction.update({
      where: { id: transaction.id },
      data: {
        status: TransactionStatus.REVERSED,
        balanceAfterKobo: user.walletBalanceKobo
      }
    });

    return { transaction: updated, alreadyReversed: false };
  });

  if (!result.alreadyReversed) {
    await notifyUser({
      userId: params.userId,
      type: 'WALLET',
      title: 'Transaction reversed',
      body: `${formatNaira(result.transaction.amountKobo)} was refunded to your wallet for "${result.transaction.description}". New balance: ${formatNaira(result.transaction.balanceAfterKobo)}.`,
      data: { transactionId: result.transaction.id }
    });
  }

  return result.transaction;
}
