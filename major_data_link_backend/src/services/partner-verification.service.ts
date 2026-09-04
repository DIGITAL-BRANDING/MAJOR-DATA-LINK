import { Prisma, TransactionStatus, TransactionType } from '@prisma/client';
import { koboToNaira } from '../lib/money.js';
import { mergeSealedPII, openPII, sealPII } from '../lib/pii.js';
import { getVerificationPrice, type VerificationServiceKey } from './verification.service.js';
import { techhubService, type TechhubBvnTier, type TechhubSlipTier } from './techhub.service.js';
import { completePartnerPurchase, debitPartnerWallet, reversePartnerPurchase } from './partner-wallet.service.js';
import { prisma } from '../lib/prisma.js';

type PartnerSlipResult = {
  status: boolean; message: string; reference: string; balanceAfter: number;
  userData?: Record<string, unknown>; pdfBase64?: string; pdfUrl?: string;
};

export async function purchasePartnerSlip(params: {
  partnerId: string; service: VerificationServiceKey; type: TransactionType;
  description: string; operational: Record<string, unknown>; pii: Record<string, unknown>;
  idempotencyKey: string; call: () => ReturnType<typeof techhubService.ninByNin>;
}): Promise<PartnerSlipResult> {
  const price = await getVerificationPrice(params.service);
  const debit = await debitPartnerWallet({
    partnerId: params.partnerId, amount: price.unitPrice, type: params.type,
    description: params.description, idempotencyKey: params.idempotencyKey,
    metadata: { service: params.service, ...params.operational, unit_price: price.unitPrice, pii: sealPII(params.pii) } as Prisma.InputJsonValue
  });
  if (debit.reused && debit.transaction.status !== TransactionStatus.PENDING) {
    const metadata = debit.transaction.metadata as Record<string, unknown> | null;
    const pii = openPII<{ user_data?: Record<string, unknown>; pdf_base64?: string; pdf_url?: string }>(metadata?.pii);
    return { status: debit.transaction.status === TransactionStatus.SUCCESS, message: 'Transaction already processed', reference: debit.transaction.reference,
      balanceAfter: koboToNaira(debit.transaction.balanceAfterKobo), userData: pii?.user_data, pdfBase64: pii?.pdf_base64, pdfUrl: pii?.pdf_url };
  }
  const provider = await params.call();
  if (!provider.ok) {
    const reversed = await reversePartnerPurchase(debit.transaction.id, provider.message);
    return { status: false, message: provider.message, reference: reversed.reference, balanceAfter: koboToNaira(reversed.balanceAfterKobo) };
  }
  const current = debit.transaction.metadata as Record<string, unknown> | null;
  await prisma.partnerTransaction.update({ where: { id: debit.transaction.id }, data: {
    metadata: { service: params.service, ...params.operational, unit_price: price.unitPrice,
      pii: mergeSealedPII(current?.pii, { ...params.pii, user_data: provider.userData, pdf_base64: provider.pdfBase64, pdf_url: provider.pdfUrl }) } as Prisma.InputJsonValue
  }});
  const transaction = await completePartnerPurchase(debit.transaction.id, 'techhub');
  return { status: true, message: provider.message, reference: transaction.reference, balanceAfter: koboToNaira(transaction.balanceAfterKobo), userData: provider.userData, pdfBase64: provider.pdfBase64, pdfUrl: provider.pdfUrl };
}

export const partnerVerification = {
  ninByNin: (partnerId: string, nin: string, tier: TechhubSlipTier, idempotencyKey: string) => purchasePartnerSlip({
    partnerId, service: ({ premium: 'NIN_SLIP_PREMIUM', standard: 'NIN_SLIP_STANDARD', regular: 'NIN_SLIP_REGULAR', vnin: 'NIN_SLIP_VNIN' } as const)[tier], type: TransactionType.NIN_VERIFICATION,
    description: `NIN slip (${tier}) by NIN`, operational: { mode: 'by_nin', tier }, pii: { nin }, idempotencyKey, call: () => techhubService.ninByNin(nin, tier)
  }),
  ninByPhone: (partnerId: string, phone: string, tier: Exclude<TechhubSlipTier, 'vnin'>, idempotencyKey: string) => purchasePartnerSlip({
    partnerId, service: ({ premium: 'NIN_PHONE_SLIP_PREMIUM', standard: 'NIN_PHONE_SLIP_STANDARD', regular: 'NIN_PHONE_SLIP_REGULAR' } as const)[tier], type: TransactionType.NIN_VERIFICATION,
    description: `NIN slip (${tier}) by phone`, operational: { mode: 'by_phone', tier }, pii: { phone }, idempotencyKey, call: () => techhubService.ninByPhone(phone, tier)
  }),
  ninByDemographic: (partnerId: string, values: { firstname: string; lastname: string; dob: string; gender?: string }, idempotencyKey: string) => purchasePartnerSlip({
    partnerId, service: 'NIN_DEMOGRAPHIC', type: TransactionType.NIN_VERIFICATION,
    description: 'NIN slip by demographic details', operational: { mode: 'by_demographic' }, pii: values, idempotencyKey,
    call: () => techhubService.ninByDemographic(values)
  }),
  bvnSlip: (partnerId: string, bvn: string, tier: TechhubBvnTier, idempotencyKey: string) => purchasePartnerSlip({
    partnerId, service: ({ premium: 'BVN_SLIP_PREMIUM', standard: 'BVN_SLIP_STANDARD' } as const)[tier], type: TransactionType.BVN_VERIFICATION,
    description: `BVN slip (${tier})`, operational: { tier }, pii: { bvn }, idempotencyKey, call: () => techhubService.bvnSlip(bvn, tier)
  })
};
