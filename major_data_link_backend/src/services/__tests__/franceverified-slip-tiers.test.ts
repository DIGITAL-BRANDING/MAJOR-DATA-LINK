import { beforeEach, describe, expect, it, vi } from 'vitest';

const { prismaMock, debitWallet, ninByNin, ninByPhone } = vi.hoisted(() => ({
  prismaMock: { servicePricing: { findUnique: vi.fn(), create: vi.fn() }, transaction: { update: vi.fn() } },
  debitWallet: vi.fn(),
  ninByNin: vi.fn(),
  ninByPhone: vi.fn()
}));

vi.mock('../../lib/prisma.js', () => ({ prisma: prismaMock }));
vi.mock('../wallet.service.js', async (importOriginal) => ({ ...(await importOriginal<object>()), debitWallet, refundWallet: vi.fn() }));
vi.mock('../provider-ledger.service.js', () => ({ recordProviderDebit: vi.fn(async () => undefined) }));
vi.mock('../franceverified-slip-adapter.service.js', () => ({ franceverifiedSlipAdapter: { ninByNin, ninByPhone } }));

import { purchaseNinByPhoneV2, purchaseNinVerificationV2 } from '../verification.service.js';

const okResult = { ok: true, message: 'ok', userData: { 'First Name': 'A', Surname: 'B', NIN: '1' }, pdfBase64: 'JVBERi0=', raw: {} };

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.servicePricing.findUnique.mockResolvedValue({
    service: 'x', provider: 'franceverified', label: 'x', providerCostKobo: 13000n, sellingPriceKobo: null, partnerSellingPriceKobo: null, isActive: true
  });
  debitWallet.mockResolvedValue({ reused: false, reference: 'R1', balanceAfter: 870, transaction: { id: 'tx1', status: 'PENDING', metadata: { pii: null }, balanceAfterKobo: 87000n } });
  prismaMock.transaction.update.mockResolvedValue({});
  ninByNin.mockResolvedValue(okResult);
  ninByPhone.mockResolvedValue(okResult);
});

describe('V2 service keys', () => {
  it.each([['smart', 'NIN_VERIFICATION_V2_SMART'], ['portrait', 'NIN_VERIFICATION_V2_PORTRAIT']] as const)('%s bills its own pricing row', async (tier, service) => {
    await purchaseNinVerificationV2({ userId: 'u1', nin: '12345678901', tier });
    expect(prismaMock.servicePricing.findUnique.mock.calls.some((c) => JSON.stringify(c[0]).includes(service))).toBe(true);
  });
});

describe('V2 (FranceVerified) passes the purchased tier through to the slip renderer', () => {
  it.each(['premium', 'standard', 'regular', 'vnin', 'smart', 'portrait'] as const)('NIN verification V2, %s', async (tier) => {
    await purchaseNinVerificationV2({ userId: 'u1', nin: '12345678901', tier });
    expect(ninByNin).toHaveBeenCalledWith('12345678901', tier, false);
  });

  it.each(['premium', 'standard', 'regular'] as const)('NIN by phone V2, %s', async (tier) => {
    await purchaseNinByPhoneV2({ userId: 'u1', phone: '08012345678', tier });
    expect(ninByPhone).toHaveBeenCalledWith('08012345678', tier, false);
  });

  it("'personal' keeps the Personal Information report path (no layout tier)", async () => {
    await purchaseNinByPhoneV2({ userId: 'u1', phone: '08012345678', tier: 'personal' });
    expect(ninByPhone).toHaveBeenCalledWith('08012345678', undefined, true);
  });
});
