import { Prisma, TransactionType } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { sealPII } from '../lib/pii.js';
import { koboToNaira } from '../lib/money.js';
import { debitPartnerWallet } from './partner-wallet.service.js';
import {
  MODIFICATION_CONFIG,
  getModificationPrice,
  renderModificationPdf,
  type ModificationType
} from './nin-modification.service.js';
import {
  BVN_MODIFICATION_CONFIG,
  getBvnModificationPrice,
  renderBvnModificationPdf,
  type BvnModificationType
} from './bvn-modification.service.js';
import { getCacPrice, renderSubmissionPdf, CAC_CONFIG, type CacType, type CacApplicantDetails } from './cac.service.js';
import { getNewspaperPublicationPrice, renderNewspaperPublicationPdf } from './newspaper-publication.service.js';
import { getBirthAttestationPrice, renderBirthAttestationPdf } from './birth-attestation.service.js';
import { getBvnCrmPrice } from './bvn-crm.service.js';
import { JAMB_SERVICES } from '../routes/jamb.routes.js';

export type PartnerManualSubmitResult = { reference: string; balanceAfter: number };

/** Same NIN_MODIFICATION_<TYPE> / BVN_MODIFICATION_<TYPE> / CAC_<TYPE> convention as each retail service's own private serviceKeyFor() - duplicated here (a one-line string template, not worth exporting three near-identical private helpers just to reuse it). */
function ninModServiceKey(type: ModificationType) { return `NIN_MODIFICATION_${type.toUpperCase()}`; }
function bvnModServiceKey(type: BvnModificationType) { return `BVN_MODIFICATION_${type.toUpperCase()}`; }
function cacServiceKey(type: CacType) { return `CAC_${type.toUpperCase()}`; }
function createCacReference() { return `CAC-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`; }

/**
 * NIN Modification - same MODIFICATION_CONFIG/getModificationPrice/
 * renderModificationPdf the retail /nin-modification routes use. The
 * submission PDF is generated immediately (same as retail) since that PDF
 * *is* what an admin takes to techhubltd.co to actually process the change
 * - nothing further to "deliver back" once marked complete, so a partner's
 * completed request needs no attached file, just the status flip.
 */
export async function submitPartnerNinModification(params: {
  partnerId: string; type: ModificationType; values: Record<string, unknown>; idempotencyKey: string;
}): Promise<PartnerManualSubmitResult> {
  const config = MODIFICATION_CONFIG[params.type];
  const price = await getModificationPrice(params.type);
  const service = ninModServiceKey(params.type);

  const debit = await debitPartnerWallet({
    partnerId: params.partnerId, amount: price.unitPrice, type: TransactionType.NIN_MODIFICATION,
    description: `NIN Modification \u2014 ${config.title}`, idempotencyKey: params.idempotencyKey, costKobo: price.providerCostKobo,
    metadata: { service, modification_type: params.type, unit_price: price.unitPrice, pii: sealPII(params.values) } as Prisma.InputJsonValue
  });
  if (debit.reused) return { reference: debit.transaction.reference, balanceAfter: koboToNaira(debit.transaction.balanceAfterKobo) };

  const pdfBase64 = await renderModificationPdf({ reference: debit.transaction.reference, type: params.type, fields: config.fields, values: params.values, submittedAt: debit.transaction.createdAt });
  await prisma.partnerTransaction.update({
    where: { id: debit.transaction.id },
    data: { metadata: { service, modification_type: params.type, unit_price: price.unitPrice, pii: sealPII({ ...params.values, pdf_base64: pdfBase64 }) } as Prisma.InputJsonValue }
  });

  return { reference: debit.transaction.reference, balanceAfter: koboToNaira(debit.transaction.balanceAfterKobo) };
}

export async function submitPartnerBvnModification(params: {
  partnerId: string; type: BvnModificationType; values: Record<string, unknown>; idempotencyKey: string;
}): Promise<PartnerManualSubmitResult> {
  const config = BVN_MODIFICATION_CONFIG[params.type];
  const price = await getBvnModificationPrice(params.type);
  const service = bvnModServiceKey(params.type);

  const debit = await debitPartnerWallet({
    partnerId: params.partnerId, amount: price.unitPrice, type: TransactionType.BVN_MODIFICATION,
    description: `BVN Modification \u2014 ${config.title}`, idempotencyKey: params.idempotencyKey, costKobo: price.providerCostKobo,
    metadata: { service, modification_type: params.type, unit_price: price.unitPrice, pii: sealPII(params.values) } as Prisma.InputJsonValue
  });
  if (debit.reused) return { reference: debit.transaction.reference, balanceAfter: koboToNaira(debit.transaction.balanceAfterKobo) };

  const pdfBase64 = await renderBvnModificationPdf({ reference: debit.transaction.reference, type: params.type, fields: config.fields, values: params.values, submittedAt: debit.transaction.createdAt });
  await prisma.partnerTransaction.update({
    where: { id: debit.transaction.id },
    data: { metadata: { service, modification_type: params.type, unit_price: price.unitPrice, pii: sealPII({ ...params.values, pdf_base64: pdfBase64 }) } as Prisma.InputJsonValue }
  });

  return { reference: debit.transaction.reference, balanceAfter: koboToNaira(debit.transaction.balanceAfterKobo) };
}

export async function submitPartnerCac(params: {
  partnerId: string; type: CacType; proposedName1: string; proposedName2?: string; details: CacApplicantDetails; idempotencyKey: string;
}): Promise<PartnerManualSubmitResult> {
  const config = CAC_CONFIG[params.type];
  const price = await getCacPrice(params.type);
  const service = cacServiceKey(params.type);
  const trackingRef = createCacReference();

  const submissionPdfBase64 = await renderSubmissionPdf({ cacType: params.type, proposedName1: params.proposedName1, proposedName2: params.proposedName2, details: params.details, trackingRef });

  const debit = await debitPartnerWallet({
    partnerId: params.partnerId, amount: price.unitPrice, type: TransactionType.CAC_SERVICE_REQUEST,
    description: `CAC Services \u2014 ${config.title}`, idempotencyKey: params.idempotencyKey, costKobo: price.providerCostKobo,
    metadata: {
      service, cac_type: params.type, unit_price: price.unitPrice, progress_notes: null, tracking_ref: trackingRef,
      pii: sealPII({ proposed_name_1: params.proposedName1, proposed_name_2: params.proposedName2 ?? null, ...params.details, submission_pdf_base64: submissionPdfBase64 })
    } as Prisma.InputJsonValue
  });

  return { reference: debit.transaction.reference, balanceAfter: koboToNaira(debit.transaction.balanceAfterKobo) };
}

export async function submitPartnerNewspaperPublication(params: {
  partnerId: string; values: Record<string, unknown>; idempotencyKey: string;
}): Promise<PartnerManualSubmitResult> {
  const price = await getNewspaperPublicationPrice();
  const debit = await debitPartnerWallet({
    partnerId: params.partnerId, amount: price.unitPrice, type: TransactionType.NEWSPAPER_PUBLICATION,
    description: 'Newspaper Publication \u2014 Name Change', idempotencyKey: params.idempotencyKey, costKobo: price.providerCostKobo,
    metadata: { service: 'NEWSPAPER_PUBLICATION', unit_price: price.unitPrice, pii: sealPII(params.values) } as Prisma.InputJsonValue
  });
  if (debit.reused) return { reference: debit.transaction.reference, balanceAfter: koboToNaira(debit.transaction.balanceAfterKobo) };

  const pdfBase64 = await renderNewspaperPublicationPdf({ reference: debit.transaction.reference, values: params.values, submittedAt: debit.transaction.createdAt });
  await prisma.partnerTransaction.update({
    where: { id: debit.transaction.id },
    data: { metadata: { service: 'NEWSPAPER_PUBLICATION', unit_price: price.unitPrice, pii: sealPII({ ...params.values, pdf_base64: pdfBase64 }) } as Prisma.InputJsonValue }
  });
  return { reference: debit.transaction.reference, balanceAfter: koboToNaira(debit.transaction.balanceAfterKobo) };
}

export async function submitPartnerBirthAttestation(params: {
  partnerId: string; values: Record<string, unknown>; idempotencyKey: string;
}): Promise<PartnerManualSubmitResult> {
  const price = await getBirthAttestationPrice();
  const debit = await debitPartnerWallet({
    partnerId: params.partnerId, amount: price.unitPrice, type: TransactionType.BIRTH_ATTESTATION,
    description: 'Birth Attestation \u2014 NPC Birth Attestation & Instant approval', idempotencyKey: params.idempotencyKey, costKobo: price.providerCostKobo,
    metadata: { service: 'BIRTH_ATTESTATION', unit_price: price.unitPrice, pii: sealPII(params.values) } as Prisma.InputJsonValue
  });
  if (debit.reused) return { reference: debit.transaction.reference, balanceAfter: koboToNaira(debit.transaction.balanceAfterKobo) };

  const pdfBase64 = await renderBirthAttestationPdf({ reference: debit.transaction.reference, values: params.values, submittedAt: debit.transaction.createdAt });
  await prisma.partnerTransaction.update({
    where: { id: debit.transaction.id },
    data: { metadata: { service: 'BIRTH_ATTESTATION', unit_price: price.unitPrice, pii: sealPII({ ...params.values, pdf_base64: pdfBase64 }) } as Prisma.InputJsonValue }
  });
  return { reference: debit.transaction.reference, balanceAfter: koboToNaira(debit.transaction.balanceAfterKobo) };
}

export async function submitPartnerBvnCrm(params: {
  partnerId: string; values: Record<string, unknown>; idempotencyKey: string;
}): Promise<PartnerManualSubmitResult> {
  const price = await getBvnCrmPrice();
  const debit = await debitPartnerWallet({
    partnerId: params.partnerId, amount: price.unitPrice, type: TransactionType.BVN_CRM,
    description: 'BVN CRM \u2014 Ticket follow-up', idempotencyKey: params.idempotencyKey, costKobo: price.providerCostKobo,
    metadata: { service: 'BVN_CRM', unit_price: price.unitPrice, pii: sealPII(params.values) } as Prisma.InputJsonValue
  });
  return { reference: debit.transaction.reference, balanceAfter: koboToNaira(debit.transaction.balanceAfterKobo) };
}

export async function submitPartnerBvnLicense(params: {
  partnerId: string; values: Record<string, string | boolean>; idempotencyKey: string;
}): Promise<PartnerManualSubmitResult> {
  const trackingId = `MDL-BVN-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
  const debit = await debitPartnerWallet({
    partnerId: params.partnerId, amount: 10000, type: TransactionType.BVN_LICENSE_ONBOARDING,
    description: 'BVN License Onboarding', idempotencyKey: params.idempotencyKey,
    metadata: { service: 'BVN_LICENSE_ONBOARDING', tracking_id: trackingId, pii: sealPII(params.values) } as Prisma.InputJsonValue
  });
  return { reference: debit.transaction.reference, balanceAfter: koboToNaira(debit.transaction.balanceAfterKobo) };
}

/**
 * JAMB Services - reuses the exact JAMB_SERVICES price table from
 * routes/jamb.routes.ts (the retail JAMB routes) rather than a copy, so a
 * price change there is never out of sync with what partners are charged.
 * No PDF here (retail JAMB doesn't generate one either) - the admin's
 * "Fulfil JAMB request" page (admin/jamb.ts) uploads the actual JAMB
 * document once it exists.
 */
export async function submitPartnerJamb(params: {
  partnerId: string; service: keyof typeof JAMB_SERVICES; registrationNumber: string; candidateFullName: string; examYear: number; idempotencyKey: string;
}): Promise<PartnerManualSubmitResult> {
  const selected = JAMB_SERVICES[params.service];
  const debit = await debitPartnerWallet({
    partnerId: params.partnerId, amount: selected.price, type: TransactionType.JAMB_SERVICE_REQUEST,
    description: `${selected.label} request`, idempotencyKey: params.idempotencyKey,
    metadata: {
      service: 'JAMB_SERVICE_REQUEST', jamb_service: params.service, unit_price: selected.price,
      pii: sealPII({ registration_number: params.registrationNumber, candidate_full_name: params.candidateFullName, exam_year: params.examYear })
    } as Prisma.InputJsonValue
  });
  return { reference: debit.transaction.reference, balanceAfter: koboToNaira(debit.transaction.balanceAfterKobo) };
}
