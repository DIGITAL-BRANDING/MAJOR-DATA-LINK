import { Prisma, TransactionStatus, TransactionType } from '@prisma/client';
import { koboToNaira } from '../lib/money.js';
import { mergeSealedPII, openPII, sealPII } from '../lib/pii.js';
import { getVerificationPrice, type VerificationServiceKey } from './verification.service.js';
import { techhubService, type TechhubBvnTier, type TechhubSlipTier } from './techhub.service.js';
import { completePartnerPurchase, debitPartnerWallet, reversePartnerPurchase } from './partner-wallet.service.js';
import { prisma } from '../lib/prisma.js';
import { ApiError } from '../middleware/error.js';

type PartnerSlipResult = {
  status: boolean; message: string; reference: string; balanceAfter: number;
  userData?: Record<string, unknown>; pdfBase64?: string; pdfUrl?: string;
};

export type PartnerAsyncSubmitResult = { reference: string; ticketId: string; balanceAfter: number; status: 'pending' };
export type PartnerAsyncStatusResult = { reference: string; ticketId: string; status: 'pending' | 'success' | 'failed'; response: Record<string, unknown> | null };

/**
 * Partner equivalent of the retail async verification workflow. Partner
 * transactions stay PENDING until Techhub confirms the ticket. The ticket is
 * owned by the partner that created it, so one partner can never poll another
 * partner's NIN/BVN result.
 */
async function submitPartnerAsync(params: {
  partnerId: string; service: VerificationServiceKey; description: string;
  operational: Record<string, unknown>; pii: Record<string, unknown>; idempotencyKey: string;
  call: () => ReturnType<typeof techhubService.submitNinValidation>;
}): Promise<PartnerAsyncSubmitResult> {
  const price = await getVerificationPrice(params.service);
  const debit = await debitPartnerWallet({
    partnerId: params.partnerId, amount: price.unitPrice, type: TransactionType.IDENTITY_SERVICE_REQUEST,
    description: params.description, idempotencyKey: params.idempotencyKey,
    // Captured up front (same reasoning as the identical note in
    // verification.service.ts's submitAsyncService) - reused at check-time
    // below rather than re-derived, since pricing could change in between.
    costKobo: price.providerCostKobo,
    metadata: { service: params.service, ...params.operational, unit_price: price.unitPrice, pii: sealPII(params.pii) } as Prisma.InputJsonValue
  });
  if (debit.reused) {
    const ticketId = debit.transaction.providerRef;
    if (ticketId) return { reference: debit.transaction.reference, ticketId, balanceAfter: koboToNaira(debit.transaction.balanceAfterKobo), status: 'pending' };
    // A previously rejected request has already been refunded. Never call the
    // upstream again with this same idempotency key; require a new order key.
    if (debit.transaction.status !== TransactionStatus.PENDING) {
      throw new ApiError(409, 'This idempotency key was already processed. Use a new Idempotency-Key for another request.', 'IDEMPOTENCY_KEY_REUSED');
    }
  }
  const result = await params.call();
  if (!result.ok || !result.ticketId) {
    await reversePartnerPurchase(debit.transaction.id, result.message);
    throw new ApiError(502, result.message || 'Verification provider could not accept this request', 'TECHHUB_SUBMIT_FAILED');
  }
  const current = debit.transaction.metadata as Record<string, unknown> | null;
  await prisma.partnerTransaction.update({ where: { id: debit.transaction.id }, data: {
    provider: 'techhub', providerRef: result.ticketId,
    metadata: { service: params.service, ...params.operational, unit_price: price.unitPrice, ticket_id: result.ticketId,
      pii: mergeSealedPII(current?.pii, { ...params.pii, submit_raw: result.raw }) } as Prisma.InputJsonValue
  }});
  return { reference: debit.transaction.reference, ticketId: result.ticketId, balanceAfter: koboToNaira(debit.transaction.balanceAfterKobo), status: 'pending' };
}

async function checkPartnerAsync(params: {
  partnerId: string; ticketId: string;
  call: (ticketId: string) => ReturnType<typeof techhubService.checkNinValidation>;
}): Promise<PartnerAsyncStatusResult> {
  const transaction = await prisma.partnerTransaction.findFirst({ where: { partnerId: params.partnerId, provider: 'techhub', providerRef: params.ticketId } });
  if (!transaction) throw new ApiError(404, 'Unknown ticket_id', 'TICKET_NOT_FOUND');
  const metadata = (transaction.metadata as Record<string, unknown> | null) ?? {};
  const stored = openPII<{ response?: Record<string, unknown> | null }>(metadata.pii);
  if (transaction.status !== TransactionStatus.PENDING) {
    return { reference: transaction.reference, ticketId: params.ticketId,
      status: transaction.status === TransactionStatus.SUCCESS ? 'success' : 'failed', response: stored?.response ?? null };
  }
  const result = await params.call(params.ticketId);
  if (result.status === 'pending') return { reference: transaction.reference, ticketId: result.ticketId, status: 'pending', response: null };
  const nextMetadata = { ...metadata, pii: mergeSealedPII(metadata.pii, { response: result.response, check_raw: result.raw }) } as Prisma.InputJsonValue;
  if (result.status === 'success') {
    await prisma.partnerTransaction.update({ where: { id: transaction.id }, data: { metadata: nextMetadata } });
    // transaction.costKobo was captured at submit time in submitPartnerAsync()
    // above (Techhub's actual cost, not the partner's unit_price) - reuse it
    // rather than re-deriving.
    await completePartnerPurchase(transaction.id, 'techhub', transaction.providerRef ?? undefined, transaction.costKobo ?? undefined);
    return { reference: transaction.reference, ticketId: result.ticketId, status: 'success', response: result.response };
  }
  await prisma.partnerTransaction.update({ where: { id: transaction.id }, data: { metadata: nextMetadata } });
  await reversePartnerPurchase(transaction.id, 'Verification provider reported a failed result');
  return { reference: transaction.reference, ticketId: result.ticketId, status: 'failed', response: result.response };
}

/**
 * Server-side reconciliation for pending async requests. Without this, a
 * webhook could only be emitted after the partner happened to poll its own
 * ticket, which defeats the point of a notification system. The worker only
 * handles services whose upstream status endpoints are already implemented.
 */
export async function reconcilePendingPartnerVerificationTickets(limit = 20) {
  const transactions = await prisma.partnerTransaction.findMany({
    where: { status: TransactionStatus.PENDING, provider: 'techhub', type: TransactionType.IDENTITY_SERVICE_REQUEST, providerRef: { not: null } },
    orderBy: { updatedAt: 'asc' }, take: limit
  });
  await Promise.allSettled(transactions.map(async (transaction) => {
    const metadata = transaction.metadata as Record<string, unknown> | null;
    const service = metadata?.service;
    const ticketId = transaction.providerRef!;
    if (service === 'NIN_PERSONALIZATION') {
      await checkPartnerAsync({ partnerId: transaction.partnerId, ticketId, call: (id) => techhubService.checkPersonalization(id) });
    } else if (service === 'IPE_CLEARANCE') {
      await checkPartnerAsync({ partnerId: transaction.partnerId, ticketId, call: (id) => techhubService.checkIpeClearance(id) });
    } else if (typeof service === 'string' && service.startsWith('NIN_VALIDATION_')) {
      await checkPartnerAsync({ partnerId: transaction.partnerId, ticketId, call: (id) => techhubService.checkNinValidation(id) });
    }
  }));
}

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
  const transaction = await completePartnerPurchase(debit.transaction.id, 'techhub', undefined, price.providerCostKobo);
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
  }),
  submitNinValidation: (partnerId: string, nin: string, validationType: string | undefined, idempotencyKey: string) => {
    const services: Record<string, VerificationServiceKey> = { nin_validation: 'NIN_VALIDATION_GENERAL', no_record: 'NIN_VALIDATION_NO_RECORD', sim: 'NIN_VALIDATION_SIM', bank_validation: 'NIN_VALIDATION_BANK', update_records: 'NIN_VALIDATION_UPDATE_RECORDS', modification: 'NIN_VALIDATION_MODIFICATION', photo_error: 'NIN_VALIDATION_PHOTO_ERROR', 'v.nin_validation': 'NIN_VALIDATION_VNIN' };
    const type = validationType ?? 'nin_validation';
    return submitPartnerAsync({ partnerId, service: services[type] ?? 'NIN_VALIDATION_GENERAL', description: `NIN validation (${type})`, operational: { validation_type: type }, pii: { nin }, idempotencyKey, call: () => techhubService.submitNinValidation(nin, validationType) });
  },
  checkNinValidation: (partnerId: string, ticketId: string) => checkPartnerAsync({ partnerId, ticketId, call: (id) => techhubService.checkNinValidation(id) }),
  submitIpeClearance: (partnerId: string, trackingId: string, idempotencyKey: string) => submitPartnerAsync({ partnerId, service: 'IPE_CLEARANCE', description: 'IPE clearance request', operational: {}, pii: { tracking_id: trackingId }, idempotencyKey, call: () => techhubService.submitIpeClearance(trackingId) }),
  checkIpeClearance: (partnerId: string, ticketId: string) => checkPartnerAsync({ partnerId, ticketId, call: (id) => techhubService.checkIpeClearance(id) }),
  submitPersonalization: (partnerId: string, trackingId: string, idempotencyKey: string) => submitPartnerAsync({ partnerId, service: 'NIN_PERSONALIZATION', description: 'NIN personalization request', operational: {}, pii: { tracking_id: trackingId }, idempotencyKey, call: () => techhubService.submitPersonalization(trackingId) }),
  checkPersonalization: (partnerId: string, ticketId: string) => checkPartnerAsync({ partnerId, ticketId, call: (id) => techhubService.checkPersonalization(id) })
};
