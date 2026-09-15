import { PartnerStatus } from '@prisma/client';
import { ApiError } from '../middleware/error.js';
import { koboToNaira } from '../lib/money.js';
import { prisma } from '../lib/prisma.js';

export const NIN_BVN_MINIMUM_DEPOSIT = 5_000;
export const FULL_API_MINIMUM_DEPOSIT = 10_000;

export type PartnerAccessTier = 'FUND_WALLET' | 'NIN_BVN' | 'FULL_API';

export function partnerAccessSummary(walletBalanceKobo: bigint) {
  const balance = koboToNaira(walletBalanceKobo);
  const tier: PartnerAccessTier = balance >= FULL_API_MINIMUM_DEPOSIT
    ? 'FULL_API'
    : balance >= NIN_BVN_MINIMUM_DEPOSIT
      ? 'NIN_BVN'
      : 'FUND_WALLET';

  return {
    tier,
    wallet_balance: balance,
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

  const access = partnerAccessSummary(partner.walletBalanceKobo);
  const permitted = required === 'NIN_BVN' ? access.nin_bvn_enabled : access.full_api_enabled;
  if (permitted) return access;

  const minimum = required === 'NIN_BVN' ? NIN_BVN_MINIMUM_DEPOSIT : FULL_API_MINIMUM_DEPOSIT;
  throw new ApiError(
    403,
    `Fund your Partner wallet to at least ₦${minimum.toLocaleString('en-NG')} to activate ${required === 'NIN_BVN' ? 'NIN/BVN API access' : 'the full API suite'}. Your current balance is ₦${access.wallet_balance.toLocaleString('en-NG')}.`,
    required === 'NIN_BVN' ? 'NIN_BVN_MINIMUM_DEPOSIT_REQUIRED' : 'FULL_API_MINIMUM_DEPOSIT_REQUIRED'
  );
}
