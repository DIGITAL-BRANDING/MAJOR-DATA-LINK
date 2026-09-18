import { PartnerStatus, TransactionStatus, TransactionType } from '@prisma/client';
import { ApiError } from '../middleware/error.js';
import { koboToNaira } from '../lib/money.js';
import { prisma } from '../lib/prisma.js';

export const NIN_BVN_MINIMUM_DEPOSIT = 5_000;
export const FULL_API_MINIMUM_DEPOSIT = 10_000;

export type PartnerAccessTier = 'FUND_WALLET' | 'NIN_BVN' | 'FULL_API';

/**
 * Access is unlocked by ONE confirmed funding payment, not by the current
 * spendable balance. A partner that funded ₦10,000 can keep using the full
 * API after spending that balance; their wallet is still debited normally for
 * each API call. Splitting a top-up into several smaller payments does not
 * unlock a higher tier.
 */
export function partnerAccessSummary(walletBalanceKobo: bigint, largestSuccessfulFundingKobo: bigint = 0n) {
  const balance = koboToNaira(walletBalanceKobo);
  const largest_successful_funding = koboToNaira(largestSuccessfulFundingKobo);
  const tier: PartnerAccessTier = largest_successful_funding >= FULL_API_MINIMUM_DEPOSIT
    ? 'FULL_API'
    : largest_successful_funding >= NIN_BVN_MINIMUM_DEPOSIT
      ? 'NIN_BVN'
      : 'FUND_WALLET';

  return {
    tier,
    wallet_balance: balance,
    largest_successful_funding,
    nin_bvn_minimum_deposit: NIN_BVN_MINIMUM_DEPOSIT,
    full_api_minimum_deposit: FULL_API_MINIMUM_DEPOSIT,
    nin_bvn_enabled: tier === 'NIN_BVN' || tier === 'FULL_API',
    full_api_enabled: tier === 'FULL_API'
  };
}

/**
 * Enforces access at the API boundary, using the wallet's current balance
 * rather than a client-declared plan. Wallet/funding endpoints stay outside
 * this guard so an approved partner can always top up to the next tier.
 */
export async function requirePartnerAccess(partnerId: string, required: 'NIN_BVN' | 'FULL_API') {
  const partner = await prisma.partner.findUniqueOrThrow({ where: { id: partnerId } });
  if (partner.status !== PartnerStatus.ACTIVE) {
    throw new ApiError(403, 'Your Partner account must be approved before API access is available.', 'PARTNER_NOT_ACTIVE');
  }

  const funding = await prisma.partnerTransaction.aggregate({
    where: { partnerId, type: TransactionType.WALLET_FUNDING, status: TransactionStatus.SUCCESS },
    _max: { amountKobo: true }
  });
  const access = partnerAccessSummary(partner.walletBalanceKobo, funding._max.amountKobo ?? 0n);
  const permitted = required === 'NIN_BVN' ? access.nin_bvn_enabled : access.full_api_enabled;
  if (permitted) return access;

  const minimum = required === 'NIN_BVN' ? NIN_BVN_MINIMUM_DEPOSIT : FULL_API_MINIMUM_DEPOSIT;
  throw new ApiError(
    403,
    `Make one successful Partner wallet funding payment of at least ₦${minimum.toLocaleString('en-NG')} to unlock ${required === 'NIN_BVN' ? 'NIN/BVN API access' : 'the full API suite'}. Your largest confirmed funding payment is ₦${access.largest_successful_funding.toLocaleString('en-NG')}.`,
    required === 'NIN_BVN' ? 'NIN_BVN_MINIMUM_DEPOSIT_REQUIRED' : 'FULL_API_MINIMUM_DEPOSIT_REQUIRED'
  );
}

/** The portal uses this to show the same permanent unlock state as the API guard. */
export async function getPartnerAccessSummary(partnerId: string, walletBalanceKobo: bigint) {
  const funding = await prisma.partnerTransaction.aggregate({
    where: { partnerId, type: TransactionType.WALLET_FUNDING, status: TransactionStatus.SUCCESS },
    _max: { amountKobo: true }
  });
  return partnerAccessSummary(walletBalanceKobo, funding._max.amountKobo ?? 0n);
}
