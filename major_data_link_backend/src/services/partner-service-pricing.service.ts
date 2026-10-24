import { prisma } from '../lib/prisma.js';
import { koboToNaira, nairaToKobo } from '../lib/money.js';
import { ApiError } from '../middleware/error.js';

/** Returns the configured account-specific rate, or the shared partner rate. */
export async function resolvePartnerServicePrice(partnerId: string, service: string, defaultPriceNaira: number) {
  const [access, override] = await Promise.all([
    prisma.partnerServiceAccess.findUnique({
      where: { partnerId_service: { partnerId, service } },
      select: { isEnabled: true }
    }),
    prisma.partnerServicePrice.findUnique({
      where: { partnerId_service: { partnerId, service } },
      select: { priceKobo: true }
    })
  ]);
  if (access?.isEnabled === false) {
    throw new ApiError(403, 'This service is not enabled for your partner account', 'PARTNER_SERVICE_DISABLED');
  }
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

export async function listPartnerServiceAccess(partnerId: string) {
  const rows = await prisma.partnerServiceAccess.findMany({ where: { partnerId }, select: { service: true, isEnabled: true } });
  return new Map(rows.map((row) => [row.service, row.isEnabled]));
}

export async function setPartnerServiceAccess(partnerId: string, service: string, isEnabled: boolean) {
  return prisma.partnerServiceAccess.upsert({
    where: { partnerId_service: { partnerId, service } },
    create: { partnerId, service, isEnabled },
    update: { isEnabled }
  });
}
