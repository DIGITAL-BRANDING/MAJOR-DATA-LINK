import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { pinField, requirePinConfirmation } from '../lib/require-pin.js';
import {
  CAC_DOCUMENT_LABELS,
  CAC_TYPES,
  getCacPrice,
  listCacHistory,
  listCacPrices,
  submitCacRequest,
  type CacType
} from '../services/cac.service.js';

export const cacRoutes = Router();

cacRoutes.use(requireAuth);

function idempotencyKeyFrom(req: { header: (name: string) => string | undefined }) {
  const header = req.header('Idempotency-Key');
  return header && header.trim().length > 0 ? header.trim() : undefined;
}

// 4MB raw per document (matches the frontend's own client-side cap) -
// base64 adds ~33%, so ~5.4MB each; with up to 4 named slots (see
// CAC_DOCUMENT_LABELS) that's comfortably inside the route-specific 25mb
// body limit app.ts gives this router (see the comment there for why CAC
// gets its own limit instead of the global 8mb one).
const MAX_DOCUMENT_BASE64_LENGTH = 5_500_000;

const submitSchema = z.object({
  cac_type: z.enum(CAC_TYPES),
  proposed_name_1: z.string().trim().min(2).max(200),
  proposed_name_2: z.string().trim().max(200).optional(),
  business_nature: z.string().trim().min(2).max(300),
  business_address: z.string().trim().min(3).max(300),
  proprietor_full_name: z.string().trim().min(2).max(200),
  proprietor_phone: z.string().trim().length(11).regex(/^\d{11}$/, 'Must be 11 digits'),
  proprietor_email: z.string().trim().email(),
  proprietor_residential_address: z.string().trim().min(3).max(300),
  proprietor_date_of_birth: z.string().trim().min(8),
  proprietor_gender: z.enum(['Male', 'Female']),
  proprietor_nin: z.string().trim().length(11).regex(/^\d{11}$/, 'Must be 11 digits'),
  supporting_documents: z
    .array(
      z.object({
        label: z.enum(CAC_DOCUMENT_LABELS),
        name: z.string().trim().min(1).max(200),
        mime_type: z.enum(['application/pdf', 'image/jpeg', 'image/png']),
        base64: z.string().min(20).max(MAX_DOCUMENT_BASE64_LENGTH)
      })
    )
    .max(CAC_DOCUMENT_LABELS.length)
    .optional(),
  ...pinField
});

cacRoutes.get('/document-labels', (_req, res) => {
  res.json({ status: true, data: CAC_DOCUMENT_LABELS });
});

cacRoutes.get('/prices', async (_req, res) => {
  const prices = await listCacPrices();
  res.json({ status: true, data: prices });
});

cacRoutes.get('/price', async (req, res) => {
  const type = z.enum(CAC_TYPES).parse(req.query.type);
  const price = await getCacPrice(type);
  res.json({ status: true, data: { unit_price: price.unitPrice } });
});

cacRoutes.get('/history', async (req, res) => {
  res.set('Cache-Control', 'no-store');
  const data = await listCacHistory(req.user!.id);
  res.json({ status: true, data });
});

cacRoutes.post('/submit', async (req, res) => {
  const body = submitSchema.parse(req.body);
  await requirePinConfirmation(req.user!.id, body.pin);
  const { pin, cac_type, proposed_name_1, proposed_name_2, ...details } = body;
  void pin;
  const result = await submitCacRequest({
    userId: req.user!.id,
    type: cac_type as CacType,
    proposedName1: proposed_name_1,
    proposedName2: proposed_name_2,
    details,
    idempotencyKey: idempotencyKeyFrom(req)
  });
  res.json({
    status: true,
    message: `Request submitted \u2014 reference ${result.reference}. We'll register your business and update the status below.`,
    data: { reference: result.reference, balance_after: result.balanceAfter }
  });
});
