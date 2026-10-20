import { randomBytes } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';

const OFFER_CODE_PREFIX = 'KTECH-ENT';

/**
 * Generate a short code that is easy to read over email or on a phone. The
 * code is only a label for the partner's negotiated offer; authorization and
 * billing never trust a code supplied by a client.
 */
export function createEnterpriseOfferCode() {
  return `${OFFER_CODE_PREFIX}-${randomBytes(5).toString('hex').toUpperCase()}`;
}

/**
 * Give older partner accounts a code the first time they open the portal.
 * The conditional update makes this safe when two browser requests arrive at
 * the same time; a unique collision simply retries with a new random code.
 */
export async function ensurePartnerEnterpriseOfferCode(partnerId: string) {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const current = await prisma.partner.findUnique({ where: { id: partnerId }, select: { enterpriseOfferCode: true } });
    if (!current) return null;
    if (current.enterpriseOfferCode) return current.enterpriseOfferCode;

    try {
      await prisma.partner.updateMany({
        where: { id: partnerId, enterpriseOfferCode: null },
        data: { enterpriseOfferCode: createEnterpriseOfferCode() }
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') continue;
      throw error;
    }
  }

  throw new Error('Could not allocate a unique enterprise offer code');
}
