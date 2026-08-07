import { Prisma, TransactionStatus, TransactionType } from '@prisma/client';
import { env } from '../config/env.js';
import { koboToNaira } from '../lib/money.js';
import { prisma } from '../lib/prisma.js';
import { ApiError } from '../middleware/error.js';
import { providerService, type ProviderResultPinInput } from './provider.service.js';
import { debitWallet, refundWallet } from './wallet.service.js';

export type ExamPinType = 'WAEC' | 'NECO' | 'NABTEB';

const DEFAULTS: Record<ExamPinType, { service: string; label: string; price: number }> = {
  WAEC: { service: 'WAEC_PIN', label: 'WAEC Result Checker PIN', price: env.RESULT_PIN_WAEC_DEFAULT_PRICE_NAIRA },
  NECO: { service: 'NECO_PIN', label: 'NECO Result Checker Token', price: env.RESULT_PIN_NECO_DEFAULT_PRICE_NAIRA },
  NABTEB: { service: 'NABTEB_PIN', label: 'NABTEB Result Checker PIN', price: env.RESULT_PIN_NABTEB_DEFAULT_PRICE_NAIRA }
};

function priceToKobo(amount: number) {
  return BigInt(Math.round(amount * 100));
}

/**
 * Gets the ServicePricing row for an exam type, creating it with the
 * env-configured default price only if it has never existed before.
 *
 * This deliberately does NOT use prisma.servicePricing.upsert(): Prisma
 * throws a validation error ("Argument `update` must not be empty") if the
 * upsert's `update` object is empty, which it was here since we never want
 * to touch an existing row's price on a routine read. That bug meant the
 * VERY FIRST call for a given exam type (row doesn't exist -> CREATE path,
 * update object never evaluated) succeeded, but every call after that
 * (row exists -> UPDATE path -> throws on the empty update) failed with a
 * 500 - both for admins viewing/editing service pricing, and for real
 * users buying a WAEC/NECO/NABTEB pin, since purchaseResultPin() below
 * calls this same function via getResultPinPrice().
 *
 * A plain findUnique + conditional create has no such restriction and, as a
 * bonus, is more obviously correct: it can never silently reset an admin's
 * already-configured selling price back to nothing.
 */
async function getOrCreateServicePricingRow(examType: ExamPinType) {
  const defaults = DEFAULTS[examType];
  const existing = await prisma.servicePricing.findUnique({ where: { service: defaults.service } });
  if (existing) return existing;

  try {
    return await prisma.servicePricing.create({
      data: {
        service: defaults.service,
        label: defaults.label,
        providerCostKobo: priceToKobo(defaults.price)
      }
    });
  } catch (error) {
    // Two concurrent first-ever requests for the same exam type both see
    // "no row exists" and both attempt to create it - only one create can
    // win (unique constraint on `service`). Re-fetch and use whichever row
    // actually landed rather than surfacing a spurious error for this race.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return prisma.servicePricing.findUniqueOrThrow({ where: { service: defaults.service } });
    }
    throw error;
  }
}

export async function getResultPinPrice(examType: ExamPinType) {
  const row = await getOrCreateServicePricingRow(examType);
  const defaults = DEFAULTS[examType];

  if (!row.isActive) {
    throw new ApiError(422, `${defaults.label} is currently unavailable`, 'SERVICE_INACTIVE');
  }

  const unitKobo = row.sellingPriceKobo ?? row.providerCostKobo;
  return {
    service: row.service,
    label: row.label,
    unitPrice: koboToNaira(unitKobo),
    providerCost: koboToNaira(row.providerCostKobo),
    sellingPrice: row.sellingPriceKobo ? koboToNaira(row.sellingPriceKobo) : null,
    isActive: row.isActive
  };
}

export async function listResultPinPrices() {
  return Promise.all((Object.keys(DEFAULTS) as ExamPinType[]).map((exam) => getResultPinPrice(exam)));
}

/**
 * Admin-facing version of listResultPinPrices(). getResultPinPrice() above
 * deliberately throws SERVICE_INACTIVE when a service is disabled - correct
 * for the purchase flow (block buying something that's off), but wrong here:
 * Promise.all([...]) means ONE disabled service would throw the entire admin
 * list request, making it impossible to ever see (and re-enable) whatever
 * was just disabled. This reads the raw rows instead and never throws.
 */
export async function listServicePricesForAdmin() {
  const rows = await Promise.all(
    (Object.keys(DEFAULTS) as ExamPinType[]).map((exam) => getOrCreateServicePricingRow(exam))
  );

  return rows.map((row) => ({
    service: row.service,
    label: row.label,
    provider_cost: koboToNaira(row.providerCostKobo),
    selling_price: row.sellingPriceKobo ? koboToNaira(row.sellingPriceKobo) : null,
    is_active: row.isActive
  }));
}

export async function updateServicePrice(service: string, input: { sellingPrice?: number | null; providerCost?: number; isActive?: boolean }) {
  return prisma.servicePricing.update({
    where: { service },
    data: {
      ...(input.sellingPrice !== undefined ? { sellingPriceKobo: input.sellingPrice === null ? null : priceToKobo(input.sellingPrice) } : {}),
      ...(input.providerCost !== undefined ? { providerCostKobo: priceToKobo(input.providerCost) } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {})
    }
  });
}

export async function purchaseResultPin(params: {
  userId: string;
  examType: ExamPinType;
  quantity: number;
  idempotencyKey?: string;
}) {
  const price = await getResultPinPrice(params.examType);
  const amount = price.unitPrice * params.quantity;

  const debit = await debitWallet({
    userId: params.userId,
    amount,
    type: TransactionType.RESULT_PIN,
    description: `${params.examType} result checker PIN x${params.quantity}`,
    metadata: { exam_type: params.examType, quantity: params.quantity, unit_price: price.unitPrice } as Prisma.InputJsonValue,
    idempotencyKey: params.idempotencyKey
  });

  if (debit.reused && debit.transaction.status !== TransactionStatus.PENDING) {
    const metadata = debit.transaction.metadata as Record<string, unknown> | null;
    return {
      status: debit.transaction.status === TransactionStatus.SUCCESS ? ('success' as const) : false,
      message: 'Transaction already processed',
      reference: debit.reference,
      pin: metadata?.pin?.toString(),
      serial: metadata?.serial?.toString(),
      balanceAfter: koboToNaira(debit.transaction.balanceAfterKobo)
    };
  }

  const provider = await providerService.buyResultPin({
    examType: params.examType,
    quantity: params.quantity,
    reference: debit.reference
  } satisfies ProviderResultPinInput);

  if (provider.status) {
    await prisma.transaction.update({
      where: { id: debit.transaction.id },
      data: {
        status: TransactionStatus.SUCCESS,
        provider: 'alrahuz',
        providerRef: provider.providerRef ?? null,
        metadata: {
          exam_type: params.examType,
          quantity: params.quantity,
          unit_price: price.unitPrice,
          pin: provider.pin,
          pins: provider.pins,
          serial: provider.serial,
          raw: provider.raw
        } as Prisma.InputJsonValue
      }
    });

    return {
      status: 'success' as const,
      message: provider.message ?? 'PIN purchase successful',
      reference: debit.reference,
      pin: provider.pin,
      serial: provider.serial,
      balanceAfter: debit.balanceAfter
    };
  }

  await prisma.transaction.update({
    where: { id: debit.transaction.id },
    data: {
      status: TransactionStatus.FAILED,
      provider: 'alrahuz',
      providerRef: provider.providerRef ?? null
    }
  });
  const refunded = await refundWallet({ transactionId: debit.transaction.id, userId: params.userId });

  return {
    status: false as const,
    message: provider.message ?? 'PIN purchase failed and was refunded',
    reference: debit.reference,
    balanceAfter: koboToNaira(refunded.balanceAfterKobo)
  };
}
