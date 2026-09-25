import 'dotenv/config';
import { KycStatus } from '@prisma/client';
import { env } from '../config/env.js';
import { prisma } from '../lib/prisma.js';
import { notifyUser } from '../services/notification.service.js';

/**
 * Fixes the "old KatPay account number still shows on the dashboard" issue
 * after switching PAYMENT_PROVIDER to zenithpay.
 *
 * Root cause: verifyBvnAndActivateWallet() (kyc.service.ts) only ever
 * PROVISIONS a virtual account - it short-circuits and returns the
 * already-stored one whenever `kycStatus === VERIFIED && virtualAccountNumber`
 * is already true. Flipping PAYMENT_PROVIDER only changes which gateway
 * NEW provisioning goes through; it does nothing to a User row that was
 * already verified under the old gateway, so that row's virtualAccountNumber
 * just sits there unchanged - VIRTUAL_ACCOUNT_FUNDING_ENABLED only controls
 * whether that (stale) value is shown or hidden, it was never a re-routing
 * switch.
 *
 * We deliberately never persist a user's full BVN (see the comment on
 * verifyBvnAndActivateWallet) - only the last 4 digits - so there is no way
 * to silently re-provision these users through ZenithPay's own
 * dedicated_account/assign API, which requires the full BVN. The only
 * correct fix is to reset the affected rows back to UNVERIFIED so the app's
 * existing KYC screen naturally re-prompts them, and tell them why via a
 * notification.
 *
 * Usage:
 *   tsx src/scripts/reset-stale-virtual-accounts.ts            (dry run - lists what WOULD change)
 *   tsx src/scripts/reset-stale-virtual-accounts.ts --apply    (actually resets + notifies)
 *
 * Safe to re-run: once a user's virtualAccountProvider is reset to null (or
 * matches the current PAYMENT_PROVIDER again after they redo KYC), later
 * runs skip them automatically.
 */
async function main() {
  const apply = process.argv.includes('--apply');
  const currentProvider = env.PAYMENT_PROVIDER;

  const stale = await prisma.user.findMany({
    where: {
      virtualAccountNumber: { not: null },
      virtualAccountProvider: { not: currentProvider }
    },
    select: { id: true, fullName: true, email: true, virtualAccountNumber: true, virtualAccountProvider: true }
  });

  if (stale.length === 0) {
    console.log(`[reset-stale-virtual-accounts] nothing to do - no user has a virtualAccountProvider other than "${currentProvider}".`);
    return;
  }

  console.log(
    `[reset-stale-virtual-accounts] PAYMENT_PROVIDER="${currentProvider}" - found ${stale.length} user(s) still on an older provider:`
  );
  for (const user of stale) {
    console.log(`  - ${user.id}  ${user.email}  (${user.virtualAccountProvider} -> ${user.virtualAccountNumber})`);
  }

  if (!apply) {
    console.log('\n[reset-stale-virtual-accounts] DRY RUN - no changes made. Re-run with --apply to reset these users and notify them.');
    return;
  }

  let reset = 0;
  for (const user of stale) {
    await prisma.user.update({
      where: { id: user.id },
      data: {
        kycStatus: KycStatus.UNVERIFIED,
        virtualAccountNumber: null,
        virtualAccountBank: null,
        virtualAccountProvider: null,
        bvnVerifiedAt: null,
        kycFailureReason: null
      }
    });
    await notifyUser({
      userId: user.id,
      type: 'KYC',
      title: 'Please re-verify to get your new funding account',
      body:
        'We\u2019ve upgraded our banking partner. Your old funding account number no longer works - please re-verify your BVN in the app to get your new dedicated account number.',
      data: { reason: 'payment_provider_migration' }
    });
    reset += 1;
  }

  console.log(`\n[reset-stale-virtual-accounts] reset ${reset} user(s) to kycStatus=UNVERIFIED and sent a re-verify notification to each.`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('[reset-stale-virtual-accounts] failed:', error);
    process.exit(1);
  });
