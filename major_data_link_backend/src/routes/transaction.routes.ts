import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { koboToNaira } from '../lib/money.js';
import { openPII } from '../lib/pii.js';
import { requireAuth } from '../middleware/auth.js';

export const transactionRoutes = Router();

transactionRoutes.use(requireAuth);

type StoredServiceDocument = { base64: string; label: string };

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
  const candidates: Array<{ value: unknown; label: string }> = [
    // A completed CAC certificate is the customer-facing document. Fall back
    // to its submission form while an admin is still processing it.
    { value: pii?.certificate_pdf_base64, label: 'certificate' },
    { value: pii?.submission_pdf_base64, label: 'submission form' },
    { value: pii?.pdf_base64, label: 'service slip' },
    { value: userData?.pdf_base64, label: 'service slip' },
    // A few older locally-generated records used this top-level field.
    { value: record.pdf_base64, label: 'service document' }
  ];

  const document = candidates.find(({ value }) => typeof value === 'string' && value.trim().length > 0);
  return document && typeof document.value === 'string'
    ? { base64: document.value, label: document.label }
    : null;
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
      document_available: Boolean(storedServiceDocument(tx.metadata))
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
  const pdf = document ? documentBuffer(document.base64) : null;
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
transactionRoutes.get('/services', async (req, res) => {
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
    take: 250
  });

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
      // them and the frontend groups on tx.type alone in that case. Safe to
      // expose: this is metadata's plaintext operational half, never the
      // sealed PII half (see sealPII/pii.ts) - no NIN/BVN/personal data here.
      const metadata = tx.metadata as { service?: unknown } | null;
      const service = typeof metadata?.service === 'string' ? metadata.service : undefined;
      return {
        id: tx.id,
        reference: tx.reference,
        type: tx.type.toLowerCase(),
        service,
        status: tx.status.toLowerCase(),
        amount: koboToNaira(tx.amountKobo),
        balance_after: koboToNaira(tx.balanceAfterKobo),
        description: tx.description,
        created_at: tx.createdAt.toISOString()
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
