import { Prisma } from '@prisma/client';
import { prisma } from './prisma.js';
import { ApiError } from '../middleware/error.js';

/**
 * A handful of services (JAMB, Cable TV, Electricity, a whole-of-Data
 * master switch, and one row per airtime network) have no per-unit price
 * of their own - JAMB has a flat 5-item catalog, Cable/Electricity/Airtime
 * are pure Alrahuz/BilalSadaSub passthrough with no fixed cost. Rather than
 * invent a second on/off table, they get a ServicePricing row too, exactly
 * like every other service in this codebase (see cac.service.ts,
 * nin-modification.service.ts, etc.) - `providerCostKobo` is simply never
 * read for these, only `isActive` and `label` matter.
 *
 * This is the ONE place that pattern (find-or-create, then reject if
 * inactive) is written for toggle-only services, instead of copy-pasted at
 * each call site - see requireServiceActive() below.
 */
async function getOrCreateStatusRow(service: string, label: string) {
  const existing = await prisma.servicePricing.findUnique({ where: { service } });
  if (existing) return existing;

  try {
    return await prisma.servicePricing.create({
      data: { service, label, provider: 'internal', providerCostKobo: 0n }
    });
  } catch (error) {
    // Race: another request created the same row first (service is @unique).
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return prisma.servicePricing.findUniqueOrThrow({ where: { service } });
    }
    throw error;
  }
}

/**
 * Called at the top of a purchase/request handler, right after
 * requirePinConfirmation and before debitWallet - same position every
 * other service's isActive check sits at (see getCacPrice(),
 * getBvnCrmPrice(), etc.). Throws SERVICE_INACTIVE (422) if an admin has
 * turned this one off from /admin/service-status; does nothing otherwise.
 */
export async function requireServiceActive(service: string, label: string): Promise<void> {
  const row = await getOrCreateStatusRow(service, label);
  if (!row.isActive) {
    throw new ApiError(422, `${row.label} is currently unavailable`, 'SERVICE_INACTIVE');
  }
}

export type ToggleOnlyServiceSpec = { service: string; label: string };

/** For the admin Service Status page and the public /api/public/service-status endpoint. */
export async function listToggleOnlyServicesForAdmin(specs: ToggleOnlyServiceSpec[]) {
  const rows = await Promise.all(specs.map(({ service, label }) => getOrCreateStatusRow(service, label)));
  return rows.map((row) => ({ service: row.service, label: row.label, provider: 'internal', is_active: row.isActive }));
}

/**
 * Every toggle-only service key this app knows about, in one place, so
 * admin/service-status.ts and routes/public.routes.ts (which need the same
 * list for different purposes) can't drift apart. Networks come from
 * provider.service.ts's own NETWORK_IDS - if a network is ever added
 * there, add it here too.
 */
export const TOGGLE_ONLY_SERVICES: ToggleOnlyServiceSpec[] = [
  { service: 'DATA_BUNDLE_PURCHASE', label: 'Data Bundle Purchase (all networks)' },
  { service: 'AIRTIME_MTN', label: 'Airtime \u2014 MTN' },
  { service: 'AIRTIME_GLO', label: 'Airtime \u2014 Glo' },
  { service: 'AIRTIME_AIRTEL', label: 'Airtime \u2014 Airtel' },
  { service: 'AIRTIME_9MOBILE', label: 'Airtime \u2014 9mobile' },
  { service: 'CABLE_TV_SUBSCRIPTION', label: 'Cable TV Subscription' },
  { service: 'ELECTRICITY_BILL_PAYMENT', label: 'Electricity Bill Payment' },
  { service: 'JAMB_SERVICE_REQUEST', label: 'JAMB Services (CBT/Result/Admission/Exam Slip)' }
];

export type ServiceStatusRow = { service: string; label: string; provider: string; is_active: boolean; category: string };

/**
 * Every service this app knows how to turn on/off, from every category,
 * in one call - the single source of truth for both the admin
 * /admin/service-status page (which needs every row, active or not, to
 * render toggles) and the public /api/public/service-status endpoint
 * (which the customer apps poll to know which icons to grey out). Kept
 * here rather than duplicated in both callers so the two can never drift
 * out of sync with each other or with TOGGLE_ONLY_SERVICES above.
 *
 * Dynamic imports avoid a circular import: several of these service files
 * (verification.service.ts, cac.service.ts, etc.) import from lib/ files
 * that themselves may import this module in the future, and admin/*.ts
 * files already import from here too.
 */
export async function listAllServiceStatuses(): Promise<ServiceStatusRow[]> {
  const [
    { listServicePricesForAdmin },
    { listVerificationPricesForAdmin },
    { listCacPricesForAdmin },
    { listModificationPricesForAdmin },
    { listBvnModificationPricesForAdmin },
    { listBirthAttestationPriceForAdmin },
    { listNewspaperPublicationPriceForAdmin },
    { listBvnCrmPriceForAdmin }
  ] = await Promise.all([
    import('../services/result-pin.service.js'),
    import('../services/verification.service.js'),
    import('../services/cac.service.js'),
    import('../services/nin-modification.service.js'),
    import('../services/bvn-modification.service.js'),
    import('../services/birth-attestation.service.js'),
    import('../services/newspaper-publication.service.js'),
    import('../services/bvn-crm.service.js')
  ]);

  const [pins, verification, cac, ninMod, bvnMod, birthAttestation, newspaper, bvnCrm, toggleOnly] = await Promise.all([
    listServicePricesForAdmin(),
    listVerificationPricesForAdmin(),
    listCacPricesForAdmin(),
    listModificationPricesForAdmin(),
    listBvnModificationPricesForAdmin(),
    listBirthAttestationPriceForAdmin(),
    listNewspaperPublicationPriceForAdmin(),
    listBvnCrmPriceForAdmin(),
    listToggleOnlyServicesForAdmin(TOGGLE_ONLY_SERVICES)
  ]);

  return [
    ...toggleOnly.map((row) => ({ ...row, category: 'Data, Airtime, Cable & Electricity' })),
    ...pins.map((row) => ({ ...row, provider: 'alrahuz', category: 'Result Pins' })),
    ...verification.map((row) => ({ ...row, category: 'NIN / BVN Verification' })),
    ...ninMod.map((row) => ({ ...row, category: 'NIN Modification' })),
    ...bvnMod.map((row) => ({ ...row, category: 'BVN Modification' })),
    ...bvnCrm.map((row) => ({ ...row, category: 'BVN CRM' })),
    ...cac.map((row) => ({ ...row, category: 'CAC Registration' })),
    ...birthAttestation.map((row) => ({ ...row, category: 'Birth Attestation' })),
    ...newspaper.map((row) => ({ ...row, category: 'Newspaper Publication' }))
  ];
}
