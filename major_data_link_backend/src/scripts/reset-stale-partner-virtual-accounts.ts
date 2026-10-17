import 'dotenv/config';
import { env } from '../config/env.js';
import { prisma } from '../lib/prisma.js';
import { notifyPartner } from '../services/notification.service.js';

/**
 * Partner counterpart of reset-stale-virtual-accounts.ts.
 *
 * Partners still holding a funding account issued by an older gateway (typically a
 * KatPay account number) are cleared so the partner portal asks for the owner's BVN
 * and issues a ZenithPay account instead. The old number is cleared on the Partner row
 * only; the row is the one the incoming-transfer webhooks use to match credits.
 *
 * Before running with --apply, check KatPay for transfers still arriving on the old
 * numbers: once cleared, a late credit to them cannot be matched automatically.
 *
 * Usage:
 *   tsx src/scripts/reset-stale-partner-virtual-accounts.ts            (dry run)
 *   tsx src/scripts/reset-stale-partner-virtual-accounts.ts --apply    (reset + notify)
 *
 * Safe to re-run: reset partners are skipped on later runs.
 */
async function main() {
  const apply = process.argv.includes('--apply');
  const currentProvider = env.PAYMENT_PROVIDER;

  // Prisma's `not` skips NULL columns, so rows with no provider recorded are matched explicitly.
  const stale = await prisma.partner.findMany({
    where: {
      virtualAccountNumber: { not: null },
      OR: [{ virtualAccountProvider: null }, { virtualAccountProvider: { not: currentProvider } }]
    },
    select: { id: true, businessName: true, email: true, virtualAccountNumber: true, virtualAccountProvider: true }
  });

  if (stale.length === 0) {
    console.log(`[reset-stale-partner-virtual-accounts] nothing to do - no partner has an account from a provider other than "${currentProvider}".`);
    return;
  }

  console.log(`[reset-stale-partner-virtual-accounts] PAYMENT_PROVIDER="${currentProvider}" - found ${stale.length} partner(s) on an older provider:`);
  for (const partner of stale) {
    console.log(`  - ${partner.id}  ${partner.email}  (${partner.virtualAccountProvider ?? 'unknown'} -> ${partner.virtualAccountNumber})`);
  }

  if (!apply) {
    console.log('\n[reset-stale-partner-virtual-accounts] DRY RUN - no changes made. Re-run with --apply to reset these partners and notify them.');
    return;
  }

  let reset = 0;
  for (const partner of stale) {
    await prisma.partner.update({
      where: { id: partner.id },
      data: { virtualAccountNumber: null, virtualAccountBank: null, virtualAccountProvider: null, bvnLast4: null, bvnVerifiedAt: null }
    });
    try {
      await notifyPartner({
        partnerId: partner.id,
        type: 'WALLET',
        title: 'Please re-verify to get your new funding account',
        body: 'We have upgraded our banking partner. Your old funding account number no longer works. Open the Wallet section of the partner portal and enter the business owner’s BVN to get your new account number.',
        data: { reason: 'payment_provider_migration' }
      });
    } catch (error) {
      console.error(`[reset-stale-partner-virtual-accounts] reset ${partner.id} but could not notify`, error);
    }
    reset += 1;
  }

  console.log(`\n[reset-stale-partner-virtual-accounts] reset ${reset} partner(s) and sent a re-verify notification to each.`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('[reset-stale-partner-virtual-accounts] failed:', error);
    process.exit(1);
  });
