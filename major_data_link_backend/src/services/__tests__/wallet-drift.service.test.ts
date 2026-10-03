import { beforeEach, describe, expect, it, vi } from 'vitest';

type Row = Record<string, any>;
let users: Row[] = [];
let txs: Row[] = [];

const inList = (v: any, w: any) => {
  if (w && typeof w === 'object' && 'in' in w) return w.in.includes(v);
  if (w && typeof w === 'object' && 'notIn' in w) return !w.notIn.includes(v);
  return v === w;
};

vi.mock('../../lib/prisma.js', () => ({
  prisma: {
    user: {
      findMany: async ({ take, skip, cursor }: any) => {
        let list = [...users].sort((a, b) => (a.id < b.id ? -1 : 1));
        if (cursor) list = list.slice(list.findIndex((u) => u.id === cursor.id) + (skip ?? 0));
        return list.slice(0, take).map((u) => ({ ...u }));
      }
    },
    transaction: {
      findMany: async ({ where }: any) =>
        txs.filter((t) => inList(t.userId, where.userId) && (!where.type || inList(t.type, where.type))).map((t) => ({ ...t }))
    }
  }
}));
vi.mock('@prisma/client', async (orig) => {
  const actual = await orig<typeof import('@prisma/client')>();
  const echo = new Proxy({}, { get: (_t, p) => p });
  return { ...actual, TransactionType: echo, TransactionStatus: echo };
});

const { findWalletDrift } = await import('../wallet-drift.service.js');

let n = 0;
const user = (id: string, stored: number) => users.push({ id, fullName: `User ${id}`, email: `${id}@t.test`, walletBalanceKobo: BigInt(stored * 100) });
const tx = (userId: string, type: string, amount: number, extra: Row = {}) =>
  txs.push({ id: `t${++n}`, userId, type, status: 'SUCCESS', amountKobo: BigInt(amount * 100), balanceBeforeKobo: 0n, metadata: null, createdAt: new Date(1_700_000_000_000 + n * 1000), ...extra });

describe('findWalletDrift', () => {
  beforeEach(() => { users = []; txs = []; n = 0; });

  it('reports only wallets that differ from their ledger, with the money at risk', async () => {
    user('good', 750); tx('good', 'WALLET_FUNDING', 1000); tx('good', 'DATA_PURCHASE', 250);
    user('phantom', 690); tx('phantom', 'WALLET_FUNDING', 1000); tx('phantom', 'DATA_PURCHASE', 1310); // ledger -310
    user('short', 400); tx('short', 'WALLET_FUNDING', 500);                                           // ledger 500
    user('referrer', 400); tx('referrer', 'WALLET_FUNDING', 100); tx('referrer', 'REFERRAL_COMMISSION', 300, { metadata: { withdrawal: true } });
    user('empty', 0);

    const report = await findWalletDrift();
    expect(report.scannedUsers).toBe(5);
    expect(report.drifted.map((d) => d.userId)).toEqual(['phantom', 'short']);
    expect(report.drifted[0]).toMatchObject({ storedKobo: 69000n, ledgerKobo: -31000n, differenceKobo: 100000n });
    expect(report.exposureKobo).toBe(100000n);
    expect(report.underpaidKobo).toBe(10000n);
  });

  it('pages through more users than one page holds', async () => {
    for (let i = 0; i < 450; i++) { user(`u${String(i).padStart(4, '0')}`, 100); tx(`u${String(i).padStart(4, '0')}`, 'WALLET_FUNDING', i % 50 === 0 ? 90 : 100); }
    const report = await findWalletDrift();
    expect(report.scannedUsers).toBe(450);
    expect(report.drifted.length).toBe(9);
  });
});
