import { Prisma } from '@prisma/client';
import { koboToNaira } from '../lib/money.js';
import { prisma } from '../lib/prisma.js';
import { ApiError } from '../middleware/error.js';

export const JAMB_SERVICE_DEFAULTS = {
  cbt_practice_software: { label: 'JAMB CBT Practice Software', price: 5000 },
  original_result: { label: 'JAMB Original Result', price: 2500 },
  admission_letter: { label: 'JAMB Admission Letter', price: 2000 },
  exam_slip: { label: 'JAMB Exam Slip', price: 500 },
  result_slip: { label: 'JAMB Result Slip', price: 800 },
} as const;

export type JambServiceId = keyof typeof JAMB_SERVICE_DEFAULTS;

export function jambServiceKey(id: JambServiceId) {
  return `JAMB_${id.toUpperCase()}`;
}

function priceToKobo(amount: number) {
  return BigInt(Math.round(amount * 100));
}

async function getOrCreateJambPrice(id: JambServiceId) {
  const defaults = JAMB_SERVICE_DEFAULTS[id];
  const service = jambServiceKey(id);
  const existing = await prisma.servicePricing.findUnique({ where: { service } });
  if (existing) return existing;
  try {
    return await prisma.servicePricing.create({
      data: { service, label: defaults.label, provider: 'manual', providerCostKobo: priceToKobo(defaults.price) },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return prisma.servicePricing.findUniqueOrThrow({ where: { service } });
    }
    throw error;
  }
}

export async function getJambServicePrice(id: JambServiceId, options: { forPartner?: boolean } = {}) {
  const row = await getOrCreateJambPrice(id);
  if (!row.isActive) throw new ApiError(422, `${row.label} is currently unavailable`, 'SERVICE_INACTIVE');
  const unitKobo = options.forPartner
    ? row.partnerSellingPriceKobo ?? row.sellingPriceKobo ?? row.providerCostKobo
    : row.sellingPriceKobo ?? row.providerCostKobo;
  return { service: row.service, label: row.label, unitPrice: koboToNaira(unitKobo), providerCostKobo: row.providerCostKobo };
}

export async function listJambServices() {
  return Promise.all((Object.keys(JAMB_SERVICE_DEFAULTS) as JambServiceId[]).map(async (id) => {
    const price = await getJambServicePrice(id);
    return { id, label: price.label, price: price.unitPrice };
  }));
}

export async function listJambPricesForAdmin() {
  const rows = await Promise.all((Object.keys(JAMB_SERVICE_DEFAULTS) as JambServiceId[]).map(getOrCreateJambPrice));
  return rows.map((row) => ({
    service: row.service,
    label: row.label,
    provider: row.provider,
    provider_cost: koboToNaira(row.providerCostKobo),
    selling_price: row.sellingPriceKobo ? koboToNaira(row.sellingPriceKobo) : null,
    partner_selling_price: row.partnerSellingPriceKobo ? koboToNaira(row.partnerSellingPriceKobo) : null,
    is_active: row.isActive,
  }));
}
