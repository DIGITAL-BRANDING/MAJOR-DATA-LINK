import { TransactionStatus, TransactionType } from '@prisma/client';

/**
 * THE single definition of "what a wallet balance should be", derived only
 * from the user's own transaction rows. Used by the per-user check in the
 * admin wallet page, the "wallets out of balance" report and the background
 * monitor, so they can never disagree with each other.
 *
 * Rows must be in chronological order (createdAt, then id): the starting
 * balance is the `balanceBeforeKobo` of the very first row.
 */
export type LedgerRow = {
  type: TransactionType | string;
  status: TransactionStatus | string;
  amountKobo: bigint;
  balanceBeforeKobo: bigint;
  /** Only read for MANUAL_ADJUSTMENT (direction) and REFERRAL_COMMISSION (withdrawal). */
  metadata?: unknown;
};

const meta = (row: LedgerRow) => (row.metadata ?? null) as Record<string, unknown> | null;

export function isReconciliationCorrection(m: Record<string, unknown> | null): boolean {
  if (!m) return false;
  return m.reconciliation === true || (typeof m.reason === 'string' && m.reason.startsWith('Ledger reconciliation:'));
}

export function ledgerBalanceKobo(rows: LedgerRow[]): bigint {
  let expected = rows[0]?.balanceBeforeKobo ?? 0n;
  for (const row of rows) {
    const type = row.type as string;
    const success = row.status === TransactionStatus.SUCCESS;
    if (type === TransactionType.WALLET_FUNDING || type === TransactionType.REFUND || type === TransactionType.COUPON_REDEMPTION) {
      if (success) expected += row.amountKobo;
    } else if (type === TransactionType.WALLET_FUNDING_FEE) {
      if (success) expected -= row.amountKobo;
    } else if (type === TransactionType.MANUAL_ADJUSTMENT) {
      // A "reconcile from ledger" row CORRECTS the stored balance so it equals
      // what the ledger says; it is not a movement of money. Counting it in the
      // ledger as well moved both sides by the same amount, so the difference
      // never closed and the repair appeared to do nothing. Rows written by the
      // older version of that tool are recognised by their reason text.
      if (success && !isReconciliationCorrection(meta(row))) {
        expected += meta(row)?.direction === 'debit' ? -row.amountKobo : row.amountKobo;
      }
    } else if (type === TransactionType.REFERRAL_COMMISSION) {
      // Two kinds of row share this type. A commission EARNED only raises the
      // user's referralEarningsKobo (no wallet movement, so it is ignored
      // here); a commission WITHDRAWN to the wallet (metadata.withdrawal)
      // really does add to walletBalanceKobo and must count as a credit.
      // Ignoring the second kind made every user who ever withdrew referral
      // earnings look "out of balance" by exactly that amount.
      if (success && meta(row)?.withdrawal === true) expected += row.amountKobo;
    } else {
      // Every purchase type: debitWallet deducts when the row is created,
      // even while the request is still PENDING, and a failure is returned
      // as its own REFUND row (counted above).
      expected -= row.amountKobo;
    }
  }
  return expected;
}
