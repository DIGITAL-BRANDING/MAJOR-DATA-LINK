import { TransactionType } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { ledgerBalanceKobo, type LedgerRow } from './wallet-ledger.js';

export type WalletDriftRow = {
  userId: string;
  fullName: string;
  email: string;
  storedKobo: bigint;
  ledgerKobo: bigint;
  /** stored - ledger. Positive = the wallet holds money its ledger cannot account for (company exposure). */
  differenceKobo: bigint;
};

export type WalletDriftReport = {
  scannedUsers: number;
  drifted: WalletDriftRow[];
  /** Sum of positive differences: money sitting in wallets that no payment backs. */
  exposureKobo: bigint;
  /** Sum of negative differences (as a positive number): wallets holding LESS than they are owed. */
  underpaidKobo: bigint;
  scannedAt: Date;
};

const PAGE = 200;
const NEEDS_METADATA = [TransactionType.MANUAL_ADJUSTMENT, TransactionType.REFERRAL_COMMISSION];

type Timed = LedgerRow & { id: string; createdAt: Date; userId: string };
const byTime = (a: Timed, b: Timed) =>
  a.createdAt.getTime() - b.createdAt.getTime() || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

/**
 * Compares every wallet's stored balance with what its own transaction
 * history implies (see wallet-ledger.ts). Read-only. Users are scanned in
 * pages, and the bulky `metadata` JSON is only fetched for the two types
 * whose meaning depends on it, so a large database does not mean a large
 * memory spike.
 */
export async function findWalletDrift(): Promise<WalletDriftReport> {
  const drifted: WalletDriftRow[] = [];
  let scanned = 0;
  let cursor: string | undefined;

  for (;;) {
    const users = await prisma.user.findMany({
      take: PAGE,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: { id: 'asc' },
      select: { id: true, fullName: true, email: true, walletBalanceKobo: true }
    });
    if (users.length === 0) break;
    cursor = users[users.length - 1].id;
    scanned += users.length;
    const ids = users.map((u) => u.id);

    const [plain, withMeta] = await Promise.all([
      prisma.transaction.findMany({
        where: { userId: { in: ids }, type: { notIn: NEEDS_METADATA } },
        select: { id: true, userId: true, createdAt: true, type: true, status: true, amountKobo: true, balanceBeforeKobo: true }
      }),
      prisma.transaction.findMany({
        where: { userId: { in: ids }, type: { in: NEEDS_METADATA } },
        select: { id: true, userId: true, createdAt: true, type: true, status: true, amountKobo: true, balanceBeforeKobo: true, metadata: true }
      })
    ]);

    const perUser = new Map<string, Timed[]>();
    for (const row of [...plain, ...withMeta] as Timed[]) {
      const list = perUser.get(row.userId);
      if (list) list.push(row);
      else perUser.set(row.userId, [row]);
    }

    for (const user of users) {
      const rows = (perUser.get(user.id) ?? []).sort(byTime);
      const ledger = ledgerBalanceKobo(rows);
      if (ledger !== user.walletBalanceKobo) {
        drifted.push({
          userId: user.id,
          fullName: user.fullName,
          email: user.email,
          storedKobo: user.walletBalanceKobo,
          ledgerKobo: ledger,
          differenceKobo: user.walletBalanceKobo - ledger
        });
      }
    }
    if (users.length < PAGE) break;
  }

  drifted.sort((a, b) => (b.differenceKobo > a.differenceKobo ? 1 : b.differenceKobo < a.differenceKobo ? -1 : 0));
  let exposure = 0n;
  let underpaid = 0n;
  for (const d of drifted) {
    if (d.differenceKobo > 0n) exposure += d.differenceKobo;
    else underpaid += -d.differenceKobo;
  }
  return { scannedUsers: scanned, drifted, exposureKobo: exposure, underpaidKobo: underpaid, scannedAt: new Date() };
}

/**
 * Background watchdog: scans on a timer and writes one clear line to the
 * server log when any wallet is out of balance, so drift is noticed in hours
 * instead of when a customer or the books reveal it. Never overlaps itself
 * and never throws.
 */
export function startWalletDriftMonitor(intervalMs = 6 * 60 * 60_000, firstRunDelayMs = 2 * 60_000) {
  let running = false;
  const run = async () => {
    if (running) return;
    running = true;
    try {
      const report = await findWalletDrift();
      if (report.drifted.length > 0) {
        console.error(
          `[wallet-drift] ${report.drifted.length} of ${report.scannedUsers} wallets do not match their ledger. ` +
            `Exposure NGN${Number(report.exposureKobo) / 100}, under-credited NGN${Number(report.underpaidKobo) / 100}. ` +
            `Review at /admin/wallet-drift. Worst: ${report.drifted
              .slice(0, 5)
              .map((d) => `${d.email} (${Number(d.differenceKobo) / 100})`)
              .join(', ')}`
        );
      } else {
        console.log(`[wallet-drift] OK - ${report.scannedUsers} wallets match their ledgers`);
      }
    } catch (error) {
      console.error('[wallet-drift] scan failed', error);
    } finally {
      running = false;
    }
  };
  const first = setTimeout(() => void run(), firstRunDelayMs);
  const timer = setInterval(() => void run(), intervalMs);
  first.unref();
  timer.unref();
  return () => {
    clearTimeout(first);
    clearInterval(timer);
  };
}
