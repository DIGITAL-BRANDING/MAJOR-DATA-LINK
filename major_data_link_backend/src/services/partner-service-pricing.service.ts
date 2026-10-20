import { prisma } from '../lib/prisma.js';
import { koboToNaira, nairaToKobo } from '../lib/money.js';

/** Returns the configured account-specific rate, or the shared partner rate. */
export async function resolvePartnerServicePrice(partnerId: string, service: string, defaultPriceNaira: number) {
  const override = await prisma.partnerServicePrice.findUnique({
    where: { partnerId_service: { partnerId, service } },
    select: { priceKobo: true }
  });
  return override ? koboToNaira(override.priceKobo) : defaultPriceNaira;
}

export async function listPartnerServicePriceOverrides(partnerId: string) {
  const rows = await prisma.partnerServicePrice.findMany({ where: { partnerId } });
  return new Map(rows.map((row) => [row.service, koboToNaira(row.priceKobo)]));
}

export async function setPartnerServicePriceOverride(partnerId: string, service: string, priceNaira: number | null) {
  if (priceNaira === null) {
    return prisma.partnerServicePrice.deleteMany({ where: { partnerId, service } });
  }
  return prisma.partnerServicePrice.upsert({
    where: { partnerId_service: { partnerId, service } },
    create: { partnerId, service, priceKobo: nairaToKobo(priceNaira) },
    update: { priceKobo: nairaToKobo(priceNaira) }
  });
}
