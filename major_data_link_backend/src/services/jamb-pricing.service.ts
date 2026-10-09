import { Prisma } from '@prisma/client';
import { koboToNaira } from '../lib/money.js';
import { prisma } from '../lib/prisma.js';
import { ApiError } from '../middleware/error.js';

// `unpriced: true` means the price was not confirmed when the service was
// added. Such a service is created INACTIVE: it is hidden from customers and
// partners until an admin sets its price on the Bulk Pricing page and turns
// it on. This avoids charging a guessed amount.
export const JAMB_SERVICE_DEFAULTS = {
  cbt_practice_software: { label: 'JAMB CBT Practice Software', price: 5000 },
  original_result: { label: 'JAMB Original Result', price: 2500 },
  admission_letter: { label: 'JAMB Admission Letter', price: 2000 },
  exam_slip: { label: 'JAMB Exam Slip', price: 500 },
  result_slip: { label: 'JAMB Result Slip', price: 800 },
  // Re-prints / other services - N500 each (JAMB "RE-Prints / Other JAMB Services" card)
  admission_status: { label: 'JAMB Admission Status', price: 500 },
  reprint_registration_slip: { label: 'JAMB Reprint Registration Slip', price: 500 },
  reprint_change_of_course_slip: { label: 'JAMB Reprint Change of Course Slip', price: 500 },
  reprint_original_result_slip: { label: 'JAMB Reprint Original Result Slip', price: 500 },
  caps_score_screenshot: { label: 'JAMB Caps Score Screenshot', price: 500 },
  // Price not shown in the source price list - admin must confirm before these go live.
  retrieve_jamb_email: { label: 'Retrieve 2026 JAMB Email', price: 0, unpriced: true },
  check_olevel_upload: { label: "Check O'Level Upload", price: 0, unpriced: true },
  reprint_indemnity_form: { label: 'JAMB Reprint Indemnity Form', price: 0, unpriced: true },
  check_transfer_approval: { label: 'Check JAMB Transfer Approval', price: 0, unpriced: true },
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
      data: {
        service,
        label: defaults.label,
        provider: 'manual',
        providerCostKobo: priceToKobo(defaults.price),
        isActive: !('unpriced' in defaults && defaults.unpriced),
      },
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

// Only services that are currently active are offered to customers - so a
// newly added, not-yet-priced service never appears with a wrong price.
export async function listJambServices() {
  const rows = await Promise.all((Object.keys(JAMB_SERVICE_DEFAULTS) as JambServiceId[]).map(async (id) => ({ id, row: await getOrCreateJambPrice(id) })));
  return rows
    .filter(({ row }) => row.isActive)
    .map(({ id, row }) => ({ id, label: row.label, price: koboToNaira(row.sellingPriceKobo ?? row.providerCostKobo) }));
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
