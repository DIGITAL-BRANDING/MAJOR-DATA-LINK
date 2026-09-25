import PDFDocument from 'pdfkit';
import { Prisma, TransactionStatus, TransactionType } from '@prisma/client';
import { koboToNaira } from '../lib/money.js';
import { sealPII, openPII, mergeSealedPII } from '../lib/pii.js';
import { prisma } from '../lib/prisma.js';
import { ApiError } from '../middleware/error.js';
import { debitWallet } from './wallet.service.js';

/**
 * CAC Services — business name / company registration. Ported from
 * infoverify (DIGITAL-BRANDING/maria-digital-services).
 *
 * There is no provider API for this (confirmed - CAC registration is
 * admin-processed by hand, same as Birth Attestation/Newspaper
 * Publication/BVN CRM, NOT the FranceVerified CAC *search* endpoint in
 * services/franceverified/cac.service.ts, which is a different, unrelated
 * feature - a one-off "look up an existing RC number" lookup, not filing a
 * new registration). It follows the exact same manual pattern as NIN
 * Modification: the customer is debited at submission, the transaction sits
 * PENDING, and an admin does the actual CAC filing by hand. From the
 * "manage" page (see admin/cac.ts) an admin can:
 *   - Download the auto-generated submission PDF (every field the customer
 *     supplied, laid out as a proper form) - this is what they'd actually
 *     take to the CAC portal to register the business.
 *   - Download each customer-uploaded supporting document individually.
 *   - Save progress notes, visible to the customer on their history table.
 *   - Mark it complete and attach the FINAL certificate PDF that CAC
 *     issues once registration is done.
 *
 * "Company more than 1M, NGO, Clubs, Association, Etc." has no fixed price
 * ("quote on request") and isn't included in CAC_TYPES below - support
 * handles that one manually outside the app rather than through a
 * zero-price submission.
 */
export const CAC_TYPES = ['sole', 'partnership', 'llc'] as const;
export type CacType = (typeof CAC_TYPES)[number];

export const CAC_CONFIG: Record<CacType, { title: string; price: number }> = {
  sole: { title: 'Business Name \u2014 Sole Proprietorship', price: 28000 },
  partnership: { title: 'Business Name \u2014 Partnership', price: 32000 },
  llc: { title: 'Limited Liability \u2014 1M Share', price: 40000 }
};

/** The four document types CAC actually asks for at this stage of
 *  registration - matches the reference design's own upload slots exactly
 *  (not a freeform "attach anything" bag), so the submitted paperwork looks
 *  like a real CAC intake rather than an ad-hoc attachment list. */
export const CAC_DOCUMENT_LABELS = ['Valid ID document(s)', 'Passport photograph(s)', 'Proof of address', 'Signature specimen(s)'] as const;
export type CacDocumentLabel = (typeof CAC_DOCUMENT_LABELS)[number];

export type CacSupportingDocument = { label: CacDocumentLabel; name: string; mime_type: string; base64: string };

/**
 * The applicant/proprietor details actually needed to file with CAC - a
 * business name/company alone isn't enough to register anything.
 */
export type CacApplicantDetails = {
  business_nature: string;
  business_address: string;
  proprietor_full_name: string;
  proprietor_phone: string;
  proprietor_email: string;
  proprietor_residential_address: string;
  proprietor_date_of_birth: string;
  proprietor_gender: 'Male' | 'Female';
  proprietor_nin: string;
  supporting_documents?: CacSupportingDocument[];
};

function serviceKeyFor(type: CacType) {
  return `CAC_${type.toUpperCase()}`;
}

function priceToKobo(amount: number) {
  return BigInt(Math.round(amount * 100));
}

/** Same plain-findUnique-then-conditional-create shape used throughout -
 *  never resets an admin's already-configured price back to the default. */
async function getOrCreatePricingRow(type: CacType) {
  const config = CAC_CONFIG[type];
  const service = serviceKeyFor(type);
  const existing = await prisma.servicePricing.findUnique({ where: { service } });
  if (existing) return existing;

  try {
    return await prisma.servicePricing.create({
      data: {
        service,
        provider: 'manual',
        label: config.title,
        providerCostKobo: priceToKobo(config.price)
      }
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return prisma.servicePricing.findUniqueOrThrow({ where: { service } });
    }
    throw error;
  }
}

export async function getCacPrice(type: CacType) {
  const row = await getOrCreatePricingRow(type);
  if (!row.isActive) {
    throw new ApiError(422, `${row.label} is currently unavailable`, 'SERVICE_INACTIVE');
  }
  const unitKobo = row.sellingPriceKobo ?? row.providerCostKobo;
  return { unitPrice: koboToNaira(unitKobo), providerCostKobo: row.providerCostKobo };
}

/** Public price list - never throws on a disabled service. */
export async function listCacPrices() {
  const rows = await Promise.all(CAC_TYPES.map((type) => getOrCreatePricingRow(type)));
  return rows.map((row, index) => ({
    type: CAC_TYPES[index],
    title: CAC_CONFIG[CAC_TYPES[index]].title,
    unitPrice: koboToNaira(row.sellingPriceKobo ?? row.providerCostKobo),
    isActive: row.isActive
  }));
}

/** Shape matching listVerificationPricesForAdmin() - for the shared /admin/service-status page. */
export async function listCacPricesForAdmin() {
  const rows = await Promise.all(CAC_TYPES.map((type) => getOrCreatePricingRow(type)));
  return rows.map((row) => ({ service: row.service, label: row.label, provider: row.provider, is_active: row.isActive }));
}

function createCacReference() {
  return `CAC-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

/** Renders every submitted field into a proper form-style PDF the admin can
 *  print or upload straight into the CAC portal - bordered field-box grid,
 *  not a loose stack of text lines. */
export async function renderSubmissionPdf(params: {
  cacType: CacType;
  proposedName1: string;
  proposedName2?: string | null;
  details: CacApplicantDetails;
  trackingRef: string;
}) {
  const doc = new PDFDocument({ size: 'A4', margin: 40 });
  const chunks: Buffer[] = [];
  doc.on('data', (c: Buffer) => chunks.push(c));
  const done = new Promise<string>((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(chunks).toString('base64')));
    doc.on('error', reject);
  });

  const PAGE_LEFT = 40;
  const PAGE_WIDTH = 515;
  const GOLD_DARK = '#6b4f0b';
  const GOLD = '#c9971f';
  const INK = '#1f2937';
  const MUTED = '#6b7280';
  const BORDER = '#d1d5db';

  doc.rect(0, 0, doc.page.width, 86).fill('#171106');
  doc.fillColor('#ffe9a3').fontSize(16).font('Helvetica-Bold').text('CAC BUSINESS REGISTRATION', PAGE_LEFT, 24, { width: PAGE_WIDTH });
  doc.fontSize(10).font('Helvetica').fillColor('#d8c58b').text('Submission Form \u2014 for manual filing on the CAC portal', PAGE_LEFT, 46);
  doc.rect(0, 82, doc.page.width, 4).fill(GOLD);
  doc.y = 106;

  doc.fontSize(9).font('Helvetica-Bold').fillColor(MUTED).text('REFERENCE', PAGE_LEFT, doc.y);
  doc.fontSize(11).font('Helvetica-Bold').fillColor(INK).text(params.trackingRef, PAGE_LEFT, doc.y + 2);
  const metaRightX = PAGE_LEFT + 300;
  const metaTop = 106;
  doc.fontSize(9).font('Helvetica-Bold').fillColor(MUTED).text('SUBMITTED', metaRightX, metaTop);
  doc.fontSize(10).font('Helvetica').fillColor(INK).text(new Date().toLocaleString('en-NG'), metaRightX, metaTop + 13);
  doc.fontSize(9).font('Helvetica-Bold').fillColor(MUTED).text('REGISTRATION TYPE', metaRightX, metaTop + 32);
  doc.fontSize(10).font('Helvetica').fillColor(INK).text(CAC_CONFIG[params.cacType].title, metaRightX, metaTop + 45, { width: 215 });
  doc.y = 168;

  function sectionHeader(title: string) {
    doc.moveDown(0.6);
    const y = doc.y;
    doc.rect(PAGE_LEFT, y, PAGE_WIDTH, 20).fill('#f3ede0');
    doc.rect(PAGE_LEFT, y, 4, 20).fill(GOLD);
    doc.fontSize(10.5).font('Helvetica-Bold').fillColor(GOLD_DARK).text(title.toUpperCase(), PAGE_LEFT + 12, y + 5);
    doc.y = y + 28;
  }

  function fieldGrid(fields: { label: string; value: string }[], columns: 1 | 2 = 2) {
    const gap = 10;
    const colWidth = columns === 2 ? (PAGE_WIDTH - gap) / 2 : PAGE_WIDTH;
    const rowHeight = 34;
    let x = PAGE_LEFT;
    let col = 0;
    let rowStartY = doc.y;

    for (const field of fields) {
      if (rowStartY + rowHeight > doc.page.height - 60) {
        doc.addPage();
        rowStartY = 40;
        col = 0;
        x = PAGE_LEFT;
      }

      doc.rect(x, rowStartY, colWidth, rowHeight).strokeColor(BORDER).lineWidth(0.75).stroke();
      doc.fontSize(8).font('Helvetica-Bold').fillColor(MUTED).text(field.label.toUpperCase(), x + 8, rowStartY + 6, { width: colWidth - 16 });
      doc.fontSize(10.5).font('Helvetica').fillColor(INK).text(field.value || '\u2014', x + 8, rowStartY + 18, { width: colWidth - 16 });

      if (columns === 2 && col === 0) {
        col = 1;
        x = PAGE_LEFT + colWidth + gap;
      } else {
        col = 0;
        x = PAGE_LEFT;
        rowStartY += rowHeight;
      }
    }
    doc.y = col === 0 ? rowStartY + 4 : rowStartY + rowHeight + 4;
  }

  sectionHeader('Proposed Business Name(s)');
  fieldGrid(
    [
      { label: 'Option 1', value: params.proposedName1 },
      { label: 'Option 2', value: params.proposedName2 ?? '' }
    ],
    2
  );

  sectionHeader('Business Details');
  fieldGrid(
    [
      { label: 'Nature of business', value: params.details.business_nature },
      { label: 'Business address', value: params.details.business_address }
    ],
    1
  );

  sectionHeader('Proprietor / Applicant Details');
  fieldGrid(
    [
      { label: 'Full name', value: params.details.proprietor_full_name },
      { label: 'Phone', value: params.details.proprietor_phone },
      { label: 'Email', value: params.details.proprietor_email },
      { label: 'Date of birth', value: params.details.proprietor_date_of_birth },
      { label: 'Gender', value: params.details.proprietor_gender },
      { label: 'NIN', value: params.details.proprietor_nin },
      { label: 'Residential address', value: params.details.proprietor_residential_address }
    ],
    2
  );

  if (params.details.supporting_documents?.length) {
    sectionHeader('Supporting Documents Attached');
    fieldGrid(
      params.details.supporting_documents.map((document) => ({ label: document.label, value: document.name })),
      2
    );
  }

  doc.moveDown(1.5);
  doc.moveTo(PAGE_LEFT, doc.y).lineTo(PAGE_LEFT + PAGE_WIDTH, doc.y).strokeColor(BORDER).lineWidth(0.75).stroke();
  doc.moveDown(0.5);
  doc
    .fontSize(8)
    .font('Helvetica-Oblique')
    .fillColor(MUTED)
    .text('Generated automatically at submission time for manual CAC filing. Not a CAC certificate.', PAGE_LEFT, doc.y, { width: PAGE_WIDTH });

  doc.end();
  return done;
}

export type SubmitCacResult = { reference: string; balanceAfter: number };

export async function submitCacRequest(params: {
  userId: string;
  type: CacType;
  proposedName1: string;
  proposedName2?: string;
  details: CacApplicantDetails;
  idempotencyKey?: string;
}): Promise<SubmitCacResult> {
  const config = CAC_CONFIG[params.type];
  const price = await getCacPrice(params.type);
  const service = serviceKeyFor(params.type);
  const trackingRef = createCacReference();

  const submissionPdfBase64 = await renderSubmissionPdf({
    cacType: params.type,
    proposedName1: params.proposedName1,
    proposedName2: params.proposedName2,
    details: params.details,
    trackingRef
  });

  const debit = await debitWallet({
    userId: params.userId,
    amount: price.unitPrice,
    type: TransactionType.CAC_SERVICE_REQUEST,
    description: `CAC Services \u2014 ${config.title}`,
    metadata: {
      service,
      cac_type: params.type,
      unit_price: price.unitPrice,
      progress_notes: null,
      tracking_ref: trackingRef,
      pii: sealPII({
        proposed_name_1: params.proposedName1,
        proposed_name_2: params.proposedName2 ?? null,
        ...params.details,
        submission_pdf_base64: submissionPdfBase64
      })
    } as Prisma.InputJsonValue,
    idempotencyKey: params.idempotencyKey,
    // No provider was actually paid yet - an admin pays CAC's fee when they manually file this.
    costKobo: price.providerCostKobo
  });

  return { reference: debit.reference, balanceAfter: debit.balanceAfter };
}

export type CacHistoryEntry = {
  reference: string;
  status: string;
  cac_type: string | null;
  proposed_name_1: string | null;
  proposed_name_2: string | null;
  amount: number;
  progress_notes: string | null;
  submission_pdf_base64: string | null;
  certificate_pdf_base64: string | null;
  created_at: string;
  updated_at: string;
};

type CacPII = Partial<CacApplicantDetails> & {
  proposed_name_1?: string;
  proposed_name_2?: string | null;
  submission_pdf_base64?: string;
  certificate_pdf_base64?: string;
};

/** Every status is included here (not just SUCCESS, unlike e.g. NIN
 *  Modification's history) - CAC registration can take days, and the whole
 *  point of this table is for the customer to track a request while it's
 *  still PENDING. */
export async function listCacHistory(userId: string) {
  const transactions = await prisma.transaction.findMany({
    where: { userId, type: TransactionType.CAC_SERVICE_REQUEST },
    orderBy: { createdAt: 'desc' },
    take: 50
  });

  return transactions.map((transaction): CacHistoryEntry => {
    const metadata = transaction.metadata as Record<string, unknown> | null;
    const pii = openPII<CacPII>(metadata?.pii);
    return {
      reference: transaction.reference,
      status: transaction.status.toLowerCase(),
      cac_type: typeof metadata?.cac_type === 'string' ? metadata.cac_type : null,
      proposed_name_1: pii?.proposed_name_1 ?? null,
      proposed_name_2: pii?.proposed_name_2 ?? null,
      amount: koboToNaira(transaction.amountKobo),
      progress_notes: typeof metadata?.progress_notes === 'string' ? metadata.progress_notes : null,
      submission_pdf_base64: typeof pii?.submission_pdf_base64 === 'string' ? pii.submission_pdf_base64 : null,
      certificate_pdf_base64: typeof pii?.certificate_pdf_base64 === 'string' ? pii.certificate_pdf_base64 : null,
      created_at: transaction.createdAt.toISOString(),
      updated_at: transaction.updatedAt.toISOString()
    };
  });
}

/** Admin-only: update the customer-visible progress note without changing status. */
export async function updateCacProgressNotes(params: { transactionId: string; notes: string }) {
  const transaction = await prisma.transaction.findUnique({ where: { id: params.transactionId } });
  if (!transaction || transaction.type !== TransactionType.CAC_SERVICE_REQUEST) {
    throw new ApiError(404, 'CAC transaction not found', 'TRANSACTION_NOT_FOUND');
  }
  const metadata = (transaction.metadata as Record<string, unknown> | null) ?? {};
  await prisma.transaction.update({
    where: { id: transaction.id },
    data: { metadata: { ...metadata, progress_notes: params.notes } as Prisma.InputJsonValue }
  });
}

/** Admin-only: attaches the completed certificate and marks the request
 *  SUCCESS. There is no automatic path here - an admin has actually
 *  finished the CAC filing by hand. */
export async function completeCacRequest(params: { transactionId: string; certificatePdfBase64: string }) {
  const transaction = await prisma.transaction.findUnique({ where: { id: params.transactionId } });
  if (!transaction || transaction.type !== TransactionType.CAC_SERVICE_REQUEST) {
    throw new ApiError(404, 'CAC transaction not found', 'TRANSACTION_NOT_FOUND');
  }
  if (transaction.status !== TransactionStatus.PENDING) {
    throw new ApiError(422, 'Only a pending CAC request can be marked complete', 'INVALID_STATUS');
  }

  const metadata = (transaction.metadata as Record<string, unknown> | null) ?? {};
  await prisma.transaction.update({
    where: { id: transaction.id },
    data: {
      status: TransactionStatus.SUCCESS,
      metadata: {
        ...metadata,
        pii: mergeSealedPII(metadata.pii, { certificate_pdf_base64: params.certificatePdfBase64 })
      } as Prisma.InputJsonValue
    }
  });
}

/** Decrypts the sealed PII (applicant details, supporting documents,
 *  submission PDF, certificate) for the admin's manage page. Never call
 *  this from a user-facing endpoint. */
export function decryptCacPII(transaction: { metadata: unknown }) {
  const metadata = transaction.metadata as Record<string, unknown> | null;
  return openPII<CacPII>(metadata?.pii);
}
