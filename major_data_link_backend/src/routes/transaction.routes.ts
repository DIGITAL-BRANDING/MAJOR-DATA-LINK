import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { koboToNaira } from '../lib/money.js';
import { openPII } from '../lib/pii.js';
import { requireAuth } from '../middleware/auth.js';
import { assertSafeWebhookUrl } from '../services/partner-webhook.service.js';
import { ApiError } from '../middleware/error.js';

export const transactionRoutes = Router();

transactionRoutes.use(requireAuth);

type StoredServiceDocument =
  | { base64: string; label: string }
  | { url: string; label: string };

const MAX_REMOTE_DOCUMENT_BYTES = 20 * 1024 * 1024;

type IdentitySlipSummary = {
  holder_name?: string;
  identifier?: string;
  slip_type?: string;
  expires_at?: string;
};

function nonEmptyString(value: unknown) {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function firstString(record: Record<string, unknown> | null | undefined, keys: string[]) {
  for (const key of keys) {
    const value = nonEmptyString(record?.[key]);
    if (value) return value;
  }
  return undefined;
}

/**
 * The service-history endpoint is authenticated and owner-scoped, so it can
 * show the few fields a customer needs to recognise a slip (name, NIN/BVN,
 * type and expiry) without exposing the full encrypted provider response or
 * the PDF itself in the list payload.
 */
function identitySlipSummary(metadata: unknown, updatedAt: Date): IdentitySlipSummary {
  if (typeof metadata !== 'object' || metadata === null) return {};
  const record = metadata as Record<string, unknown>;
  const pii = openPII<Record<string, unknown>>(record.pii);
  const userData = pii?.user_data as Record<string, unknown> | undefined;
  const firstName = firstString(userData, ['first_name', 'firstname', 'firstName']) ?? firstString(pii, ['first_name', 'firstname', 'firstName']);
  const lastName = firstString(userData, ['last_name', 'lastname', 'lastName', 'surname']) ?? firstString(pii, ['last_name', 'lastname', 'lastName', 'surname']);
  const fullName = firstString(userData, ['full_name', 'fullname', 'fullName', 'name', 'customer_name'])
    ?? firstString(pii, ['full_name', 'fullname', 'fullName', 'name']);
  const tier = firstString(record, ['tier']);
  const service = firstString(record, ['service']);
  const providerExpiry = firstString(userData, ['expires_at', 'expiry_date', 'expiry', 'expiration_date', 'valid_until']);
  return {
    holder_name: fullName ?? ([firstName, lastName].filter(Boolean).join(' ') || undefined),
    identifier: firstString(userData, ['nin', 'nin_number', 'nin_no', 'bvn', 'bvn_number', 'bvn_no', 'tracking_id'])
      ?? firstString(pii, ['nin', 'nin_number', 'bvn', 'bvn_number', 'tracking_id']),
    slip_type: tier ? `${tier.toUpperCase()} SLIP` : service?.replace(/_/g, ' '),
    // Verification slips are reprintable for seven days. A provider-supplied
    // expiry wins if one is present; old records get the same seven-day rule.
    expires_at: providerExpiry ?? new Date(updatedAt.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString()
  };
}

/**
 * Service PDFs are deliberately kept in encrypted transaction PII instead of
 * being put in the history response.  This helper exposes only a yes/no flag
 * to the list page and lets the document route below stream the actual bytes
 * after the owner has authenticated again.
 */
function storedServiceDocument(metadata: unknown): StoredServiceDocument | null {
  if (typeof metadata !== 'object' || metadata === null) return null;
  const record = metadata as Record<string, unknown>;
  const pii = openPII<Record<string, unknown>>(record.pii);
  const userData = pii?.user_data as Record<string, unknown> | undefined;
  const base64Candidates: Array<{ value: unknown; label: string }> = [
    // A completed CAC certificate is the customer-facing document. Fall back
    // to its submission form while an admin is still processing it.
    { value: pii?.certificate_pdf_base64, label: 'certificate' },
    { value: pii?.submission_pdf_base64, label: 'submission form' },
    { value: pii?.pdf_base64, label: 'service slip' },
    { value: pii?.pdfBase64, label: 'service slip' },
    { value: userData?.pdf_base64, label: 'service slip' },
    { value: userData?.pdfBase64, label: 'service slip' },
    // A few older locally-generated records used this top-level field.
    { value: record.pdf_base64, label: 'service document' }
  ];

  const document = base64Candidates.find(({ value }) => typeof value === 'string' && value.trim().length > 0);
  return document && typeof document.value === 'string'
    ? { base64: document.value, label: document.label }
    : (() => {
        // Some trusted providers give a short-lived HTTPS PDF URL rather
        // than the PDF bytes. Keep that compatibility: it is fetched only
        // after this authenticated owner check and is never placed in a JSON
        // list/purchase response.
        const urlCandidates: Array<{ value: unknown; label: string }> = [
          { value: pii?.pdf_url, label: 'service slip' },
          { value: pii?.pdfUrl, label: 'service slip' },
          { value: userData?.pdf_url, label: 'service slip' },
          { value: userData?.pdfUrl, label: 'service slip' },
          { value: userData?.slip_url, label: 'service slip' }
        ];
        const remote = urlCandidates.find(({ value }) => typeof value === 'string' && value.trim().length > 0);
        return remote && typeof remote.value === 'string' ? { url: remote.value, label: remote.label } : null;
      })();
}

/**
 * A single legacy transaction must never make a customer's whole history
 * unavailable. `openPII` already returns null for unreadable old blobs, but
 * this boundary also protects the list endpoint from an unexpected record
 * shape while preserving the rest of the owner's history.
 */
function hasStoredServiceDocument(metadata: unknown): boolean {
  try {
    return Boolean(storedServiceDocument(metadata));
  } catch {
    return false;
  }
}

function safeIdentitySlipSummary(metadata: unknown, updatedAt: Date): IdentitySlipSummary {
  try {
    return identitySlipSummary(metadata, updatedAt);
  } catch {
    return {};
  }
}

function documentBuffer(base64: string): Buffer | null {
  const value = base64.replace(/^data:application\/pdf(?:;[^,]*)?,/i, '').trim();
  if (!value) return null;
  try {
    const buffer = Buffer.from(value, 'base64');
    // Do not let malformed/encrypted strings masquerade as a PDF download.
    return buffer.length > 4 && buffer.subarray(0, 4).toString() === '%PDF' ? buffer : null;
  } catch {
    return null;
  }
}

async function remoteDocumentBuffer(rawUrl: string): Promise<Buffer> {
  // Same public-HTTPS and private-address checks used for webhooks. This
  // prevents a provider-supplied URL from turning the PDF endpoint into an
  // internal-network fetcher.
  const endpoint = await assertSafeWebhookUrl(rawUrl);
  const upstream = await fetch(endpoint, { redirect: 'error', signal: AbortSignal.timeout(20_000) });
  if (!upstream.ok) throw new ApiError(502, 'The document provider could not supply this PDF. Please try again later.', 'DOCUMENT_PROVIDER_ERROR');
  const declaredSize = Number(upstream.headers.get('content-length'));
  if (Number.isFinite(declaredSize) && declaredSize > MAX_REMOTE_DOCUMENT_BYTES) {
    throw new ApiError(413, 'The provider document is too large to download.', 'DOCUMENT_TOO_LARGE');
  }
  const pdf = Buffer.from(await upstream.arrayBuffer());
  if (pdf.length > MAX_REMOTE_DOCUMENT_BYTES || pdf.length < 5 || pdf.subarray(0, 4).toString() !== '%PDF') {
    throw new ApiError(502, 'The document provider returned an invalid PDF.', 'INVALID_PROVIDER_DOCUMENT');
  }
  return pdf;
}

transactionRoutes.get('/', async (req, res) => {
  const transactions = await prisma.transaction.findMany({
    where: { userId: req.user!.id },
    orderBy: { createdAt: 'desc' },
    take: 50
  });

  res.json({
    status: true,
    data: transactions.map((tx) => ({
      id: tx.id,
      reference: tx.reference,
      type: tx.type.toLowerCase(),
      status: tx.status.toLowerCase(),
      amount: koboToNaira(tx.amountKobo),
      balance_after: koboToNaira(tx.balanceAfterKobo),
      description: tx.description,
      created_at: tx.createdAt.toISOString(),
      document_available: hasStoredServiceDocument(tx.metadata)
    }))
  });
});

// Streams the original service slip/form/certificate, not a transaction
// receipt.  The user must own the transaction; the PDF is never cached by a
// browser or intermediary because it can contain identity information.
transactionRoutes.get('/:id/service-document', async (req, res) => {
  const tx = await prisma.transaction.findFirstOrThrow({
    where: { id: req.params.id, userId: req.user!.id },
    select: { reference: true, metadata: true }
  });
  const document = storedServiceDocument(tx.metadata);
  const pdf = !document
    ? null
    : 'base64' in document
      ? documentBuffer(document.base64)
      : await remoteDocumentBuffer(document.url);
  if (!document || !pdf) {
    return res.status(404).json({ status: false, message: 'No downloadable service document is available for this request yet.' });
  }

  const download = req.query.download === '1';
  const safeReference = tx.reference.replace(/[^a-zA-Z0-9_-]/g, '_');
  res
    .set('Cache-Control', 'private, no-store, max-age=0')
    .set('X-Content-Type-Options', 'nosniff')
    .type('application/pdf')
    .setHeader('Content-Disposition', `${download ? 'attachment' : 'inline'}; filename="${safeReference}-${document.label.replace(/\s+/g, '-')}.pdf"`)
    .send(pdf);
});

// The generic activity feed above intentionally includes wallet movements.
// That is useful on the dashboard, but it made the Service History screen
// unreliable: after 50 newer funding/transfer rows, a customer's paid
// verification requests disappeared from that screen altogether.  Keep a
// separate, lean endpoint for actual services and never send the encrypted
// metadata/PDF blob in a list response (one old slip could otherwise make
// every page load several megabytes slower).
// Types whose metadata never carries a downloadable slip/certificate or an
// identity summary (plain VTU purchases). We skip loading and decrypting
// their metadata entirely - it's never needed to build their history row.
const TYPES_WITHOUT_DOCUMENTS = new Set(['DATA_PURCHASE', 'AIRTIME_PURCHASE', 'CABLE_PURCHASE', 'ELECTRICITY_PURCHASE', 'SMS']);
const METADATA_CHUNK_SIZE = 20;

transactionRoutes.get('/services', async (req, res) => {
  // Lean list query: NO `metadata` column. The old version selected whole
  // rows, so Postgres shipped (and Node parsed) the sealed PII blob of all
  // 250 rows - which for identity slips embeds the entire base64 PDF, i.e.
  // megabytes per row - before anything was decrypted. That is what made
  // this page take so long that the request timed out ("Unable to load
  // service history").
  const transactions = await prisma.transaction.findMany({
    where: {
      userId: req.user!.id,
      type: {
        notIn: [
          'WALLET_FUNDING',
          'WALLET_TRANSFER',
          'WITHDRAWAL',
          'REFERRAL_COMMISSION',
          'MANUAL_ADJUSTMENT',
          'COUPON_REDEMPTION',
          // Neither is itself a purchased service: REFUND is the credit-back
          // entry for some other (already-listed) transaction, and
          // WALLET_FUNDING_FEE is the per-deposit fee charged alongside a
          // WALLET_FUNDING credit (already excluded above). Both used to
          // slip through and show up as their own bogus "service" group.
          'REFUND',
          'WALLET_FUNDING_FEE'
        ]
      }
    },
    orderBy: { createdAt: 'desc' },
    take: 250,
    select: {
      id: true,
      reference: true,
      type: true,
      status: true,
      amountKobo: true,
      balanceAfterKobo: true,
      description: true,
      createdAt: true,
      updatedAt: true
    }
  });

  const ids = transactions.map((tx) => tx.id);

  // metadata.service / metadata.tier are the plaintext operational half of
  // metadata (never the sealed PII half - see sealPII/pii.ts), so Postgres
  // can extract just those two short strings without sending the blob.
  type PlainRow = { id: string; service: string | null; tier: string | null };
  // This is deliberately best-effort. A database/proxy incompatibility in
  // the JSON projection must never make the whole Service History page fail;
  // the ordinary transaction fields below are enough to render every row.
  let plainFields: PlainRow[] = [];
  if (ids.length) {
    try {
      plainFields = await prisma.$queryRaw<PlainRow[]>`
        SELECT "id", "metadata"->>'service' AS "service", "metadata"->>'tier' AS "tier"
        FROM "Transaction"
        WHERE "id" = ANY(${ids})`;
    } catch (error) {
      console.warn('[transactions] service history metadata projection failed; returning ungrouped records', {
        error: error instanceof Error ? error.name : 'unknown'
      });
    }
  }
  const plainById = new Map<string, PlainRow>(plainFields.map((row: PlainRow) => [row.id, row]));

  // Document availability + identity-slip summary genuinely need the sealed
  // PII, so load it - but only for rows that can have one, and a few at a
  // time, so peak memory is a handful of rows rather than 250 big blobs.
  const enrichmentById = new Map<string, { document_available: boolean; summary: IdentitySlipSummary }>();
  const needsMetadata = transactions.filter((tx) => !TYPES_WITHOUT_DOCUMENTS.has(tx.type));
  for (let i = 0; i < needsMetadata.length; i += METADATA_CHUNK_SIZE) {
    const chunk = needsMetadata.slice(i, i + METADATA_CHUNK_SIZE);
    try {
      const withMetadata = await prisma.transaction.findMany({
        where: { id: { in: chunk.map((tx) => tx.id) } },
        select: { id: true, type: true, metadata: true, updatedAt: true }
      });
      for (const tx of withMetadata) {
        enrichmentById.set(tx.id, {
          document_available: hasStoredServiceDocument(tx.metadata),
          summary:
            tx.type === 'NIN_VERIFICATION' || tx.type === 'BVN_VERIFICATION'
              ? safeIdentitySlipSummary(tx.metadata, tx.updatedAt)
              : {}
        });
      }
    } catch (error) {
      console.warn('[transactions] service history enrichment chunk failed; continuing without documents for this chunk', {
        error: error instanceof Error ? error.name : 'unknown'
      });
    }
  }

  res.set('Cache-Control', 'no-store');
  res.json({
    status: true,
    data: transactions.map((tx) => {
      // metadata.service is the specific VerificationServiceKey (e.g.
      // "NIN_SLIP_PREMIUM", "IPE_CLEARANCE") for the identity-verification
      // types, which all share the single generic
      // NIN_VERIFICATION/BVN_VERIFICATION/IDENTITY_SERVICE_REQUEST
      // TransactionType - tx.type alone can't tell those apart. Every other
      // service type (data, airtime, NIN Modification, CAC, ...) is already
      // 1:1 with its own TransactionType, so this is simply undefined for
      // them and the frontend groups on tx.type alone in that case.
      const service = plainById.get(tx.id)?.service ?? undefined;
      const enrichment = enrichmentById.get(tx.id);
      return {
        id: tx.id,
        reference: tx.reference,
        type: tx.type.toLowerCase(),
        service,
        status: tx.status.toLowerCase(),
        amount: koboToNaira(tx.amountKobo),
        balance_after: koboToNaira(tx.balanceAfterKobo),
        description: tx.description,
        created_at: tx.createdAt.toISOString(),
        document_available: enrichment?.document_available ?? false,
        ...(enrichment?.summary ?? {})
      };
    })
  });
});

transactionRoutes.get('/:id', async (req, res) => {
  const tx = await prisma.transaction.findFirstOrThrow({
    where: { id: req.params.id, userId: req.user!.id }
  });

  res.json({
    id: tx.id,
    reference: tx.reference,
    type: tx.type.toLowerCase(),
    status: tx.status.toLowerCase(),
    amount: koboToNaira(tx.amountKobo),
    balance_after: koboToNaira(tx.balanceAfterKobo),
    description: tx.description,
    created_at: tx.createdAt.toISOString(),
    metadata: tx.metadata
  });
});
