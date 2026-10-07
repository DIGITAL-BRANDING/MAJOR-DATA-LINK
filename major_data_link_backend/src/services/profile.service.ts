import { TransactionStatus, TransactionType } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { koboToNaira } from '../lib/money.js';

/**
 * Lifetime wallet funding for the profile page: the sum of this user's
 * SUCCESSFUL WALLET_FUNDING rows (card, bank transfer and virtual-account
 * deposits all land here). Pending/failed/ignored attempts never count, and the
 * separate WALLET_FUNDING_FEE rows are excluded on purpose - the figure is what
 * the customer paid in, not what was left after the funding fee.
 */
export async function getFundingSummary(userId: string) {
  const funded = await prisma.transaction.aggregate({
    where: { userId, type: TransactionType.WALLET_FUNDING, status: TransactionStatus.SUCCESS },
    _sum: { amountKobo: true },
    _count: true,
    _max: { createdAt: true }
  });
  return {
    total_funded: koboToNaira(funded._sum.amountKobo ?? 0n),
    funding_count: funded._count,
    last_funded_at: funded._max.createdAt ? funded._max.createdAt.toISOString() : null
  };
}
