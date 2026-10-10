import { Prisma, TransactionType } from '@prisma/client';
import { koboToNaira } from '../lib/money.js';
import { sealPII } from '../lib/pii.js';
import { prisma } from '../lib/prisma.js';
import { ApiError } from '../middleware/error.js';
import { debitWallet } from './wallet.service.js';

/**
 * TIN Certificate service. Nothing is sent to an external provider: the
 * customer is debited at submission and an admin files the TIN manually and
 * delivers the certificate to the customer's Deliveries. Prices are admin
 * configurable like every other manual service (ServicePricing rows).
 */
export const TIN_TYPES = ['company', 'individual'] as const;
export type TinType = (typeof TIN_TYPES)[number];

export const TIN_CONFIG: Record<TinType, { title: string; price: number }> = {
  company: { title: 'Company NRS/FIRS TIN', price: 1500 },
  individual: { title: 'Individual NRS/FIRS TIN', price: 1200 }
};

/** Same limit as the CAC status report: 4MB raw, base64 adds ~33%. */
export const TIN_DOCUMENT_MAX_BASE64_LENGTH = 5_500_000;

const serviceKeyFor = (type: TinType) => `TIN_${type.toUpperCase()}`;
const priceToKobo = (amount: number) => BigInt(Math.round(amount * 100));

/** findUnique first, create only when missing - never resets an admin's price. */
async function getOrCreatePricingRow(type: TinType) {
  const service = serviceKeyFor(type);
  const existing = await prisma.servicePricing.findUnique({ where: { service } });
  if (existing) return existing;
  try {
    return await prisma.servicePricing.create({
      data: {
        service,
        provider: 'manual',
        label: TIN_CONFIG[type].title,
        providerCostKobo: priceToKobo(TIN_CONFIG[type].price)
      }
    });
  } catch {
    const raced = await prisma.servicePricing.findUnique({ where: { service } });
    if (raced) return raced;
    throw new Error(`Could not create pricing row for ${service}`);
  }
}

export async function getTinPrice(type: TinType) {
  const row = await getOrCreatePricingRow(type);
  if (!row.isActive) {
    throw new ApiError(422, `${row.label} is currently unavailable`, 'SERVICE_INACTIVE');
  }
  const unitKobo = row.sellingPriceKobo ?? row.providerCostKobo;
  if (unitKobo <= 0n) {
    throw new ApiError(422, `${row.label} is not priced yet`, 'SERVICE_UNPRICED');
  }
  return { unitPrice: koboToNaira(unitKobo), providerCostKobo: row.providerCostKobo, label: row.label };
}

export async function listTinPrices() {
  const rows = await Promise.all(TIN_TYPES.map((type) => getOrCreatePricingRow(type)));
  return rows.map((row, index) => ({
    type: TIN_TYPES[index],
    title: TIN_CONFIG[TIN_TYPES[index]].title,
    unitPrice: koboToNaira(row.sellingPriceKobo ?? row.providerCostKobo),
    isActive: row.isActive
  }));
}

/** Shape matches the other manual services on the admin pricing pages. */
export async function listTinPricesForAdmin() {
  const rows = await Promise.all(TIN_TYPES.map((type) => getOrCreatePricingRow(type)));
  return rows.map((row) => ({
    service: row.service,
    label: row.label,
    provider: row.provider,
    provider_cost: koboToNaira(row.providerCostKobo),
    selling_price: row.sellingPriceKobo ? koboToNaira(row.sellingPriceKobo) : null,
    partner_selling_price: null,
    is_active: row.isActive
  }));
}

function createTinReference() {
  return `TIN-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

export type TinSubmission =
  | {
      type: 'company';
      businessType: string;
      businessRegNo: string;
      cacStatusReport?: { name: string; mimeType: string; base64: string };
    }
  | {
      type: 'individual';
      nin: string;
      firstName: string;
      lastName: string;
      middleName?: string;
      dateOfBirth: string;
    };

export async function submitTinRequest(params: {
  userId: string;
  submission: TinSubmission;
  idempotencyKey?: string;
}) {
  const { submission } = params;
  const price = await getTinPrice(submission.type);
  const trackingRef = createTinReference();

  // Everything the admin needs to file the TIN is sealed (encrypted) in the
  // transaction's PII, exactly like the other manual identity services.
  const details =
    submission.type === 'company'
      ? {
          business_type: submission.businessType,
          business_reg_no: submission.businessRegNo,
          cac_status_report: submission.cacStatusReport ?? null
        }
      : {
          nin: submission.nin,
          first_name: submission.firstName,
          last_name: submission.lastName,
          middle_name: submission.middleName ?? null,
          date_of_birth: submission.dateOfBirth
        };

  const debit = await debitWallet({
    userId: params.userId,
    amount: price.unitPrice,
    type: TransactionType.TIN_SERVICE_REQUEST,
    description: `TIN Certificate \u2014 ${TIN_CONFIG[submission.type].title}`,
    metadata: {
      service: serviceKeyFor(submission.type),
      tin_type: submission.type,
      unit_price: price.unitPrice,
      progress_notes: null,
      tracking_ref: trackingRef,
      pii: sealPII(details)
    } as Prisma.InputJsonValue,
    idempotencyKey: params.idempotencyKey,
    // No provider is called for TIN - the admin files it by hand, so the
    // configured provider cost is recorded for profit reporting only.
    costKobo: price.providerCostKobo
  });

  return { reference: debit.reference, balanceAfter: debit.balanceAfter };
}

export type TinHistoryEntry = {
  reference: string;
  status: string;
  tin_type: string | null;
  amount: number;
  progress_notes: string | null;
  created_at: string;
  updated_at: string;
};

/**
 * History never returns the sealed PII. The query also strips `pii` inside
 * Postgres, so a customer with several uploaded status reports does not pull
 * megabytes of base64 into the API process on every page load.
 */
export async function listTinHistory(userId: string, reference?: string): Promise<TinHistoryEntry[]> {
  const rows = await prisma.$queryRaw<
    Array<{
      reference: string;
      status: string;
      amountKobo: bigint;
      createdAt: Date;
      updatedAt: Date;
      metadata: Record<string, unknown> | null;
    }>
  >`
    SELECT "reference", "status", "amountKobo", "createdAt", "updatedAt", ("metadata" - 'pii') AS "metadata"
    FROM "Transaction"
    WHERE "userId" = ${userId} AND "type" = 'TIN_SERVICE_REQUEST'::"TransactionType"
      AND (${reference ?? null}::text IS NULL OR "reference" ILIKE ${`%${reference ?? ''}%`})
    ORDER BY "createdAt" DESC
    LIMIT 50
  `;

  return rows.map((row) => {
    const metadata = row.metadata ?? {};
    return {
      reference: row.reference,
      status: String(row.status).toLowerCase(),
      tin_type: typeof metadata.tin_type === 'string' ? metadata.tin_type : null,
      amount: koboToNaira(row.amountKobo),
      progress_notes: typeof metadata.progress_notes === 'string' ? metadata.progress_notes : null,
      created_at: row.createdAt.toISOString(),
      updated_at: row.updatedAt.toISOString()
    };
  });
}
