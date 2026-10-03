import { TransactionType } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';

/**
 * wallet.service.ts imports TransactionStatus/TransactionType/Prisma
 * directly from '@prisma/client' (not through lib/prisma.js), so mocking
 * the singleton client above isn't enough on its own. This sandbox's
 * generated Prisma client is a stub missing real runtime enum exports (see
 * this repo's other `tsc --noEmit` runs for the same root cause) - a Proxy
 * that echoes back whatever property is accessed reproduces exactly how a
 * real Prisma string enum behaves (`TransactionType.DATA_PURCHASE ===
 * 'DATA_PURCHASE'`) without needing to hand-maintain every enum member here.
 */
vi.mock('@prisma/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@prisma/client')>();
  const echoEnum = new Proxy({}, { get: (_target, prop) => prop });
  class PrismaClientKnownRequestError extends Error {
    code: string;
    constructor(message: string, opts: { code: string }) {
      super(message);
      this.code = opts.code;
    }
  }
  return {
    ...actual,
    TransactionStatus: echoEnum,
    TransactionType: echoEnum,
    Prisma: { ...((actual as Record<string, unknown>).Prisma as Record<string, unknown>), PrismaClientKnownRequestError }
  };
});

// Production runs with WALLET_FUNDING_FEE_PERCENT=0 (no fee rows in the ledgers).
// With a fee > 0 the duplicate FEE-<ref> row tripped a unique constraint and
// accidentally rolled the second credit back, which hid the race. Test the
// configuration that is actually exposed.
vi.mock('../../config/env.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../config/env.js')>();
  return { ...actual, env: { ...actual.env, WALLET_FUNDING_FEE_PERCENT: 0 } };
});

vi.mock('../../lib/prisma.js', async () => {
  const { createFakePrisma } = await import('../../test-utils/fake-prisma.js');
  const fake = createFakePrisma();
  return { prisma: fake.api };
});

vi.mock('../notification.service.js', () => ({ notifyUser: vi.fn().mockResolvedValue(undefined) }));

const { prisma } = await import('../../lib/prisma.js');
const {
  debitWallet,
  refundWallet,
  createPendingFunding,
  creditWalletByReference,
  getWalletLedgerReconciliation,
  reconcileWalletBalanceFromLedger,
  manualWalletAdjustment
} = await import('../wallet.service.js');

let userCounter = 0;
async function seedUser(balanceNaira: number) {
  userCounter += 1;
  const id = `user-${userCounter}`;
  await prisma.user.create({
    data: {
      id,
      walletBalanceKobo: BigInt(Math.round(balanceNaira * 100)),
      // Required by Prisma's UserCreateInput but irrelevant to the wallet
      // logic under test - the fake Prisma client doesn't enforce
      // uniqueness, so per-user placeholder values are enough.
      fullName: `Test User ${userCounter}`,
      email: `test-user-${userCounter}@example.test`,
      phone: `+23480000${String(userCounter).padStart(4, '0')}`,
      referralCode: `REF${userCounter}`
    }
  });
  return id;
}

async function balanceOf(userId: string) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  return Number(user.walletBalanceKobo) / 100;
}


const kobo = (n: number) => BigInt(Math.round(n * 100));
const naira = (k: bigint) => Number(k) / 100;

describe('wallet funding: the same payment confirmed by several callers at once', () => {
  it('credits exactly once when the webhook and /fund/verify race (fee off)', async () => {
    const userId = await seedUser(480);
    await createPendingFunding({ userId, amount: 1000, reference: 'FUND-RACE-A' });

    // webhook + the web page's 5-second poll + a webhook redelivery, all together
    const results = await Promise.all([
      creditWalletByReference('FUND-RACE-A'),
      creditWalletByReference('FUND-RACE-A'),
      creditWalletByReference('FUND-RACE-A')
    ]);

    expect(await balanceOf(userId)).toBe(1480); // not 2480 / 3480
    expect(results.every((r) => r.status === 'SUCCESS')).toBe(true);
    const rec = await getWalletLedgerReconciliation(userId);
    expect(rec.matches).toBe(true);
  });

  it('a later replay is still a no-op', async () => {
    const userId = await seedUser(0);
    await createPendingFunding({ userId, amount: 500, reference: 'FUND-SEQ-A' });
    await creditWalletByReference('FUND-SEQ-A');
    await creditWalletByReference('FUND-SEQ-A');
    expect(await balanceOf(userId)).toBe(500);
  });
});

describe('refundWallet: simultaneous refunds', () => {
  it('refunds once and both callers get a sensible answer', async () => {
    const userId = await seedUser(2000);
    const debit = await debitWallet({ userId, amount: 800, type: TransactionType.DATA_PURCHASE, description: 'race refund' });
    const settled = await Promise.allSettled([
      refundWallet({ transactionId: debit.transaction.id, userId }),
      refundWallet({ transactionId: debit.transaction.id, userId })
    ]);
    expect(settled.every((s) => s.status === 'fulfilled')).toBe(true);
    expect(await balanceOf(userId)).toBe(2000);
    const rec = await getWalletLedgerReconciliation(userId);
    expect(rec.matches).toBe(true);
  });
});

/** A wallet that was double-credited N1,000 and then spent part of it. */
async function phantomWallet() {
  const userId = await seedUser(0);
  await createPendingFunding({ userId, amount: 1000, reference: `FUND-PH-${userId}` });
  await creditWalletByReference(`FUND-PH-${userId}`);
  await prisma.user.update({ where: { id: userId }, data: { walletBalanceKobo: { increment: kobo(1000) } } }); // the lost double credit
  await debitWallet({ userId, amount: 1310, type: TransactionType.DATA_PURCHASE, description: 'spent phantom money' });
  return userId;
}

describe('reconcileWalletBalanceFromLedger', () => {
  it('reproduces the reported case: stored 690, ledger -310', async () => {
    const userId = await phantomWallet();
    const rec = await getWalletLedgerReconciliation(userId);
    expect(naira(rec.currentKobo)).toBe(690);
    expect(naira(rec.expectedKobo)).toBe(-310);
    expect(naira(rec.currentKobo - rec.expectedKobo)).toBe(1000);
  });

  it('refuses to push the wallet negative unless finance confirms, and says why', async () => {
    const userId = await phantomWallet();
    await expect(reconcileWalletBalanceFromLedger({ userId, adminId: 'admin-1' })).rejects.toMatchObject({
      code: 'RECONCILE_WOULD_GO_NEGATIVE'
    });
    expect(await balanceOf(userId)).toBe(690); // untouched
  });

  it('with confirmation it leaves the true (negative) balance, audited, and the ledger then matches', async () => {
    const userId = await phantomWallet();
    const result = await reconcileWalletBalanceFromLedger({ userId, adminId: 'admin-1', allowNegative: true });
    expect(result.changed).toBe(true);
    expect(await balanceOf(userId)).toBe(-310);
    expect((await getWalletLedgerReconciliation(userId)).matches).toBe(true); // the repair really closes the gap

    // they cannot buy while they owe, and a normal top-up works from the true figure
    await expect(
      debitWallet({ userId, amount: 10, type: TransactionType.DATA_PURCHASE, description: 'should be refused' })
    ).rejects.toMatchObject({ code: 'INSUFFICIENT_BALANCE' });
    await createPendingFunding({ userId, amount: 1000, reference: `FUND-TOPUP-${userId}` });
    await creditWalletByReference(`FUND-TOPUP-${userId}`);
    expect(await balanceOf(userId)).toBe(690);
    expect((await getWalletLedgerReconciliation(userId)).matches).toBe(true);
  });

  it('a wallet holding LESS than its ledger is credited back without any confirmation', async () => {
    const userId = await seedUser(0);
    await createPendingFunding({ userId, amount: 1000, reference: `FUND-LOW-${userId}` });
    await creditWalletByReference(`FUND-LOW-${userId}`);
    await prisma.user.update({ where: { id: userId }, data: { walletBalanceKobo: { decrement: kobo(300) } } });
    await reconcileWalletBalanceFromLedger({ userId, adminId: 'admin-1' });
    expect(await balanceOf(userId)).toBe(1000);
    expect((await getWalletLedgerReconciliation(userId)).matches).toBe(true);
  });

  it('running it twice changes nothing the second time (the repair is stable)', async () => {
    const userId = await phantomWallet();
    await reconcileWalletBalanceFromLedger({ userId, adminId: 'admin-1', allowNegative: true });
    const again = await reconcileWalletBalanceFromLedger({ userId, adminId: 'admin-1' });
    expect(again.changed).toBe(false);
    expect(await balanceOf(userId)).toBe(-310);
  });

  it('does nothing when the wallet already matches', async () => {
    const userId = await seedUser(0);
    await createPendingFunding({ userId, amount: 700, reference: `FUND-OK-${userId}` });
    await creditWalletByReference(`FUND-OK-${userId}`);
    expect((await reconcileWalletBalanceFromLedger({ userId, adminId: 'admin-1' })).changed).toBe(false);
  });

  it('refuses to apply if the balance moved after the admin looked (no repair on stale numbers)', async () => {
    const userId = await seedUser(1000);
    await expect(
      manualWalletAdjustment({ userId, direction: 'credit', amount: 5, reason: 'x', adminId: 'a', expectedCurrentKobo: kobo(999) })
    ).rejects.toMatchObject({ code: 'WALLET_CHANGED' });
    expect(await balanceOf(userId)).toBe(1000);
  });
});
