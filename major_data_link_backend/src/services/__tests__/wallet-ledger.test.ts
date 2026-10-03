import { describe, expect, it, vi } from 'vitest';

// The sandbox's generated Prisma client has no runtime enums; echo the member name,
// exactly like the real string enums (TransactionType.REFUND === 'REFUND').
vi.mock('@prisma/client', async (orig) => {
  const actual = await orig<typeof import('@prisma/client')>();
  const echo = new Proxy({}, { get: (_t, p) => p });
  return { ...actual, TransactionType: echo, TransactionStatus: echo };
});


const { ledgerBalanceKobo } = await import('../wallet-ledger.js');
type LedgerRow = import('../wallet-ledger.js').LedgerRow;

const row = (type: string, amountNaira: number, extra: Partial<LedgerRow> = {}): LedgerRow => ({
  type,
  status: 'SUCCESS',
  amountKobo: BigInt(Math.round(amountNaira * 100)),
  balanceBeforeKobo: 0n,
  metadata: null,
  ...extra
});
const naira = (k: bigint) => Number(k) / 100;

describe('ledgerBalanceKobo', () => {
  it('starts from the first row and adds fundings, subtracts purchases', () => {
    expect(naira(ledgerBalanceKobo([row('WALLET_FUNDING', 1000), row('DATA_PURCHASE', 250)]))).toBe(750);
    expect(ledgerBalanceKobo([])).toBe(0n);
  });
  it('ignores funding that never succeeded', () => {
    expect(naira(ledgerBalanceKobo([row('WALLET_FUNDING', 1000, { status: 'PENDING' }), row('WALLET_FUNDING', 400, { status: 'FAILED' })]))).toBe(0);
  });
  it('a reversed purchase nets to zero once its REFUND row is counted', () => {
    expect(naira(ledgerBalanceKobo([row('WALLET_FUNDING', 1000), row('NIN_VERIFICATION', 150, { status: 'REVERSED' }), row('REFUND', 150)]))).toBe(1000);
  });
  it('pending requests count as already paid for', () => {
    expect(naira(ledgerBalanceKobo([row('WALLET_FUNDING', 2000), row('IDENTITY_SERVICE_REQUEST', 1200, { status: 'PENDING' })]))).toBe(800);
  });
  it('funding fee is a debit; manual adjustments follow their direction', () => {
    const rows = [
      row('WALLET_FUNDING', 1000), row('WALLET_FUNDING_FEE', 20),
      row('MANUAL_ADJUSTMENT', 800, { metadata: { direction: 'credit' } }),
      row('MANUAL_ADJUSTMENT', 100, { metadata: { direction: 'debit' } })
    ];
    expect(naira(ledgerBalanceKobo(rows))).toBe(1680);
  });
  it('referral commission EARNED does not touch the wallet, WITHDRAWN does', () => {
    const earned = row('REFERRAL_COMMISSION', 300, { metadata: { refereeId: 'x' } });
    const withdrawn = row('REFERRAL_COMMISSION', 300, { metadata: { withdrawal: true } });
    expect(naira(ledgerBalanceKobo([row('WALLET_FUNDING', 100), earned]))).toBe(100);
    expect(naira(ledgerBalanceKobo([row('WALLET_FUNDING', 100), earned, withdrawn]))).toBe(400);
  });
  it('a reconcile-from-ledger correction is not counted as money movement (new and legacy rows)', () => {
    const base = [row('WALLET_FUNDING', 1000), row('DATA_PURCHASE', 1310)]; // ledger -310
    const fixNew = row('MANUAL_ADJUSTMENT', 1000, { metadata: { direction: 'debit', reconciliation: true } });
    const fixLegacy = row('MANUAL_ADJUSTMENT', 1000, { metadata: { direction: 'debit', reason: 'Ledger reconciliation: stored balance differed from the transaction ledger by N1,000.00.' } });
    const real = row('MANUAL_ADJUSTMENT', 1000, { metadata: { direction: 'debit', reason: 'chargeback' } });
    expect(naira(ledgerBalanceKobo([...base, fixNew]))).toBe(-310);
    expect(naira(ledgerBalanceKobo([...base, fixLegacy]))).toBe(-310);
    expect(naira(ledgerBalanceKobo([...base, real]))).toBe(-1310); // a genuine adjustment still counts
  });
  it('honours a non-zero opening balance', () => {
    expect(naira(ledgerBalanceKobo([row('WALLET_FUNDING', 100, { balanceBeforeKobo: 5000n })]))).toBe(150);
  });
});
