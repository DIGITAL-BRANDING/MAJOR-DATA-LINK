import { Prisma, TransactionStatus, TransactionType } from '@prisma/client';
import { koboToNaira } from '../lib/money.js';
import { mergeSealedPII, openPII, sealPII } from '../lib/pii.js';
import { prisma } from '../lib/prisma.js';
import { publicVerificationMessage } from '../lib/public-verification-message.js';
import { ApiError } from '../middleware/error.js';
import { debitWallet, refundWallet } from './wallet.service.js';
import { recordProviderDebit } from './provider-ledger.service.js';
import {
  techhubService,
  type TechhubBvnTier,
  type TechhubSlipResult,
  type TechhubSlipTier,
  type TechhubAsyncSubmitResult,
  type TechhubAsyncStatusResult
} from './techhub.service.js';
import { franceverifiedSlipAdapter } from './franceverified-slip-adapter.service.js';
import type { IdentitySlipTier } from '../lib/render-identity-slip-pdf.js';
import { submitNinValidationFV, checkNinValidationFV } from './franceverified-nin-validation-adapter.service.js';
import { checkIpeClearanceFV, submitIpeClearanceFV } from './franceverified-ipe-adapter.service.js';

/**
 * Which upstream API actually fulfils a given ServicePricing row right now -
 * admin-editable per service, NOT a global switch. See the `provider` column
 * comment on ServicePricing in schema.prisma. Add a new value here (and a
 * matching branch in slipCallFor()/asyncCallFor() below) whenever a service
 * gains a second real provider - so far that's only the four NIN/BVN slip
 * flows (FranceVerified's JSON-only responses get turned into a PDF by
 * franceverified-slip-adapter.service.ts).
 */
/** `manual` keeps an accepted request in our encrypted queue for an admin. */
export type VerificationProvider = 'techhub' | 'franceverified' | 'manual';

/**
 * Emits operational timing and the selected service provider: no user ID,
 * identifier, ticket, or response body. This gives us a production latency
 * baseline and provider-level failure signal without logging PII.
 */
async function timedVerificationCall<T>(
  service: string,
  operation: 'lookup' | 'submit' | 'status',
  call: () => Promise<T>,
  options: { provider?: VerificationProvider; succeeded?: (result: T) => boolean } = {}
): Promise<T> {
  const startedAt = Date.now();
  try {
    const result = await call();
    const outcome = options.succeeded ? (options.succeeded(result) ? 'success' : 'failed') : 'completed';
    console.info('[verification] upstream timing', JSON.stringify({ service, ...(options.provider ? { provider: options.provider } : {}), operation, duration_ms: Date.now() - startedAt, outcome }));
    return result;
  } catch (error) {
    console.warn('[verification] upstream timing', JSON.stringify({ service, ...(options.provider ? { provider: options.provider } : {}), operation, duration_ms: Date.now() - startedAt, outcome: 'error' }));
    throw error;
  }
}

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
  'NIN_PERSONAL_INFO_SLIP',
  'NIN_PHONE_SLIP_PREMIUM',
  'NIN_PHONE_SLIP_STANDARD',
  'NIN_PHONE_SLIP_REGULAR',
  'NIN_PHONE_PERSONAL_INFO_SLIP',
  'NIN_DEMOGRAPHIC',
  'BVN_SLIP_PREMIUM',
  'BVN_SLIP_STANDARD',
  'NIN_DELINKING',
  'NIN_VALIDATION_GENERAL',
  'NIN_VALIDATION_NO_RECORD',
  'NIN_VALIDATION_SIM',
  'NIN_VALIDATION_BANK',
  'NIN_VALIDATION_UPDATE_RECORDS',
  'NIN_VALIDATION_MODIFICATION',
  'NIN_VALIDATION_PHOTO_ERROR',
  'NIN_VALIDATION_VNIN',
  'NIN_PERSONALIZATION',
  'BVN_RETRIEVAL',
  'IPE_CLEARANCE',
  'IPE_CLEARANCE_GET_OLD_TRACKING_ID',
  'IPE_CLEARANCE_INPROCESSING_ERROR',
  'IPE_CLEARANCE_TRACKING_IS_BEING_PROCESSED',
  'IPE_CLEARANCE_MODIFICATION_IPE',
  'IPE_CLEARANCE_HIT_BLOCKED',
  // Two user-facing, single-provider-locked tiles (see purchaseNinVerificationV1/V2
  // below) - NOT admin-switchable like every other service above. The whole
  // point is that the END USER picks which upstream API to hit (V1=Techhub,
  // V2=FranceVerified) when one of them is having network trouble, instead of
  // an admin having to reconfigure ServicePricing.provider under pressure
  // during an outage and remembering to flip it back after. V1/V2 use the
  // same five customer-facing tiers as a normal NIN-by-NIN verification.
  // Keeping a price row per tier is important: an administrator can set the
  // exact retail/partner price of every selectable option in either app.
  'NIN_VERIFICATION_V1_PREMIUM',
  'NIN_VERIFICATION_V1_STANDARD',
  'NIN_VERIFICATION_V1_REGULAR',
  'NIN_VERIFICATION_V1_VNIN',
  'NIN_VERIFICATION_V1_PERSONAL',
  'NIN_VERIFICATION_V2_PREMIUM',
  'NIN_VERIFICATION_V2_STANDARD',
  'NIN_VERIFICATION_V2_REGULAR',
  'NIN_VERIFICATION_V2_VNIN',
  // France-only slip looks (Techhub has no equivalent, so no V1 counterpart).
  'NIN_VERIFICATION_V2_SMART',
  'NIN_VERIFICATION_V2_PORTRAIT',
  'NIN_VERIFICATION_V2_PERSONAL',
  // Same provider-pinned pattern as NIN_VERIFICATION_V1/V2 above, extended to
  // the By-Phone and By-Demographic lookups - a customer can route around a
  // Techhub outage on these too instead of being stuck on the single
  // admin-routed NIN_PHONE_SLIP_*/NIN_DEMOGRAPHIC service, which has no
  // customer-facing fallback if Techhub's phone/demographic endpoint is
  // failing. VNIN has no by-phone equivalent (see NIN_BY_PHONE_PATH's
  // comment in techhub.service.ts), so no V1/V2 VNIN variant here either.
  'NIN_PHONE_SLIP_V1_PREMIUM',
  'NIN_PHONE_SLIP_V1_STANDARD',
  'NIN_PHONE_SLIP_V1_REGULAR',
  'NIN_PHONE_SLIP_V1_PERSONAL',
  'NIN_PHONE_SLIP_V2_PREMIUM',
  'NIN_PHONE_SLIP_V2_STANDARD',
  'NIN_PHONE_SLIP_V2_REGULAR',
  'NIN_PHONE_SLIP_V2_PERSONAL',
  'NIN_DEMOGRAPHIC_V1',
  'NIN_DEMOGRAPHIC_V2'
] as const;

export type VerificationServiceKey = (typeof SERVICE_KEYS)[number];
export type IpeClearanceType = 'get_old_tracking_id' | 'inprocessing_error' | 'tracking_is_being_processed' | 'modification_ipe' | 'hit_blocked';
const IPE_PARTNER_PRICE_SERVICE: Record<IpeClearanceType, VerificationServiceKey> = {
  get_old_tracking_id: 'IPE_CLEARANCE_GET_OLD_TRACKING_ID',
  inprocessing_error: 'IPE_CLEARANCE_INPROCESSING_ERROR',
  tracking_is_being_processed: 'IPE_CLEARANCE_TRACKING_IS_BEING_PROCESSED',
  modification_ipe: 'IPE_CLEARANCE_MODIFICATION_IPE',
  hit_blocked: 'IPE_CLEARANCE_HIT_BLOCKED'
};

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
const DEFAULTS: Record<VerificationServiceKey, { label: string; price: number; provider?: VerificationProvider }> = {
  NIN_SLIP_PREMIUM: { label: 'NIN Slip (Premium) — by NIN', price: 120 },
  NIN_SLIP_STANDARD: { label: 'NIN Slip (Standard) — by NIN', price: 120 },
  NIN_SLIP_REGULAR: { label: 'NIN Slip (Regular) — by NIN', price: 120 },
  NIN_SLIP_VNIN: { label: 'NIN Slip (VNIN) — by NIN', price: 120 },
  NIN_PERSONAL_INFO_SLIP: { label: 'NIN Personal Information Slip — by NIN', price: 120 },
  NIN_PHONE_SLIP_PREMIUM: { label: 'NIN Slip (Premium) — by Phone', price: 130 },
  NIN_PHONE_SLIP_STANDARD: { label: 'NIN Slip (Standard) — by Phone', price: 130 },
  NIN_PHONE_SLIP_REGULAR: { label: 'NIN Slip (Regular) — by Phone', price: 130 },
  NIN_PHONE_PERSONAL_INFO_SLIP: { label: 'NIN Personal Information Slip — by Phone', price: 130 },
  NIN_DEMOGRAPHIC: { label: 'NIN Slip — by Demographic', price: 130 },
  BVN_SLIP_PREMIUM: { label: 'BVN Slip (Premium)', price: 80 },
  BVN_SLIP_STANDARD: { label: 'BVN Slip (Standard)', price: 80 },
  NIN_DELINKING: { label: 'NIN Delinking', price: 3500 },
  // NIN Validation used to be ONE flat-priced service regardless of which of
  // Techhub's 8 validation_type variants was requested. That was wrong: a
  // live submit response confirmed 'sim' actually costs ₦300 at Techhub, not
  // the old flat ₦1000 default - and techhub.co's OWN dashboard prices three
  // of the eight variants (v.nin validation, modification, photographic
  // error) 20% higher than the rest (₦1,200 vs ₦1,000 there), which is
  // consistent with those three being pricier to fulfill on their side too.
  // Only NIN_VALIDATION_SIM's ₦300 is a confirmed real provider cost from an
  // actual API response; the other seven are ESTIMATES carrying that same
  // ~1.5x-of-confirmed / 1.2x-between-tiers ratio - update each via the
  // "Verification Pricing" admin page (or PATCH /api/admin/service-prices)
  // once its real Techhub cost is confirmed, no redeploy needed.
  NIN_VALIDATION_GENERAL: { label: 'NIN Validation — General', price: 300 },
  NIN_VALIDATION_NO_RECORD: { label: 'NIN Validation — No Record Found', price: 300 },
  NIN_VALIDATION_SIM: { label: 'NIN Validation — SIM Validation', price: 300 }, // confirmed
  NIN_VALIDATION_BANK: { label: 'NIN Validation — Bank Validation', price: 300 },
  NIN_VALIDATION_UPDATE_RECORDS: { label: 'NIN Validation — Update Records', price: 300 },
  NIN_VALIDATION_MODIFICATION: { label: 'NIN Validation — Modification', price: 360 },
  NIN_VALIDATION_PHOTO_ERROR: { label: 'NIN Validation — Photographic Error', price: 360 },
  NIN_VALIDATION_VNIN: { label: 'NIN Validation — v.NIN Validation', price: 360 },
  NIN_PERSONALIZATION: { label: 'NIN Personalization', price: 300 },
  BVN_RETRIEVAL: { label: 'BVN Retrieval', price: 700 },
  // IPE requests require staff review by default. Admins can explicitly
  // switch this service to Techhub from the NIN/BVN Provider settings.
  IPE_CLEARANCE: { label: 'IPE Clearance', price: 450, provider: 'manual' },
  IPE_CLEARANCE_GET_OLD_TRACKING_ID: { label: 'IPE Clearance — Get Old Tracking ID', price: 450, provider: 'manual' },
  IPE_CLEARANCE_INPROCESSING_ERROR: { label: 'IPE Clearance — Inprocessing Error', price: 450, provider: 'manual' },
  IPE_CLEARANCE_TRACKING_IS_BEING_PROCESSED: { label: 'IPE Clearance — Tracking Is Being Processed', price: 450, provider: 'manual' },
  IPE_CLEARANCE_MODIFICATION_IPE: { label: 'IPE Clearance — Modification IPE', price: 450, provider: 'manual' },
  IPE_CLEARANCE_HIT_BLOCKED: { label: 'IPE Clearance — HIT/Blocked', price: 450, provider: 'manual' },
  // provider is explicit (not left to getOrCreateVerificationPricingRow's
  // 'techhub' default) so these two are correctly wired the moment their
  // ServicePricing row is first created - no admin has to remember to open
  // "Verification Pricing" and flip the provider before V2 actually works.
  // V1 sets 'techhub' explicitly too, purely for symmetry/clarity, since it
  // happens to match the row-creation default anyway.
  NIN_VERIFICATION_V1_PREMIUM: { label: 'NIN Verification V1 (Premium)', price: 120, provider: 'techhub' },
  NIN_VERIFICATION_V1_STANDARD: { label: 'NIN Verification V1 (Standard)', price: 120, provider: 'techhub' },
  NIN_VERIFICATION_V1_REGULAR: { label: 'NIN Verification V1 (Regular)', price: 120, provider: 'techhub' },
  NIN_VERIFICATION_V1_VNIN: { label: 'NIN Verification V1 (VNIN)', price: 120, provider: 'techhub' },
  NIN_VERIFICATION_V1_PERSONAL: { label: 'NIN Verification V1 (Personal Info)', price: 120, provider: 'techhub' },
  NIN_VERIFICATION_V2_PREMIUM: { label: 'NIN Verification V2 (Premium)', price: 120, provider: 'franceverified' },
  NIN_VERIFICATION_V2_STANDARD: { label: 'NIN Verification V2 (Standard)', price: 120, provider: 'franceverified' },
  NIN_VERIFICATION_V2_REGULAR: { label: 'NIN Verification V2 (Regular)', price: 120, provider: 'franceverified' },
  NIN_VERIFICATION_V2_VNIN: { label: 'NIN Verification V2 (VNIN)', price: 120, provider: 'franceverified' },
  NIN_VERIFICATION_V2_SMART: { label: 'NIN Verification V2 (Smart ID Card)', price: 120, provider: 'franceverified' },
  NIN_VERIFICATION_V2_PORTRAIT: { label: 'NIN Verification V2 (Premium Portrait)', price: 120, provider: 'franceverified' },
  NIN_VERIFICATION_V2_PERSONAL: { label: 'NIN Verification V2 (Personal Info)', price: 120, provider: 'franceverified' },
  NIN_PHONE_SLIP_V1_PREMIUM: { label: 'NIN Slip V1 (Premium) — by Phone', price: 130, provider: 'techhub' },
  NIN_PHONE_SLIP_V1_STANDARD: { label: 'NIN Slip V1 (Standard) — by Phone', price: 130, provider: 'techhub' },
  NIN_PHONE_SLIP_V1_REGULAR: { label: 'NIN Slip V1 (Regular) — by Phone', price: 130, provider: 'techhub' },
  NIN_PHONE_SLIP_V1_PERSONAL: { label: 'NIN Personal Information Slip V1 — by Phone', price: 130, provider: 'techhub' },
  NIN_PHONE_SLIP_V2_PREMIUM: { label: 'NIN Slip V2 (Premium) — by Phone', price: 130, provider: 'franceverified' },
  NIN_PHONE_SLIP_V2_STANDARD: { label: 'NIN Slip V2 (Standard) — by Phone', price: 130, provider: 'franceverified' },
  NIN_PHONE_SLIP_V2_REGULAR: { label: 'NIN Slip V2 (Regular) — by Phone', price: 130, provider: 'franceverified' },
  NIN_PHONE_SLIP_V2_PERSONAL: { label: 'NIN Personal Information Slip V2 — by Phone', price: 130, provider: 'franceverified' },
  NIN_DEMOGRAPHIC_V1: { label: 'NIN Slip V1 — by Demographic', price: 130, provider: 'techhub' },
  NIN_DEMOGRAPHIC_V2: { label: 'NIN Slip V2 — by Demographic', price: 130, provider: 'franceverified' }
};

// Maps the validation_type string Techhub's API (and our own zod enum in
// verification.routes.ts) expects onto the priced service key it should be
// billed under. 'nin_validation' (Techhub's own default when validation_type
// is omitted) and any unrecognized value both fall back to the GENERAL tier.
const NIN_VALIDATION_SERVICE_BY_TYPE: Record<string, VerificationServiceKey> = {
  nin_validation: 'NIN_VALIDATION_GENERAL',
  no_record: 'NIN_VALIDATION_NO_RECORD',
  sim: 'NIN_VALIDATION_SIM',
  bank_validation: 'NIN_VALIDATION_BANK',
  update_records: 'NIN_VALIDATION_UPDATE_RECORDS',
  modification: 'NIN_VALIDATION_MODIFICATION',
  photo_error: 'NIN_VALIDATION_PHOTO_ERROR',
  'v.nin_validation': 'NIN_VALIDATION_VNIN'
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
        provider: defaults.provider ?? 'techhub',
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

/**
 * Throws SERVICE_INACTIVE if disabled - use right before spending money on
 * this service.
 *
 * `forPartner: true` charges the API Partner rate (partnerSellingPriceKobo)
 * instead of the retail web/app rate (sellingPriceKobo). An admin can leave
 * partnerSellingPriceKobo unset to keep charging partners the same as
 * retail, or set it (usually lower, since a partner is closer to
 * wholesale/provider cost) via the "Verification Pricing" admin page or
 * PATCH /api/admin/service-prices/:service. Falls all the way back to
 * providerCostKobo if neither price is configured yet.
 */
export async function getVerificationPrice(service: VerificationServiceKey, opts: { forPartner?: boolean; ipeType?: IpeClearanceType } = {}) {
  const row = await getOrCreateVerificationPricingRow(service);
  if (!row.isActive) {
    throw new ApiError(422, `${row.label} is currently unavailable`, 'SERVICE_INACTIVE');
  }
  const partnerIpeRow = opts.forPartner && service === 'IPE_CLEARANCE' && opts.ipeType
    ? await getOrCreateVerificationPricingRow(IPE_PARTNER_PRICE_SERVICE[opts.ipeType])
    : null;
  if (partnerIpeRow && !partnerIpeRow.isActive) {
    throw new ApiError(422, `${partnerIpeRow.label} is currently unavailable`, 'SERVICE_INACTIVE');
  }
  const unitKobo = opts.forPartner
    ? partnerIpeRow?.partnerSellingPriceKobo ?? partnerIpeRow?.sellingPriceKobo ?? partnerIpeRow?.providerCostKobo ?? row.partnerSellingPriceKobo ?? row.sellingPriceKobo ?? row.providerCostKobo
    : row.sellingPriceKobo ?? row.providerCostKobo;
  return {
    service: row.service,
    label: row.label,
    unitPrice: koboToNaira(unitKobo),
    providerCostKobo: row.providerCostKobo,
    // Which upstream API actually fulfils this service right now - admin-set
    // via PATCH /api/admin/service-prices/:service or the "Verification
    // Pricing" AdminJS page. Free-text column (see schema.prisma), so
    // 'franceverified' needs no migration to become a valid value here.
    provider: row.provider as VerificationProvider
  };
}

/** Public price list for every screen to read from - never throws on a disabled service. */
export async function listVerificationPrices() {
  const rows = await Promise.all(SERVICE_KEYS.map((key) => getOrCreateVerificationPricingRow(key)));
  return rows.filter((row) => !row.service.startsWith('IPE_CLEARANCE_')).map((row) => ({
    service: row.service,
    label: row.label,
    unitPrice: koboToNaira(row.sellingPriceKobo ?? row.providerCostKobo),
    isActive: row.isActive
  }));
}

/**
 * Same shape as listVerificationPrices(), but for the API Partner-facing
 * dashboard/`/verification/prices` endpoint - reflects what a partner is
 * actually charged (partnerSellingPriceKobo when an admin has set one),
 * not the retail web price.
 */
export async function listVerificationPricesForPartner() {
  const rows = await Promise.all(SERVICE_KEYS.map((key) => getOrCreateVerificationPricingRow(key)));
  return rows.filter((row) => row.service !== 'IPE_CLEARANCE').map((row) => ({
    service: row.service,
    label: row.label,
    unitPrice: koboToNaira(row.partnerSellingPriceKobo ?? row.sellingPriceKobo ?? row.providerCostKobo),
    isActive: row.isActive
  }));
}

/** Admin-facing listing, merged into the same /api/admin/service-prices endpoint as result pins. */
export async function listVerificationPricesForAdmin() {
  const rows = await Promise.all(SERVICE_KEYS.map((key) => getOrCreateVerificationPricingRow(key)));
  return rows.map((row) => ({
    service: row.service,
    label: row.label,
    provider: row.provider,
    provider_cost: koboToNaira(row.providerCostKobo),
    selling_price: row.sellingPriceKobo ? koboToNaira(row.sellingPriceKobo) : null,
    partner_selling_price: row.partnerSellingPriceKobo ? koboToNaira(row.partnerSellingPriceKobo) : null,
    is_active: row.isActive
  }));
}

// ── Slip lookups (synchronous) ──────────────────────────────────

export type SlipPurchaseResult = {
  status: boolean;
  message: string;
  reference: string;
  /** Owner-scoped transaction ID used by the authenticated PDF endpoint. */
  transactionId: string;
  userData?: Record<string, unknown>;
  pdfBase64?: string;
  pdfUrl?: string;
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
  // One call per provider this service could be routed to. Only the branch
  // matching the resolved ServicePricing.provider is ever invoked - see
  // slipCallFor() usage at each call site below for which providers a given
  // slip flow actually supports today.
  callByProvider: Partial<Record<VerificationProvider, () => Promise<TechhubSlipResult>>>;
  /** The admin-routed by-NIN service can recover from a provider-specific
   * no-record response by checking the same NIN with the other provider. */
  retryNoRecordWith?: Partial<Record<VerificationProvider, () => Promise<TechhubSlipResult>>>;
}): Promise<SlipPurchaseResult> {
  const price = await getVerificationPrice(params.service);
  if (price.provider === 'manual') {
    const debit = await debitWallet({
      userId: params.userId, amount: price.unitPrice, type: params.transactionType, description: params.description,
      metadata: { service: params.service, ...params.operational, unit_price: price.unitPrice, manual_processing: true, pii: sealPII(params.pii) } as Prisma.InputJsonValue,
      idempotencyKey: params.idempotencyKey
    });
    const metadata = debit.transaction.metadata as Record<string, unknown> | null;
    if (!debit.transaction.providerRef) {
      const ticketId = `MANUAL-${debit.reference}`;
      await prisma.transaction.update({ where: { id: debit.transaction.id }, data: { provider: 'manual', providerRef: ticketId,
        metadata: { service: params.service, ...params.operational, unit_price: price.unitPrice, ticket_id: ticketId, manual_processing: true, pii: mergeSealedPII(metadata?.pii, params.pii) } as Prisma.InputJsonValue } });
    }
    return { status: true, message: 'Request received and queued for manual admin processing.', reference: debit.reference, transactionId: debit.transaction.id, balanceAfter: debit.balanceAfter };
  }
  const call = params.callByProvider[price.provider];
  if (!call) {
    // Admin pointed this service at a provider that has no implementation
    // for it yet (e.g. NIN Personalization has no FranceVerified
    // equivalent - see franceverified/nin.service.ts) - fail loud rather
    // than silently falling back to a provider the admin didn't choose.
    throw new ApiError(
      500,
      'This verification service is temporarily unavailable. Please try again later.',
      'PROVIDER_NOT_IMPLEMENTED'
    );
  }

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
    // Both providers quote one flat rate per slip family (see the DEFAULTS
    // comment above) - fixed and known up front, no balance-delta correction
    // needed either way.
    costKobo: price.providerCostKobo
  });

  if (debit.reused && debit.transaction.status !== TransactionStatus.PENDING) {
    const metadata = debit.transaction.metadata as Record<string, unknown> | null;
    const pii = openPII<{ user_data?: Record<string, unknown>; pdf_base64?: string; pdf_url?: string }>(metadata?.pii);
    return {
      status: debit.transaction.status === TransactionStatus.SUCCESS,
      message: 'Transaction already processed',
      reference: debit.reference,
      transactionId: debit.transaction.id,
      userData: pii?.user_data,
      pdfBase64: pii?.pdf_base64,
      pdfUrl: pii?.pdf_url,
      balanceAfter: koboToNaira(debit.transaction.balanceAfterKobo)
    };
  }

  let actualProvider = price.provider;
  let result = await timedVerificationCall(params.service, 'lookup', call, {
    provider: price.provider,
    succeeded: (response) => typeof response === 'object' && response !== null && 'ok' in response && response.ok === true
  });

  const noRecord = !result.ok && /\b(?:no\s+record\s+found|record\s+not\s+found|no\s+match\s+found|data\s+not\s+found)\b/i.test(result.message);
  const fallbackProvider: VerificationProvider = price.provider === 'techhub' ? 'franceverified' : 'techhub';
  const fallbackCall = noRecord ? params.retryNoRecordWith?.[fallbackProvider] : undefined;
  if (fallbackCall) {
    console.info(`[verification] ${params.service} returned no record from ${price.provider}; retrying ${fallbackProvider}`);
    actualProvider = fallbackProvider;
    result = await timedVerificationCall(params.service, 'lookup', fallbackCall, {
      provider: fallbackProvider,
      succeeded: (response) => typeof response === 'object' && response !== null && 'ok' in response && response.ok === true
    });
  }

  if (result.ok) {
    const recognisedFieldCount = Object.keys(result.userData ?? {}).filter((k) => k !== 'photo').length;
    if (recognisedFieldCount <= 2) {
      // Not necessarily a bug on our side - some providers (FranceVerified's
      // by-phone lookup especially) genuinely return fewer fields than
      // their own docs sample for a given number, e.g. for privacy reasons
      // on a reverse phone->identity lookup. Logged so a support ticket
      // like "I paid for a slip and it came back nearly blank" can be
      // checked against what the provider actually sent, via `raw` below,
      // instead of guessing.
      console.warn(
        `[verification] ${params.service} slip rendered with only ${recognisedFieldCount} recognised field(s) - provider may have returned less data than expected. See this transaction's stored raw provider response.`
      );
    }
    const existingMetadata = debit.transaction.metadata as Record<string, unknown> | null;
    await prisma.transaction.update({
      where: { id: debit.transaction.id },
      data: {
        status: TransactionStatus.SUCCESS,
        provider: actualProvider,
        metadata: {
          service: params.service,
          ...params.operational,
          unit_price: price.unitPrice,
          pii: mergeSealedPII(existingMetadata?.pii, {
            ...params.pii,
            user_data: result.userData,
            pdf_base64: result.pdfBase64,
            pdf_url: result.pdfUrl,
            provider_raw_response: result.raw
          })
        } as Prisma.InputJsonValue
      }
    });

    // Both providers quote one flat rate per slip family, already stored as
    // price.providerCostKobo above - no balance-delta correction available
    // or needed (unlike Alrahuz data/airtime).
    //
    // Intentionally NOT awaited: this ledger write is best-effort bookkeeping
    // (already just logged on failure, never surfaced to the caller) and was
    // sitting on the response critical path right after a slow upstream
    // provider call. With FranceVerified/Techhub already able to take up to
    // TECHHUB_REQUEST_TIMEOUT_MS/PROVIDER_TIMEOUT_MS (20s) and the web
    // client's own request timeout only 25s, this extra DB round trip was
    // eating into an already thin margin and contributed to the frontend's
    // "request is taking too long" timeout even on responses that had, in
    // fact, succeeded.
    void recordProviderDebit({
      provider: actualProvider,
      amountKobo: price.providerCostKobo,
      relatedTransactionId: debit.transaction.id,
      description: params.description
    }).catch((error) => {
      console.error('[provider-ledger] failed to record debit for', debit.transaction.id, error);
    });

    return {
      status: true,
      message: result.message,
      reference: debit.reference,
      transactionId: debit.transaction.id,
      userData: result.userData,
      pdfBase64: result.pdfBase64,
      pdfUrl: result.pdfUrl,
      balanceAfter: debit.balanceAfter
    };
  }

  const existingMetadata = debit.transaction.metadata as Record<string, unknown> | null;
  await prisma.transaction.update({
    where: { id: debit.transaction.id },
    data: {
      status: TransactionStatus.FAILED,
      provider: actualProvider,
      metadata: {
        service: params.service,
        ...params.operational,
        unit_price: price.unitPrice,
        pii: mergeSealedPII(existingMetadata?.pii, {
          ...params.pii,
          response: { message: result.message },
          provider_raw_response: result.raw
        })
      } as Prisma.InputJsonValue
    }
  });
  const refunded = await refundWallet({ transactionId: debit.transaction.id, userId: params.userId });

  return {
    status: false,
    message: result.message,
    reference: debit.reference,
    transactionId: debit.transaction.id,
    balanceAfter: koboToNaira(refunded.balanceAfterKobo)
  };
}

const NIN_SLIP_SERVICE_BY_TIER: Record<TechhubSlipTier, VerificationServiceKey> = {
  premium: 'NIN_SLIP_PREMIUM',
  standard: 'NIN_SLIP_STANDARD',
  regular: 'NIN_SLIP_REGULAR',
  vnin: 'NIN_SLIP_VNIN'
};

type NinSlipChoice = TechhubSlipTier | 'personal';
type NinPhoneSlipChoice = Exclude<TechhubSlipTier, 'vnin'> | 'personal';
/** V2 (FranceVerified) has two layouts Techhub doesn't: the smart card and the portrait slip. */
type NinV2SlipChoice = NinSlipChoice | 'smart' | 'portrait';

/**
 * FranceVerified returns data only, so we draw the PDF ourselves and the tier
 * decides which layout (premium / standard / regular / vnin - see
 * identity-slip-layouts.ts). 'personal' has its own report renderer, which
 * takes no tier.
 */
function franceSlipTier(tier: NinV2SlipChoice): IdentitySlipTier | undefined {
  return tier === 'personal' ? undefined : tier;
}

const NIN_PHONE_SLIP_SERVICE_BY_TIER: Record<Exclude<TechhubSlipTier, 'vnin'>, VerificationServiceKey> = {
  premium: 'NIN_PHONE_SLIP_PREMIUM',
  standard: 'NIN_PHONE_SLIP_STANDARD',
  regular: 'NIN_PHONE_SLIP_REGULAR'
};

const NIN_PHONE_SLIP_V1_SERVICE_BY_TIER: Record<NinPhoneSlipChoice, VerificationServiceKey> = {
  premium: 'NIN_PHONE_SLIP_V1_PREMIUM',
  standard: 'NIN_PHONE_SLIP_V1_STANDARD',
  regular: 'NIN_PHONE_SLIP_V1_REGULAR',
  personal: 'NIN_PHONE_SLIP_V1_PERSONAL'
};

const NIN_PHONE_SLIP_V2_SERVICE_BY_TIER: Record<NinPhoneSlipChoice, VerificationServiceKey> = {
  premium: 'NIN_PHONE_SLIP_V2_PREMIUM',
  standard: 'NIN_PHONE_SLIP_V2_STANDARD',
  regular: 'NIN_PHONE_SLIP_V2_REGULAR',
  personal: 'NIN_PHONE_SLIP_V2_PERSONAL'
};

const BVN_SLIP_SERVICE_BY_TIER: Record<TechhubBvnTier, VerificationServiceKey> = {
  premium: 'BVN_SLIP_PREMIUM',
  standard: 'BVN_SLIP_STANDARD'
};

export function purchaseNinByNin(params: { userId: string; nin: string; tier: NinSlipChoice; idempotencyKey?: string }) {
  return purchaseSlip({
    userId: params.userId,
    service: params.tier === 'personal' ? 'NIN_PERSONAL_INFO_SLIP' : NIN_SLIP_SERVICE_BY_TIER[params.tier],
    transactionType: TransactionType.NIN_VERIFICATION,
    description: `NIN slip (${params.tier}) by NIN`,
    operational: { mode: 'by_nin', tier: params.tier },
    pii: { nin: params.nin },
    idempotencyKey: params.idempotencyKey,
    // FranceVerified's /nin/verify/nin has no premium/standard/regular/vnin
    // concept of its own - whichever tier's ServicePricing row is pointed at
    // franceverified calls the same underlying endpoint, and the tier picks
    // which slip layout we render from the result. Admin can still price
    // each tier differently.
    callByProvider: {
      techhub: () => params.tier === 'personal' ? techhubService.ninPersonalInfoByNin(params.nin) : techhubService.ninByNin(params.nin, params.tier),
      // Same data for every tier; only the rendered layout differs.
      franceverified: () => franceverifiedSlipAdapter.ninByNin(params.nin, franceSlipTier(params.tier), params.tier === 'personal')
    },
    // The regular admin-routed tile can use the same provider coverage as
    // V1/V2 if one provider's dataset cannot find an otherwise valid NIN.
    // Only a no-record response triggers this; provider outages and other
    // errors keep their original message and never fan out a second lookup.
    retryNoRecordWith: {
      techhub: () => params.tier === 'personal' ? techhubService.ninPersonalInfoByNin(params.nin) : techhubService.ninByNin(params.nin, params.tier),
      franceverified: () => franceverifiedSlipAdapter.ninByNin(params.nin, franceSlipTier(params.tier), params.tier === 'personal')
    }
  });
}

/**
 * "NIN Verification V1" - the user-facing tile that is always Techhub, full
 * stop. See the SERVICE_KEYS comment on NIN_VERIFICATION_V1/V2: this and
 * purchaseNinVerificationV2 exist specifically so a customer can route
 * around a provider outage themselves (pick the other tile) instead of
 * waiting on an admin to notice and flip ServicePricing.provider on the
 * shared by-NIN service. Only the 'techhub' branch is implemented on
 * purpose - if this row's provider is ever misconfigured to
 * 'franceverified', purchaseSlip's existing PROVIDER_NOT_IMPLEMENTED guard
 * fails loudly rather than silently doing the wrong thing.
 */
const NIN_VERIFICATION_V1_SERVICE_BY_TIER: Record<NinSlipChoice, VerificationServiceKey> = {
  premium: 'NIN_VERIFICATION_V1_PREMIUM',
  standard: 'NIN_VERIFICATION_V1_STANDARD',
  regular: 'NIN_VERIFICATION_V1_REGULAR',
  vnin: 'NIN_VERIFICATION_V1_VNIN',
  personal: 'NIN_VERIFICATION_V1_PERSONAL'
};

const NIN_VERIFICATION_V2_SERVICE_BY_TIER: Record<NinV2SlipChoice, VerificationServiceKey> = {
  premium: 'NIN_VERIFICATION_V2_PREMIUM',
  standard: 'NIN_VERIFICATION_V2_STANDARD',
  regular: 'NIN_VERIFICATION_V2_REGULAR',
  vnin: 'NIN_VERIFICATION_V2_VNIN',
  smart: 'NIN_VERIFICATION_V2_SMART',
  portrait: 'NIN_VERIFICATION_V2_PORTRAIT',
  personal: 'NIN_VERIFICATION_V2_PERSONAL'
};

export function purchaseNinVerificationV1(params: { userId: string; nin: string; tier: NinSlipChoice; idempotencyKey?: string }) {
  return purchaseSlip({
    userId: params.userId,
    service: NIN_VERIFICATION_V1_SERVICE_BY_TIER[params.tier],
    transactionType: TransactionType.NIN_VERIFICATION,
    description: `NIN Verification (V1 - Techhub, ${params.tier})`,
    operational: { mode: 'by_nin', tier: params.tier },
    pii: { nin: params.nin },
    idempotencyKey: params.idempotencyKey,
    callByProvider: {
      techhub: () => params.tier === 'personal'
        ? techhubService.ninPersonalInfoByNin(params.nin)
        : techhubService.ninByNin(params.nin, params.tier)
    }
  });
}

/** "NIN Verification V2" - the FranceVerified-only counterpart to V1 above. */
export function purchaseNinVerificationV2(params: { userId: string; nin: string; tier: NinV2SlipChoice; idempotencyKey?: string }) {
  return purchaseSlip({
    userId: params.userId,
    service: NIN_VERIFICATION_V2_SERVICE_BY_TIER[params.tier],
    transactionType: TransactionType.NIN_VERIFICATION,
    description: `NIN Verification (V2 - FranceVerified, ${params.tier})`,
    operational: { mode: 'by_nin', tier: params.tier },
    pii: { nin: params.nin },
    idempotencyKey: params.idempotencyKey,
    callByProvider: {
      franceverified: () => franceverifiedSlipAdapter.ninByNin(
        params.nin,
        franceSlipTier(params.tier),
        params.tier === 'personal'
      )
    }
  });
}

export function purchaseNinByPhone(params: {
  userId: string;
  phone: string;
  tier: NinPhoneSlipChoice;
  idempotencyKey?: string;
}) {
  return purchaseSlip({
    userId: params.userId,
    service: params.tier === 'personal' ? 'NIN_PHONE_PERSONAL_INFO_SLIP' : NIN_PHONE_SLIP_SERVICE_BY_TIER[params.tier],
    transactionType: TransactionType.NIN_VERIFICATION,
    description: `NIN slip (${params.tier}) by Phone`,
    operational: { mode: 'by_phone', tier: params.tier },
    pii: { phone: params.phone },
    idempotencyKey: params.idempotencyKey,
    callByProvider: {
      techhub: () => params.tier === 'personal' ? techhubService.ninPersonalInfoByPhone(params.phone) : techhubService.ninByPhone(params.phone, params.tier),
      franceverified: () => franceverifiedSlipAdapter.ninByPhone(params.phone, franceSlipTier(params.tier), params.tier === 'personal')
    }
  });
}

/**
 * "NIN by Phone V1"/"V2" - the same user-picked-provider pattern as
 * NIN_VERIFICATION_V1/V2 above, applied to the by-phone lookup. Lets a
 * customer route a by-phone request straight to FranceVerified (V2) when
 * Techhub's by-phone endpoint (V1) is down, instead of being stuck on
 * whichever provider the admin last configured for the generic
 * NIN_PHONE_SLIP_* service above.
 */
export function purchaseNinByPhoneV1(params: { userId: string; phone: string; tier: NinPhoneSlipChoice; idempotencyKey?: string }) {
  return purchaseSlip({
    userId: params.userId,
    service: NIN_PHONE_SLIP_V1_SERVICE_BY_TIER[params.tier],
    transactionType: TransactionType.NIN_VERIFICATION,
    description: `NIN slip (V1 - Techhub, ${params.tier}) by Phone`,
    operational: { mode: 'by_phone', tier: params.tier },
    pii: { phone: params.phone },
    idempotencyKey: params.idempotencyKey,
    callByProvider: {
      techhub: () => params.tier === 'personal' ? techhubService.ninPersonalInfoByPhone(params.phone) : techhubService.ninByPhone(params.phone, params.tier)
    }
  });
}

export function purchaseNinByPhoneV2(params: { userId: string; phone: string; tier: NinPhoneSlipChoice; idempotencyKey?: string }) {
  return purchaseSlip({
    userId: params.userId,
    service: NIN_PHONE_SLIP_V2_SERVICE_BY_TIER[params.tier],
    transactionType: TransactionType.NIN_VERIFICATION,
    description: `NIN slip (V2 - FranceVerified, ${params.tier}) by Phone`,
    operational: { mode: 'by_phone', tier: params.tier },
    pii: { phone: params.phone },
    idempotencyKey: params.idempotencyKey,
    callByProvider: {
      franceverified: () => franceverifiedSlipAdapter.ninByPhone(params.phone, franceSlipTier(params.tier), params.tier === 'personal')
    }
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
    callByProvider: {
      techhub: () =>
        techhubService.ninByDemographic({
          firstname: params.firstname,
          lastname: params.lastname,
          dob: params.dob,
          gender: params.gender
        }),
      franceverified: () =>
        franceverifiedSlipAdapter.ninByDemographic({
          firstname: params.firstname,
          lastname: params.lastname,
          dob: params.dob,
          gender: params.gender
        })
    }
  });
}

/** "NIN by Demographic V1"/"V2" - same user-picked-provider pattern as above. */
export function purchaseNinByDemographicV1(params: { userId: string; firstname: string; lastname: string; dob: string; gender?: string; idempotencyKey?: string }) {
  return purchaseSlip({
    userId: params.userId,
    service: 'NIN_DEMOGRAPHIC_V1',
    transactionType: TransactionType.NIN_VERIFICATION,
    description: 'NIN slip by demographic details (V1 - Techhub)',
    operational: { mode: 'by_demographic' },
    pii: { firstname: params.firstname, lastname: params.lastname, dob: params.dob, gender: params.gender },
    idempotencyKey: params.idempotencyKey,
    callByProvider: {
      techhub: () =>
        techhubService.ninByDemographic({
          firstname: params.firstname,
          lastname: params.lastname,
          dob: params.dob,
          gender: params.gender
        })
    }
  });
}

export function purchaseNinByDemographicV2(params: { userId: string; firstname: string; lastname: string; dob: string; gender?: string; idempotencyKey?: string }) {
  return purchaseSlip({
    userId: params.userId,
    service: 'NIN_DEMOGRAPHIC_V2',
    transactionType: TransactionType.NIN_VERIFICATION,
    description: 'NIN slip by demographic details (V2 - FranceVerified)',
    operational: { mode: 'by_demographic' },
    pii: { firstname: params.firstname, lastname: params.lastname, dob: params.dob, gender: params.gender },
    idempotencyKey: params.idempotencyKey,
    callByProvider: {
      franceverified: () =>
        franceverifiedSlipAdapter.ninByDemographic({
          firstname: params.firstname,
          lastname: params.lastname,
          dob: params.dob,
          gender: params.gender
        })
    }
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
    callByProvider: {
      techhub: () => techhubService.bvnSlip(params.bvn, params.tier),
      franceverified: () => franceverifiedSlipAdapter.bvnSlip(params.bvn, params.tier)
    }
  });
}

// ── Async services (submit + poll) ──────────────────────────────

export type AsyncSubmitResult = { reference: string; ticketId: string; balanceAfter: number };
export type AsyncStatusResult = { ticketId: string; status: 'pending' | 'success' | 'failed'; response: Record<string, unknown> | null };

/**
 * Shared by all five async flows. Debits immediately (the wallet charge
 * happens at submit time, same as Techhub's own docs describe for THEIR
 * balance), submits to whichever provider this service's ServicePricing row
 * is currently pointed at (same callByProvider dispatch purchaseSlip() uses
 * above - only techhub has an implementation for most of these five so far;
 * franceverified is only wired for NIN Validation's five supported
 * sub-types, see franceverified-nin-validation-adapter.service.ts), and
 * refunds right away if the provider rejects the submission outright. If
 * accepted, the transaction stays PENDING with providerRef = the provider's
 * own ticket_id/reference - the eventual success/failure (and any refund
 * for a failure) only happens later, when checkAsyncServiceStatus() below
 * is polled and the provider reports an outcome.
 *
 * Same PII split as purchaseSlip() above: `operational` metadata (service,
 * ticket_id) stays plaintext; `pii` (nin/email/tracking_id/names/phone, plus
 * the provider's submit_raw once it responds) is sealed with sealPII().
 */
async function submitAsyncService(params: {
  userId: string;
  service: VerificationServiceKey;
  description: string;
  operational: Record<string, unknown>;
  pii: Record<string, unknown>;
  idempotencyKey?: string;
  callByProvider: Partial<Record<VerificationProvider, () => Promise<TechhubAsyncSubmitResult>>>;
}): Promise<AsyncSubmitResult> {
  const price = await getVerificationPrice(params.service);
  // Manual routing deliberately does not call an upstream. The paid request
  // remains PENDING for an authorised admin to fulfil from the transaction
  // ledger (where its submitted PII is still encrypted at rest).
  if (price.provider === 'manual') {
    const debit = await debitWallet({
      userId: params.userId, amount: price.unitPrice, type: TransactionType.IDENTITY_SERVICE_REQUEST,
      description: params.description,
      metadata: { service: params.service, ...params.operational, unit_price: price.unitPrice, manual_processing: true, pii: sealPII(params.pii) } as Prisma.InputJsonValue,
      idempotencyKey: params.idempotencyKey
    });
    const existingMetadata = debit.transaction.metadata as Record<string, unknown> | null;
    const existingTicket = existingMetadata?.ticket_id?.toString();
    if (existingTicket) return { reference: debit.reference, ticketId: existingTicket, balanceAfter: koboToNaira(debit.transaction.balanceAfterKobo) };
    const ticketId = `MANUAL-${debit.reference}`;
    await prisma.transaction.update({ where: { id: debit.transaction.id }, data: {
      provider: 'manual', providerRef: ticketId,
      metadata: { service: params.service, ...params.operational, unit_price: price.unitPrice, ticket_id: ticketId, manual_processing: true,
        pii: mergeSealedPII(existingMetadata?.pii, params.pii) } as Prisma.InputJsonValue
    }});
    return { reference: debit.reference, ticketId, balanceAfter: debit.balanceAfter };
  }
  const call = params.callByProvider[price.provider];
  if (!call) {
    // Same "fail loud" reasoning as purchaseSlip() above - an admin pointed
    // this service at a provider with no implementation for it (e.g. NIN
    // Delinking has no FranceVerified equivalent at all yet).
    throw new ApiError(
      500,
      'This verification service is temporarily unavailable. Please try again later.',
      'PROVIDER_NOT_IMPLEMENTED'
    );
  }

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
    // Reused but never actually reached the provider (submit failed last
    // time, already refunded) - fall through and retry the submission below.
  }

  const result = await timedVerificationCall(params.service, 'submit', call);

  if (!result.ok || !result.ticketId) {
    await prisma.transaction.update({
      where: { id: debit.transaction.id },
      data: { status: TransactionStatus.FAILED, provider: price.provider }
    });
    await refundWallet({ transactionId: debit.transaction.id, userId: params.userId });
    throw new ApiError(502, result.message, 'VERIFICATION_SUBMIT_FAILED');
  }

  const existingMetadata = debit.transaction.metadata as Record<string, unknown> | null;
  await prisma.transaction.update({
    where: { id: debit.transaction.id },
    data: {
      provider: price.provider,
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
 * Polls whichever provider originally accepted this ticket (read back off
 * the transaction's own `provider` column - set by submitAsyncService()
 * above) for a ticket this user already submitted. Settles (and, on
 * failure, refunds) the underlying Transaction the first time the provider
 * reports success/failed; safe to call repeatedly after that since it reads
 * straight back from our own DB once a ticket is no longer PENDING.
 */
async function checkAsyncServiceStatus(params: {
  userId: string;
  ticketId: string;
  callByProvider: Partial<Record<VerificationProvider, (ticketId: string) => Promise<TechhubAsyncStatusResult>>>;
}): Promise<AsyncStatusResult> {
  const transaction = await prisma.transaction.findFirst({
    where: { userId: params.userId, providerRef: params.ticketId }
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
      response: transaction.status === TransactionStatus.FAILED ? { message: publicVerificationMessage((pii?.response as Record<string, unknown> | null)?.message, 'Your request could not be completed. Please check the details and try again.') } : pii?.response ?? null
    };
  }

  const provider = (transaction.provider ?? 'techhub') as VerificationProvider;
  if (provider === 'manual') {
    return { ticketId: params.ticketId, status: 'pending', response: null };
  }
  const call = params.callByProvider[provider];
  if (!call) {
    throw new ApiError(500, 'This verification service is temporarily unavailable. Please try again later.', 'PROVIDER_NOT_IMPLEMENTED');
  }

  const metadata = (transaction.metadata as Record<string, unknown> | null) ?? {};
  const service = typeof metadata.service === 'string' ? metadata.service : transaction.type.toLowerCase();
  const result = await timedVerificationCall(service, 'status', () => call(params.ticketId));
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
    // (the provider charges our balance on submit, same as Techhub's own
    // docs describe for theirs) - reuse it here rather than re-deriving the
    // price, since pricing could have changed between submit and this
    // eventual outcome.
    if (transaction.costKobo) {
      await recordProviderDebit({
        provider,
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
        pii: mergeSealedPII(existingMetadata.pii, { response: result.status === 'failed' ? { message: publicVerificationMessage(result.response?.message, 'Your request could not be completed. Please check the details and try again.') } : result.response, check_raw: result.raw })
      } as Prisma.InputJsonValue
    }
  });
  await refundWallet({ transactionId: transaction.id, userId: params.userId });
  return { ticketId: result.ticketId, status: 'failed', response: { message: publicVerificationMessage(result.response?.message, 'Your request could not be completed. Please check the details and try again.') } };
}

export function submitDelinking(params: { userId: string; nin: string; email: string; idempotencyKey?: string }) {
  return submitAsyncService({
    userId: params.userId,
    service: 'NIN_DELINKING',
    description: 'NIN delinking request',
    operational: {},
    pii: { nin: params.nin, email: params.email },
    idempotencyKey: params.idempotencyKey,
    callByProvider: { techhub: () => techhubService.submitDelinking(params.nin, params.email) }
  });
}
export function checkDelinkingStatus(params: { userId: string; ticketId: string }) {
  return checkAsyncServiceStatus({
    userId: params.userId,
    ticketId: params.ticketId,
    callByProvider: { techhub: (id) => techhubService.checkDelinking(id) }
  });
}

export function submitNinValidation(params: { userId: string; nin: string; validationType?: string; idempotencyKey?: string }) {
  const service = NIN_VALIDATION_SERVICE_BY_TYPE[params.validationType ?? 'nin_validation'] ?? 'NIN_VALIDATION_GENERAL';
  return submitAsyncService({
    userId: params.userId,
    service,
    description: `NIN validation request (${params.validationType ?? 'nin_validation'})`,
    operational: { validation_type: params.validationType ?? 'nin_validation' },
    pii: { nin: params.nin },
    idempotencyKey: params.idempotencyKey,
    callByProvider: {
      techhub: () => techhubService.submitNinValidation(params.nin, params.validationType),
      franceverified: () => submitNinValidationFV(params.nin, params.validationType)
    }
  });
}
export function checkNinValidationStatus(params: { userId: string; ticketId: string }) {
  return checkAsyncServiceStatus({
    userId: params.userId,
    ticketId: params.ticketId,
    callByProvider: {
      techhub: (id) => techhubService.checkNinValidation(id),
      franceverified: (id) => checkNinValidationFV(id)
    }
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
    callByProvider: { techhub: () => techhubService.submitPersonalization(params.trackingId) }
  });
}
export function checkPersonalizationStatus(params: { userId: string; ticketId: string }) {
  return checkAsyncServiceStatus({
    userId: params.userId,
    ticketId: params.ticketId,
    callByProvider: { techhub: (id) => techhubService.checkPersonalization(id) }
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
    callByProvider: {
      techhub: () =>
        techhubService.submitBvnRetrieval({
          first_name: params.firstName,
          last_name: params.lastName,
          phone_number: params.phoneNumber
        })
    }
  });
}
export function checkBvnRetrievalStatus(params: { userId: string; ticketId: string }) {
  return checkAsyncServiceStatus({
    userId: params.userId,
    ticketId: params.ticketId,
    callByProvider: { techhub: (id) => techhubService.checkBvnRetrieval(id) }
  });
}

export function submitIpeClearance(params: {
  userId: string;
  trackingId: string;
  ipeType: 'get_old_tracking_id' | 'inprocessing_error' | 'tracking_is_being_processed' | 'modification_ipe' | 'hit_blocked';
  idempotencyKey?: string;
}) {
  return submitAsyncService({
    userId: params.userId,
    service: 'IPE_CLEARANCE',
    description: `IPE clearance request (${params.ipeType.replace(/_/g, ' ')})`,
    operational: { ipe_type: params.ipeType },
    pii: { tracking_id: params.trackingId },
    idempotencyKey: params.idempotencyKey,
    callByProvider: {
      techhub: () => techhubService.submitIpeClearance(params.trackingId, params.ipeType),
      franceverified: () => submitIpeClearanceFV(params.trackingId, params.ipeType)
    }
  });
}
export function checkIpeClearanceStatus(params: { userId: string; ticketId: string }) {
  return checkAsyncServiceStatus({
    userId: params.userId,
    ticketId: params.ticketId,
    callByProvider: { techhub: (id) => techhubService.checkIpeClearance(id), franceverified: (id) => checkIpeClearanceFV(id) }
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
