import { koboToNaira } from '../lib/money.js';
import { listServicePricesForAdmin } from './result-pin.service.js';
import { listVerificationPricesForAdmin } from './verification.service.js';
import { listCacPricesForAdmin } from './cac.service.js';
import { listBvnModificationPricesForAdmin } from './bvn-modification.service.js';
import { listModificationPricesForAdmin } from './nin-modification.service.js';
import { listNewspaperPublicationPriceForAdmin } from './newspaper-publication.service.js';
import { listBirthAttestationPriceForAdmin } from './birth-attestation.service.js';
import { listBvnCrmPriceForAdmin } from './bvn-crm.service.js';
import { listBvnLicensePriceForAdmin } from './bvn-license-onboarding.service.js';
import { listJambPricesForAdmin } from './jamb-pricing.service.js';
import { listPartnerServicePriceOverrides } from './partner-service-pricing.service.js';

/** Partner-facing flat-rate catalog with account-specific prices applied. */
export async function listPartnerEnterprisePrices(partnerId: string) {
  const [pins, verification, cac, bvnMod, ninMod, newspaper, birth, bvnCrm, bvnLicense, jamb, overrides] = await Promise.all([
    listServicePricesForAdmin(), listVerificationPricesForAdmin(), listCacPricesForAdmin(), listBvnModificationPricesForAdmin(),
    listModificationPricesForAdmin(), listNewspaperPublicationPriceForAdmin(), listBirthAttestationPriceForAdmin(),
    listBvnCrmPriceForAdmin(), listBvnLicensePriceForAdmin(), listJambPricesForAdmin(), listPartnerServicePriceOverrides(partnerId)
  ]);
  const rows = [
    ...pins.map((row) => ({ ...row, provider: 'inventory' })),
    ...verification.filter((row) => row.service !== 'IPE_CLEARANCE'),
    ...cac, ...bvnMod, ...ninMod, ...newspaper, ...birth, ...bvnCrm, ...bvnLicense, ...jamb
  ];
  return rows.map((row) => ({
    service: row.service,
    label: row.label,
    unitPrice: overrides.get(row.service) ?? row.partner_selling_price ?? row.selling_price ?? row.provider_cost,
    isActive: row.is_active
  }));
}
