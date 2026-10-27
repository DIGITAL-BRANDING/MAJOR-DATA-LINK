import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  price: { provider: 'techhub' as string, unitPrice: 120, label: 'NIN Personal Information Slip', providerCostKobo: 12000n },
  getVerificationPrice: vi.fn(),
  debit: vi.fn(),
  complete: vi.fn(),
  reverse: vi.fn(),
  techNin: vi.fn(),
  techPhone: vi.fn(),
  fvNin: vi.fn(),
  fvPhone: vi.fn(),
  update: vi.fn()
}));

vi.mock('@prisma/client', () => ({
  Prisma: {},
  TransactionStatus: { PENDING: 'PENDING', SUCCESS: 'SUCCESS', FAILED: 'FAILED' },
  TransactionType: { NIN_VERIFICATION: 'NIN_VERIFICATION', BVN_VERIFICATION: 'BVN_VERIFICATION', IDENTITY_SERVICE_REQUEST: 'IDENTITY_SERVICE_REQUEST' }
}));
vi.mock('../../lib/prisma.js', () => ({ prisma: { partnerTransaction: { update: m.update } } }));
vi.mock('../verification.service.js', () => ({ getVerificationPrice: m.getVerificationPrice }));
vi.mock('../partner-wallet.service.js', () => ({ debitPartnerWallet: m.debit, completePartnerPurchase: m.complete, reversePartnerPurchase: m.reverse }));
vi.mock('../partner-reconciliation.service.js', () => ({ flagPartnerPendingReconciliation: vi.fn() }));
vi.mock('../techhub.service.js', () => ({ techhubService: { ninPersonalInfoByNin: m.techNin, ninPersonalInfoByPhone: m.techPhone } }));
vi.mock('../franceverified-slip-adapter.service.js', () => ({ franceverifiedSlipAdapter: { ninByNin: m.fvNin, ninByPhone: m.fvPhone } }));
vi.mock('../franceverified-nin-validation-adapter.service.js', () => ({ submitNinValidationFV: vi.fn(), checkNinValidationFV: vi.fn() }));
vi.mock('../franceverified-ipe-adapter.service.js', () => ({ checkIpeClearanceFV: vi.fn(), submitIpeClearanceFV: vi.fn() }));
vi.mock('../../middleware/error.js', () => ({ ApiError: class extends Error {} }));
vi.mock('../../lib/pii.js', () => ({ sealPII: (v: unknown) => v, openPII: () => undefined, mergeSealedPII: (_a: unknown, b: unknown) => b }));

import { partnerVerification } from '../partner-verification.service.js';

const OK = { ok: true, message: 'Personal information slip generated successfully', userData: { first_name: 'JOHN' }, pdfBase64: 'JVBERi0x' };

beforeEach(() => {
  vi.clearAllMocks();
  m.price.provider = 'techhub';
  m.getVerificationPrice.mockResolvedValue(m.price);
  m.debit.mockResolvedValue({ reused: false, transaction: { id: 't1', reference: 'REF1', status: 'PENDING', amountKobo: 12000n, balanceAfterKobo: 88000n, metadata: {} } });
  m.complete.mockResolvedValue({ reference: 'REF1', balanceAfterKobo: 88000n });
  m.reverse.mockResolvedValue({ reference: 'REF1', balanceAfterKobo: 100000n });
  m.techNin.mockResolvedValue(OK);
  m.techPhone.mockResolvedValue(OK);
  m.fvNin.mockResolvedValue(OK);
  m.fvPhone.mockResolvedValue(OK);
});

describe('partner NIN personal information slip', () => {
  it('by NIN: bills NIN_PERSONAL_INFO_SLIP at the partner rate and calls Techhub personal-info', async () => {
    const r = await partnerVerification.ninPersonalInfo('p1', '12345678901', 'idem-key-1');
    expect(m.getVerificationPrice).toHaveBeenCalledWith('NIN_PERSONAL_INFO_SLIP', { forPartner: true });
    expect(m.techNin).toHaveBeenCalledWith('12345678901');
    expect(r).toMatchObject({ status: true, reference: 'REF1', pdfBase64: 'JVBERi0x', userData: { first_name: 'JOHN' } });
    expect(m.complete).toHaveBeenCalledTimes(1);
  });

  it('by phone: bills NIN_PHONE_PERSONAL_INFO_SLIP and calls Techhub by-phone personal-info', async () => {
    await partnerVerification.ninPersonalInfoByPhone('p1', '08012345678', 'idem-key-2');
    expect(m.getVerificationPrice).toHaveBeenCalledWith('NIN_PHONE_PERSONAL_INFO_SLIP', { forPartner: true });
    expect(m.techPhone).toHaveBeenCalledWith('08012345678');
  });

  it('routes to FranceVerified with personalInfo=true when the admin selected that provider', async () => {
    m.price.provider = 'franceverified';
    await partnerVerification.ninPersonalInfo('p1', '12345678901', 'idem-key-3');
    expect(m.fvNin).toHaveBeenCalledWith('12345678901', undefined, true);
    expect(m.techNin).not.toHaveBeenCalled();
  });

  it('refunds the partner when the provider fails', async () => {
    m.techNin.mockResolvedValue({ ok: false, message: 'No record found' });
    const r = await partnerVerification.ninPersonalInfo('p1', '12345678901', 'idem-key-4');
    expect(r).toMatchObject({ status: false, message: 'No record found' });
    expect(m.reverse).toHaveBeenCalledTimes(1);
    expect(m.complete).not.toHaveBeenCalled();
  });

  it('does not call the provider again for a reused pending idempotency key', async () => {
    m.debit.mockResolvedValue({ reused: true, transaction: { id: 't1', reference: 'REF1', status: 'PENDING', balanceAfterKobo: 88000n, metadata: {} } });
    const r = await partnerVerification.ninPersonalInfo('p1', '12345678901', 'idem-key-5');
    expect(r.status).toBe('pending');
    expect(m.techNin).not.toHaveBeenCalled();
  });
});
