import { Prisma, TransactionStatus, TransactionType } from '@prisma/client';
import { env } from '../config/env.js';
import { koboToNaira } from '../lib/money.js';
import { decryptPII } from '../lib/pii-encryption.js';
import { encryptPII } from '../lib/pii-encryption.js';
import { openPII, sealPII } from '../lib/pii.js';
import { prisma } from '../lib/prisma.js';
import { ApiError } from '../middleware/error.js';
import { debitWallet, refundWallet } from './wallet.service.js';

export type ExamPinType = 'WAEC' | 'NECO' | 'NABTEB';
const DEFAULTS: Record<ExamPinType, { service: string; label: string; price: number }> = {
  WAEC: { service: 'WAEC_PIN', label: 'WAEC Result Checker PIN', price: env.RESULT_PIN_WAEC_DEFAULT_PRICE_NAIRA },
  NECO: { service: 'NECO_PIN', label: 'NECO Result Checker Token', price: env.RESULT_PIN_NECO_DEFAULT_PRICE_NAIRA },
  NABTEB: { service: 'NABTEB_PIN', label: 'NABTEB Result Checker PIN', price: env.RESULT_PIN_NABTEB_DEFAULT_PRICE_NAIRA }
};
function priceToKobo(amount: number) { return BigInt(Math.round(amount * 100)); }

async function getOrCreateServicePricingRow(examType: ExamPinType) {
  const defaults = DEFAULTS[examType];
  const existing = await prisma.servicePricing.findUnique({ where: { service: defaults.service } });
  if (existing) return existing;
  try { return await prisma.servicePricing.create({ data: { service: defaults.service, label: defaults.label, provider: 'inventory', providerCostKobo: priceToKobo(defaults.price) } }); }
  catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') return prisma.servicePricing.findUniqueOrThrow({ where: { service: defaults.service } });
    throw error;
  }
}

export async function getResultPinPrice(examType: ExamPinType) {
  const row = await getOrCreateServicePricingRow(examType);
  if (!row.isActive) throw new ApiError(422, `${DEFAULTS[examType].label} is currently unavailable`, 'SERVICE_INACTIVE');
  const unitKobo = row.sellingPriceKobo ?? row.providerCostKobo;
  return { service: row.service, label: row.label, unitPrice: koboToNaira(unitKobo), providerCost: koboToNaira(row.providerCostKobo), sellingPrice: row.sellingPriceKobo ? koboToNaira(row.sellingPriceKobo) : null, isActive: row.isActive };
}
export async function listResultPinPrices() { return Promise.all((Object.keys(DEFAULTS) as ExamPinType[]).map(getResultPinPrice)); }
export async function listServicePricesForAdmin() {
  const rows = await Promise.all((Object.keys(DEFAULTS) as ExamPinType[]).map(getOrCreateServicePricingRow));
  return rows.map((row) => ({ service: row.service, label: row.label, provider_cost: koboToNaira(row.providerCostKobo), selling_price: row.sellingPriceKobo ? koboToNaira(row.sellingPriceKobo) : null, partner_selling_price: row.partnerSellingPriceKobo ? koboToNaira(row.partnerSellingPriceKobo) : null, is_active: row.isActive }));
}
export async function updateServicePrice(service: string, input: { sellingPrice?: number | null; partnerSellingPrice?: number | null; providerCost?: number; isActive?: boolean; provider?: string }) {
  // Result PINs are always delivered from stock. Keep the provider label
  // pinned to inventory even if a generic admin pricing form submits a stale
  // Alrahuz/Bilal value from an older browser tab.
  const isResultPin = Object.values(DEFAULTS).some((item) => item.service === service);
  return prisma.servicePricing.update({ where: { service }, data: {
    ...(input.sellingPrice !== undefined && { sellingPriceKobo: input.sellingPrice === null ? null : priceToKobo(input.sellingPrice) }),
    ...(input.partnerSellingPrice !== undefined && { partnerSellingPriceKobo: input.partnerSellingPrice === null ? null : priceToKobo(input.partnerSellingPrice) }),
    ...(input.providerCost !== undefined && { providerCostKobo: priceToKobo(input.providerCost) }),
    ...(input.isActive !== undefined && { isActive: input.isActive }), ...(isResultPin ? { provider: 'inventory' } : input.provider !== undefined ? { provider: input.provider } : {})
  } });
}
export async function applyServiceMarkup(params: { provider: 'techhub' | 'inventory'; markupNaira: number; markupPercent: number }) {
  const rows = await prisma.servicePricing.findMany({ where: { provider: params.provider } }); let updated = 0; let skipped = 0;
  for (const row of rows) { const cost = koboToNaira(row.providerCostKobo); const price = Math.ceil(cost + cost * params.markupPercent / 100 + params.markupNaira); if (price <= 0) { skipped++; continue; } await prisma.servicePricing.update({ where: { id: row.id }, data: { sellingPriceKobo: priceToKobo(price) } }); updated++; }
  return { updated, skipped };
}
type Delivered = { pins: string[]; serials: string[] };
function delivered(metadata: unknown): Delivered { const pii = openPII<Delivered>((metadata as Record<string, unknown> | null)?.pii); return { pins: pii?.pins ?? [], serials: pii?.serials ?? [] }; }

export async function addResultPinStock(params: { examType: ExamPinType; entries: { pin: string; serial?: string }[]; purchaseCostNaira: number; sourceReference?: string; adminId: string }) {
  if (!params.entries.length) throw new ApiError(422, 'Add at least one PIN', 'INVALID_STOCK');
  await prisma.resultPinInventory.createMany({ data: params.entries.map((entry) => ({
    examType: params.examType, pinEncrypted: encryptPII(entry.pin), serialEncrypted: entry.serial ? encryptPII(entry.serial) : null,
    purchaseCostKobo: priceToKobo(params.purchaseCostNaira), sourceReference: params.sourceReference || null, addedByAdminId: params.adminId
  })) });
  return { added: params.entries.length };
}

export async function getResultPinStockSummary() {
  const grouped = await prisma.resultPinInventory.groupBy({ by: ['examType', 'status'], _count: { _all: true }, _sum: { purchaseCostKobo: true } });
  return grouped.map((row) => ({ examType: row.examType, status: row.status, count: row._count._all, totalCost: koboToNaira(row._sum.purchaseCostKobo ?? 0n) }));
}

/** Locks and consumes stock in one database transaction, preventing duplicate PIN delivery. */
async function allocateStock(params: { examType: ExamPinType; quantity: number; userId: string; transactionId: string; unitPrice: number }) {
  return prisma.$transaction(async (tx) => {
    const ids = await tx.$queryRaw<{ id: string }[]>`SELECT "id" FROM "ResultPinInventory" WHERE "examType" = ${params.examType} AND "status" = 'AVAILABLE' ORDER BY "createdAt" ASC FOR UPDATE SKIP LOCKED LIMIT ${params.quantity}`;
    if (ids.length !== params.quantity) return null;
    const rows = await tx.resultPinInventory.findMany({ where: { id: { in: ids.map((r) => r.id) } } });
    const pins = rows.map((row) => decryptPII(row.pinEncrypted));
    const serials = rows.map((row) => row.serialEncrypted ? decryptPII(row.serialEncrypted) : '').filter(Boolean);
    const costKobo = rows.reduce((sum, row) => sum + row.purchaseCostKobo, 0n);
    await tx.resultPinInventory.updateMany({ where: { id: { in: ids.map((r) => r.id) }, status: 'AVAILABLE' }, data: { status: 'SOLD', soldToUserId: params.userId, transactionId: params.transactionId, soldAt: new Date() } });
    await tx.transaction.update({ where: { id: params.transactionId }, data: { status: TransactionStatus.SUCCESS, provider: 'inventory', costKobo, metadata: { exam_type: params.examType, quantity: params.quantity, unit_price: params.unitPrice, inventory_ids: ids.map((r) => r.id), pii: sealPII({ pins, serials }) } as Prisma.InputJsonValue } });
    return { pins, serials };
  });
}

export async function purchaseResultPin(params: { userId: string; examType: ExamPinType; quantity: number; idempotencyKey?: string }) {
  const price = await getResultPinPrice(params.examType);
  const available = await prisma.resultPinInventory.count({ where: { examType: params.examType, status: 'AVAILABLE' } });
  if (available < params.quantity) throw new ApiError(409, `Only ${available} ${params.examType} PIN(s) are currently in stock. Please try again later.`, 'RESULT_PIN_OUT_OF_STOCK');
  const debit = await debitWallet({ userId: params.userId, amount: price.unitPrice * params.quantity, type: TransactionType.RESULT_PIN, description: `${params.examType} result checker PIN x${params.quantity}`, metadata: { exam_type: params.examType, quantity: params.quantity, unit_price: price.unitPrice, provider: 'inventory' } as Prisma.InputJsonValue, idempotencyKey: params.idempotencyKey });
  if (debit.reused) {
    if (debit.transaction.status === TransactionStatus.PENDING) {
      // The first request owns fulfilment. A simultaneous retry must not
      // reserve a second set of cards for the same idempotency key.
      return { status: false as const, message: 'This PIN purchase is already being processed. Please retry shortly using the same request.', reference: debit.reference, pin: undefined, pins: [], serial: undefined, serials: [], balanceAfter: koboToNaira(debit.transaction.balanceAfterKobo) };
    }
    const secrets = delivered(debit.transaction.metadata);
    return { status: debit.transaction.status === TransactionStatus.SUCCESS ? ('success' as const) : false, message: 'Transaction already processed', reference: debit.reference, pin: secrets.pins[0], pins: secrets.pins, serial: secrets.serials[0], serials: secrets.serials, balanceAfter: koboToNaira(debit.transaction.balanceAfterKobo) };
  }
  try {
    const stock = await allocateStock({ examType: params.examType, quantity: params.quantity, userId: params.userId, transactionId: debit.transaction.id, unitPrice: price.unitPrice });
    if (!stock) throw new ApiError(409, 'The last available PIN was just sold. Your wallet will be refunded.', 'RESULT_PIN_OUT_OF_STOCK');
    return { status: 'success' as const, message: 'PIN purchase successful', reference: debit.reference, pin: stock.pins[0], pins: stock.pins, serial: stock.serials[0], serials: stock.serials, balanceAfter: debit.balanceAfter };
  } catch (error) {
    await prisma.transaction.update({ where: { id: debit.transaction.id }, data: { status: TransactionStatus.FAILED, provider: 'inventory' } });
    const refunded = await refundWallet({ transactionId: debit.transaction.id, userId: params.userId });
    if (error instanceof ApiError) throw error;
    throw new ApiError(500, 'PIN delivery failed and your wallet has been refunded. Please try again.', 'RESULT_PIN_DELIVERY_FAILED');
  }
}
