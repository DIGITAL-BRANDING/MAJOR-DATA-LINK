import { Prisma, TransactionStatus, TransactionType } from '@prisma/client';
import { koboToNaira } from '../lib/money.js';
import { mergeSealedPII, openPII, sealPII } from '../lib/pii.js';
import { prisma } from '../lib/prisma.js';
import { ApiError } from '../middleware/error.js';
import { debitWallet, refundWallet } from './wallet.service.js';
import { recordProviderDebit } from './provider-ledger.service.js';
import {
  techhubService,
  type TechhubBvnTier,
  type TechhubSlipTier
} from './techhub.service.js';

/**
 * Matches VerificationServiceX.key in the Flutter app's
 * lib/features/verification/presentation/providers/verification_provider.dart
 * - keep the two in sync if either side ever adds/renames a service.
 */
const SERVICE_KEYS = [
  'NIN_SLIP_PREMIUM',
  'NIN_SLIP_STANDARD',
  'NIN_SLIP_REGULAR',
  'NIN_SLIP_VNIN',
  'NIN_PHONE_SLIP_PREMIUM',
  'NIN_PHONE_SLIP_STANDARD',
  'NIN_PHONE_SLIP_REGULAR',
  'NIN_DEMOGRAPHIC',
  'BVN_SLIP_PREMIUM',
  'BVN_SLIP_STANDARD',
  'NIN_DELINKING',
  'NIN_VALIDATION',
  'NIN_PERSONALIZATION',
  'BVN_RETRIEVAL',
  'IPE_CLEARANCE'
] as const;

export type VerificationServiceKey = (typeof SERVICE_KEYS)[number];

/**
 * Provider cost (naira) - what Techhub actually charges us per call, taken
 * directly from https://techhubltd.co/api_summary.php (confirmed against a
 * screenshot of that page). Techhub does not price NIN/BVN slip tiers
 * (Premium/Standard/Regular/VNIN) separately - it quotes one flat "NIN
 * Slips" / "BVN Slips" rate that applies across all of them, so every tier
 * within a slip family shares the same providerCostKobo below. NIN
 * Delinking (₦3,500) isn't listed on that summary page - confirmed
 * separately.
 *
 * This is PROVIDER COST, not the selling price shown to users - it's the
 * floor `sellingPriceKobo` falls back to only until an admin sets a real
 * selling price (with markup) via PATCH /api/admin/service-prices/:service
 * or the AdminJS "Verification Pricing" page. Nothing here needs a
 * redeploy to change afterward - only affects rows not yet created.
 */
const DEFAULTS: Record<VerificationServiceKey, { label: string; price: number }> = {
  NIN_SLIP_PREMIUM: { label: 'NIN Slip (Premium) — by NIN', price: 120 },
  NIN_SLIP_STANDARD: { label: 'NIN Slip (Standard) — by NIN', price: 120 },
  NIN_SLIP_REGULAR: { label: 'NIN Slip (Regular) — by NIN', price: 120 },
  NIN_SLIP_VNIN: { label: 'NIN Slip (VNIN) — by NIN', price: 120 },
  NIN_PHONE_SLIP_PREMIUM: { label: 'NIN Slip (Premium) — by Phone', price: 130 },
  NIN_PHONE_SLIP_STANDARD: { label: 'NIN Slip (Standard) — by Phone', price: 130 },
  NIN_PHONE_SLIP_REGULAR: { label: 'NIN Slip (Regular) — by Phone', price: 130 },
  NIN_DEMOGRAPHIC: { label: 'NIN Slip — by Demographic', price: 130 },
  BVN_SLIP_PREMIUM: { label: 'BVN Slip (Premium)', price: 80 },
  BVN_SLIP_STANDARD: { label: 'BVN Slip (Standard)', price: 80 },
  NIN_DELINKING: { label: 'NIN Delinking', price: 3500 },
  NIN_VALIDATION: { label: 'NIN Validation', price: 1000 },
  NIN_PERSONALIZATION: { label: 'NIN Personalization', price: 300 },
  BVN_RETRIEVAL: { label: 'BVN Retrieval', price: 700 },
  IPE_CLEARANCE: { label: 'IPE Clearance', price: 450 }
};

function priceToKobo(amount: number) {
  return BigInt(Math.round(amount * 100));
}

/**
 * Same reasoning as result-pin.service.ts's getOrCreateServicePricingRow():
 * a plain findUnique + conditional create, deliberately NOT an upsert (an
 * empty `update` object on the "row already exists" path throws). Never
 * resets an admin's already-configured price back to the default.
 */
async function getOrCreateVerificationPricingRow(service: VerificationServiceKey) {
  const defaults = DEFAULTS[service];
  const existing = await prisma.servicePricing.findUnique({ where: { service } });
  if (existing) return existing;

  try {
    return await prisma.servicePricing.create({
      data: {
        service,
        provider: 'techhub',
        label: defaults.label,
        providerCostKobo: priceToKobo(defaults.price)
      }
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return prisma.servicePricing.findUniqueOrThrow({ where: { service } });
    }
    throw error;
  }
}

/** Throws SERVICE_INACTIVE if disabled - use right before spending money on this service. */
export async function getVerificationPrice(service: VerificationServiceKey) {
  const row = await getOrCreateVerificationPricingRow(service);
  if (!row.isActive) {
    throw new ApiError(422, `${row.label} is currently unavailable`, 'SERVICE_INACTIVE');
  }
  const unitKobo = row.sellingPriceKobo ?? row.providerCostKobo;
  return {
    service: row.service,
    label: row.label,
    unitPrice: koboToNaira(unitKobo),
    providerCostKobo: row.providerCostKobo
  };
}

/** Public price list for every screen to read from - never throws on a disabled service. */
export async function listVerificationPrices() {
  const rows = await Promise.all(SERVICE_KEYS.map((key) => getOrCreateVerificationPricingRow(key)));
  return rows.map((row) => ({
    service: row.service,
    label: row.label,
    unitPrice: koboToNaira(row.sellingPriceKobo ?? row.providerCostKobo),
    isActive: row.isActive
  }));
}

/** Admin-facing listing, merged into the same /api/admin/service-prices endpoint as result pins. */
export async function listVerificationPricesForAdmin() {
  const rows = await Promise.all(SERVICE_KEYS.map((key) => getOrCreateVerificationPricingRow(key)));
  return rows.map((row) => ({
    service: row.service,
    label: row.label,
    provider_cost: koboToNaira(row.providerCostKobo),
    selling_price: row.sellingPriceKobo ? koboToNaira(row.sellingPriceKobo) : null,
    is_active: row.isActive
  }));
}

// ── Slip lookups (synchronous) ──────────────────────────────────

export type SlipPurchaseResult = {
  status: boolean;
  message: string;
  reference: string;
  userData?: Record<string, unknown>;
  pdfBase64?: string;
  balanceAfter: number;
};

/**
 * Shared by all four slip flows (NIN-by-NIN, NIN-by-Phone, NIN-by-Demographic,
 * BVN Slip): debit first, call Techhub, refund on failure. Exactly the same
 * shape as result-pin.service.ts's purchaseResultPin() - see that function's
 * comments for why the idempotent-replay branch reads back from the
 * transaction's own metadata instead of re-calling the provider.
 *
 * PII handling: `operational` (service/mode/tier) stays as plain, readable
 * metadata - it's what the admin transaction list filters/sorts on and
 * carries no identity information on its own. `pii` (the submitted
 * nin/phone/bvn/names/dob, and - once the provider responds - the full
 * user_data + generated slip PDF) is encrypted with sealPII() before it ever
 * reaches Prisma, so a database dump, backup, or a support agent browsing
 * the admin panel never sees it in the clear. See src/lib/pii.ts and the
 * "View PII" admin action on the Transaction resource for the one
 * (audited, SUPER_ADMIN-only) place it's ever decrypted again.
 */
async function purchaseSlip(params: {
  userId: string;
  service: VerificationServiceKey;
  transactionType: typeof TransactionType.NIN_VERIFICATION | typeof TransactionType.BVN_VERIFICATION;
  description: string;
  operational: Record<string, unknown>;
  pii: Record<string, unknown>;
  idempotencyKey?: string;
  call: () => ReturnType<typeof techhubService.ninByNin>;
}): Promise<SlipPurchaseResult> {
  const price = await getVerificationPrice(params.service);

  const debit = await debitWallet({
    userId: params.userId,
    amount: price.unitPrice,
    type: params.transactionType,
    description: params.description,
    metadata: {
      service: params.service,
      ...params.operational,
      unit_price: price.unitPrice,
      pii: sealPII(params.pii)
    } as Prisma.InputJsonValue,
    idempotencyKey: params.idempotencyKey,
    // Techhub quotes one flat rate per slip family (see the DEFAULTS comment
    // above) - fixed and known up front, no balance-delta correction needed.
    costKobo: price.providerCostKobo
  });

  if (debit.reused && debit.transaction.status !== TransactionStatus.PENDING) {
    const metadata = debit.transaction.metadata as Record<string, unknown> | null;
    const pii = openPII<{ user_data?: Record<string, unknown>; pdf_base64?: string }>(metadata?.pii);
    return {
      status: debit.transaction.status === TransactionStatus.SUCCESS,
      message: 'Transaction already processed',
      reference: debit.reference,
      userData: pii?.user_data,
      pdfBase64: pii?.pdf_base64,
      balanceAfter: koboToNaira(debit.transaction.balanceAfterKobo)
    };
  }

  const provider = await params.call();

  if (provider.ok) {
    const existingMetadata = debit.transaction.metadata as Record<string, unknown> | null;
    await prisma.transaction.update({
      where: { id: debit.transaction.id },
      data: {
        status: TransactionStatus.SUCCESS,
        provider: 'techhub',
        metadata: {
          service: params.service,
          ...params.operational,
          unit_price: price.unitPrice,
          pii: mergeSealedPII(existingMetadata?.pii, {
            ...params.pii,
            user_data: provider.userData,
            pdf_base64: provider.pdfBase64
          })
        } as Prisma.InputJsonValue
      }
    });

    // Techhub quotes one flat rate per slip family, already stored as
    // price.providerCostKobo above - no balance-delta correction available
    // or needed (unlike Alrahuz data/airtime).
    await recordProviderDebit({
      provider: 'techhub',
      amountKobo: price.providerCostKobo,
      relatedTransactionId: debit.transaction.id,
      description: params.description
    }).catch((error) => {
      console.error('[provider-ledger] failed to record debit for', debit.transaction.id, error);
    });

    return {
      status: true,
      message: provider.message,
      reference: debit.reference,
      userData: provider.userData,
      pdfBase64: provider.pdfBase64,
      balanceAfter: debit.balanceAfter
    };
  }

  await prisma.transaction.update({
    where: { id: debit.transaction.id },
    data: { status: TransactionStatus.FAILED, provider: 'techhub' }
  });
  const refunded = await refundWallet({ transactionId: debit.transaction.id, userId: params.userId });

  return {
    status: false,
    message: provider.message,
    reference: debit.reference,
    balanceAfter: koboToNaira(refunded.balanceAfterKobo)
  };
}

const NIN_SLIP_SERVICE_BY_TIER: Record<TechhubSlipTier, VerificationServiceKey> = {
  premium: 'NIN_SLIP_PREMIUM',
  standard: 'NIN_SLIP_STANDARD',
  regular: 'NIN_SLIP_REGULAR',
  vnin: 'NIN_SLIP_VNIN'
};

const NIN_PHONE_SLIP_SERVICE_BY_TIER: Record<Exclude<TechhubSlipTier, 'vnin'>, VerificationServiceKey> = {
  premium: 'NIN_PHONE_SLIP_PREMIUM',
  standard: 'NIN_PHONE_SLIP_STANDARD',
  regular: 'NIN_PHONE_SLIP_REGULAR'
};

const BVN_SLIP_SERVICE_BY_TIER: Record<TechhubBvnTier, VerificationServiceKey> = {
  premium: 'BVN_SLIP_PREMIUM',
  standard: 'BVN_SLIP_STANDARD'
};

export function purchaseNinByNin(params: { userId: string; nin: string; tier: TechhubSlipTier; idempotencyKey?: string }) {
  return purchaseSlip({
    userId: params.userId,
    service: NIN_SLIP_SERVICE_BY_TIER[params.tier],
    transactionType: TransactionType.NIN_VERIFICATION,
    description: `NIN slip (${params.tier}) by NIN`,
    operational: { mode: 'by_nin', tier: params.tier },
    pii: { nin: params.nin },
    idempotencyKey: params.idempotencyKey,
    call: () => techhubService.ninByNin(params.nin, params.tier)
  });
}

export function purchaseNinByPhone(params: {
  userId: string;
  phone: string;
  tier: Exclude<TechhubSlipTier, 'vnin'>;
  idempotencyKey?: string;
}) {
  return purchaseSlip({
    userId: params.userId,
    service: NIN_PHONE_SLIP_SERVICE_BY_TIER[params.tier],
    transactionType: TransactionType.NIN_VERIFICATION,
    description: `NIN slip (${params.tier}) by Phone`,
    operational: { mode: 'by_phone', tier: params.tier },
    pii: { phone: params.phone },
    idempotencyKey: params.idempotencyKey,
    call: () => techhubService.ninByPhone(params.phone, params.tier)
  });
}

export function purchaseNinByDemographic(params: {
  userId: string;
  firstname: string;
  lastname: string;
  dob: string;
  gender?: string;
  idempotencyKey?: string;
}) {
  return purchaseSlip({
    userId: params.userId,
    service: 'NIN_DEMOGRAPHIC',
    transactionType: TransactionType.NIN_VERIFICATION,
    description: 'NIN slip by demographic details',
    operational: { mode: 'by_demographic' },
    pii: {
      firstname: params.firstname,
      lastname: params.lastname,
      dob: params.dob,
      gender: params.gender
    },
    idempotencyKey: params.idempotencyKey,
    call: () =>
      techhubService.ninByDemographic({
        firstname: params.firstname,
        lastname: params.lastname,
        dob: params.dob,
        gender: params.gender
      })
  });
}

export function purchaseBvnSlip(params: { userId: string; bvn: string; tier: TechhubBvnTier; idempotencyKey?: string }) {
  return purchaseSlip({
    userId: params.userId,
    service: BVN_SLIP_SERVICE_BY_TIER[params.tier],
    transactionType: TransactionType.BVN_VERIFICATION,
    description: `BVN slip (${params.tier})`,
    operational: { tier: params.tier },
    pii: { bvn: params.bvn },
    idempotencyKey: params.idempotencyKey,
    call: () => techhubService.bvnSlip(params.bvn, params.tier)
  });
}

// ── Async services (submit + poll) ──────────────────────────────

export type AsyncSubmitResult = { reference: string; ticketId: string; balanceAfter: number };
export type AsyncStatusResult = { ticketId: string; status: 'pending' | 'success' | 'failed'; response: Record<string, unknown> | null };

/**
 * Shared by all five async flows. Debits immediately (the wallet charge
 * happens at submit time, same as Techhub's own docs describe for THEIR
 * balance), submits to Techhub, and refunds right away if Techhub rejects
 * the submission outright. If Techhub accepts it, the transaction stays
 * PENDING with providerRef = Techhub's ticket_id - the eventual
 * success/failure (and any refund for a failure) only happens later, when
 * checkAsyncServiceStatus() below is polled and Techhub reports an outcome.
 *
 * Same PII split as purchaseSlip() above: `operational` metadata (service,
 * ticket_id) stays plaintext; `pii` (nin/email/tracking_id/names/phone, plus
 * Techhub's submit_raw once it responds) is sealed with sealPII().
 */
async function submitAsyncService(params: {
  userId: string;
  service: VerificationServiceKey;
  description: string;
  operational: Record<string, unknown>;
  pii: Record<string, unknown>;
  idempotencyKey?: string;
  call: () => ReturnType<typeof techhubService.submitDelinking>;
}): Promise<AsyncSubmitResult> {
  const price = await getVerificationPrice(params.service);

  const debit = await debitWallet({
    userId: params.userId,
    amount: price.unitPrice,
    type: TransactionType.IDENTITY_SERVICE_REQUEST,
    description: params.description,
    metadata: {
      service: params.service,
      ...params.operational,
      unit_price: price.unitPrice,
      pii: sealPII(params.pii)
    } as Prisma.InputJsonValue,
    idempotencyKey: params.idempotencyKey,
    costKobo: price.providerCostKobo
  });

  if (debit.reused) {
    const metadata = debit.transaction.metadata as Record<string, unknown> | null;
    const ticketId = metadata?.ticket_id?.toString();
    if (ticketId) {
      return { reference: debit.reference, ticketId, balanceAfter: koboToNaira(debit.transaction.balanceAfterKobo) };
    }
    // Reused but never actually reached Techhub (submit failed last time,
    // already refunded) - fall through and retry the submission below.
  }

  const result = await params.call();

  if (!result.ok || !result.ticketId) {
    await prisma.transaction.update({
      where: { id: debit.transaction.id },
      data: { status: TransactionStatus.FAILED, provider: 'techhub' }
    });
    await refundWallet({ transactionId: debit.transaction.id, userId: params.userId });
    throw new ApiError(502, result.message, 'TECHHUB_SUBMIT_FAILED');
  }

  const existingMetadata = debit.transaction.metadata as Record<string, unknown> | null;
  await prisma.transaction.update({
    where: { id: debit.transaction.id },
    data: {
      provider: 'techhub',
      providerRef: result.ticketId,
      metadata: {
        service: params.service,
        ...params.operational,
        unit_price: price.unitPrice,
        ticket_id: result.ticketId,
        pii: mergeSealedPII(existingMetadata?.pii, { ...params.pii, submit_raw: result.raw })
      } as Prisma.InputJsonValue
      // status intentionally left PENDING - see checkAsyncServiceStatus below.
    }
  });

  return { reference: debit.reference, ticketId: result.ticketId, balanceAfter: debit.balanceAfter };
}

/**
 * Polls Techhub for a ticket this user already submitted. Settles (and, on
 * failure, refunds) the underlying Transaction the first time Techhub
 * reports success/failed; safe to call repeatedly after that since it reads
 * straight back from our own DB once a ticket is no longer PENDING.
 */
async function checkAsyncServiceStatus(params: {
  userId: string;
  ticketId: string;
  call: (ticketId: string) => ReturnType<typeof techhubService.checkDelinking>;
}): Promise<AsyncStatusResult> {
  const transaction = await prisma.transaction.findFirst({
    where: { userId: params.userId, providerRef: params.ticketId, provider: 'techhub' }
  });
  if (!transaction) {
    throw new ApiError(404, 'Unknown ticket_id', 'TICKET_NOT_FOUND');
  }

  if (transaction.status === TransactionStatus.SUCCESS || transaction.status === TransactionStatus.FAILED) {
    const metadata = transaction.metadata as Record<string, unknown> | null;
    const pii = openPII<{ response?: Record<string, unknown> | null }>(metadata?.pii);
    return {
      ticketId: params.ticketId,
      status: transaction.status === TransactionStatus.SUCCESS ? 'success' : 'failed',
      response: pii?.response ?? null
    };
  }

  const result = await params.call(params.ticketId);
  const existingMetadata = (transaction.metadata as Record<string, unknown> | null) ?? {};

  if (result.status === 'pending') {
    return { ticketId: result.ticketId, status: 'pending', response: null };
  }

  if (result.status === 'success') {
    await prisma.transaction.update({
      where: { id: transaction.id },
      data: {
        status: TransactionStatus.SUCCESS,
        metadata: {
          ...existingMetadata,
          pii: mergeSealedPII(existingMetadata.pii, { response: result.response, check_raw: result.raw })
        } as Prisma.InputJsonValue
      }
    });

    // costKobo was captured at submit time in submitAsyncService() above
    // (Techhub charges our balance on submit, same as their own docs
    // describe) - reuse it here rather than re-deriving the price, since
    // pricing could have changed between submit and this eventual outcome.
    if (transaction.costKobo) {
      await recordProviderDebit({
        provider: 'techhub',
        amountKobo: transaction.costKobo,
        relatedTransactionId: transaction.id,
        description: transaction.description
      }).catch((error) => {
        console.error('[provider-ledger] failed to record debit for', transaction.id, error);
      });
    }

    return { ticketId: result.ticketId, status: 'success', response: result.response };
  }

  // 'failed' - Techhub auto-refunds their own balance per the docs; we mirror
  // that on our side by refunding the user's MDL wallet the moment we learn
  // the outcome (which may be well after the original submit, hence this
  // living here rather than in submitAsyncService above).
  await prisma.transaction.update({
    where: { id: transaction.id },
    data: {
      status: TransactionStatus.FAILED,
      metadata: {
        ...existingMetadata,
        pii: mergeSealedPII(existingMetadata.pii, { response: result.response, check_raw: result.raw })
      } as Prisma.InputJsonValue
    }
  });
  await refundWallet({ transactionId: transaction.id, userId: params.userId });
  return { ticketId: result.ticketId, status: 'failed', response: result.response };
}

export function submitDelinking(params: { userId: string; nin: string; email: string; idempotencyKey?: string }) {
  return submitAsyncService({
    userId: params.userId,
    service: 'NIN_DELINKING',
    description: 'NIN delinking request',
    operational: {},
    pii: { nin: params.nin, email: params.email },
    idempotencyKey: params.idempotencyKey,
    call: () => techhubService.submitDelinking(params.nin, params.email)
  });
}
export function checkDelinkingStatus(params: { userId: string; ticketId: string }) {
  return checkAsyncServiceStatus({
    userId: params.userId,
    ticketId: params.ticketId,
    call: (id) => techhubService.checkDelinking(id)
  });
}

export function submitNinValidation(params: { userId: string; nin: string; validationType?: string; idempotencyKey?: string }) {
  return submitAsyncService({
    userId: params.userId,
    service: 'NIN_VALIDATION',
    description: 'NIN validation request',
    operational: { validation_type: params.validationType },
    pii: { nin: params.nin },
    idempotencyKey: params.idempotencyKey,
    call: () => techhubService.submitNinValidation(params.nin, params.validationType)
  });
}
export function checkNinValidationStatus(params: { userId: string; ticketId: string }) {
  return checkAsyncServiceStatus({
    userId: params.userId,
    ticketId: params.ticketId,
    call: (id) => techhubService.checkNinValidation(id)
  });
}

export function submitPersonalization(params: { userId: string; trackingId: string; idempotencyKey?: string }) {
  return submitAsyncService({
    userId: params.userId,
    service: 'NIN_PERSONALIZATION',
    description: 'NIN personalization request',
    operational: {},
    pii: { tracking_id: params.trackingId },
    idempotencyKey: params.idempotencyKey,
    call: () => techhubService.submitPersonalization(params.trackingId)
  });
}
export function checkPersonalizationStatus(params: { userId: string; ticketId: string }) {
  return checkAsyncServiceStatus({
    userId: params.userId,
    ticketId: params.ticketId,
    call: (id) => techhubService.checkPersonalization(id)
  });
}

export function submitBvnRetrieval(params: {
  userId: string;
  firstName: string;
  lastName: string;
  phoneNumber: string;
  idempotencyKey?: string;
}) {
  return submitAsyncService({
    userId: params.userId,
    service: 'BVN_RETRIEVAL',
    description: 'BVN retrieval request',
    operational: {},
    pii: { first_name: params.firstName, last_name: params.lastName, phone_number: params.phoneNumber },
    idempotencyKey: params.idempotencyKey,
    call: () =>
      techhubService.submitBvnRetrieval({
        first_name: params.firstName,
        last_name: params.lastName,
        phone_number: params.phoneNumber
      })
  });
}
export function checkBvnRetrievalStatus(params: { userId: string; ticketId: string }) {
  return checkAsyncServiceStatus({
    userId: params.userId,
    ticketId: params.ticketId,
    call: (id) => techhubService.checkBvnRetrieval(id)
  });
}

export function submitIpeClearance(params: { userId: string; trackingId: string; idempotencyKey?: string }) {
  return submitAsyncService({
    userId: params.userId,
    service: 'IPE_CLEARANCE',
    description: 'IPE clearance request',
    operational: {},
    pii: { tracking_id: params.trackingId },
    idempotencyKey: params.idempotencyKey,
    call: () => techhubService.submitIpeClearance(params.trackingId)
  });
}
export function checkIpeClearanceStatus(params: { userId: string; ticketId: string }) {
  return checkAsyncServiceStatus({
    userId: params.userId,
    ticketId: params.ticketId,
    call: (id) => techhubService.checkIpeClearance(id)
  });
}

/**
 * Decrypts the PII sealed on a verification Transaction's metadata. The ONE
 * place this is ever called from is the "View PII" admin action on the
 * Transaction resource (src/admin/resources/transaction.resource.ts), which
 * is SUPER_ADMIN-gated and writes an AdminAuditLog row every time it's used -
 * see that file for the access-control and audit-trail side of this.
 */
export function decryptTransactionPII(metadata: unknown): Record<string, unknown> | null {
  const parsed = metadata as Record<string, unknown> | null;
  return openPII(parsed?.pii);
}
