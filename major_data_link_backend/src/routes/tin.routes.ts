import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { pinField, requirePinConfirmation } from '../lib/require-pin.js';
import {
  TIN_DOCUMENT_MAX_BASE64_LENGTH,
  TIN_TYPES,
  getTinPrice,
  listTinHistory,
  listTinPrices,
  submitTinRequest,
  type TinType
} from '../services/tin.service.js';

export const tinRoutes = Router();

tinRoutes.use(requireAuth);

function idempotencyKeyFrom(req: { header: (name: string) => string | undefined }) {
  const header = req.header('Idempotency-Key');
  return header && header.trim().length > 0 ? header.trim() : undefined;
}

const consent = z.literal(true, { errorMap: () => ({ message: 'Please confirm the details are valid and correct' }) });

const companyFields = {
  business_type: z.string().trim().min(2).max(200),
  business_reg_no: z.string().trim().min(3).max(40),
  cac_status_report: z
    .object({
      name: z.string().trim().min(1).max(200),
      mime_type: z.enum(['application/pdf', 'image/jpeg', 'image/png']),
      base64: z.string().min(20).max(TIN_DOCUMENT_MAX_BASE64_LENGTH)
    })
    .optional()
};

const individualFields = {
  nin: z.string().trim().regex(/^\d{11}$/, 'NIN must be 11 digits'),
  first_name: z.string().trim().min(2).max(100),
  last_name: z.string().trim().min(2).max(100),
  middle_name: z.string().trim().max(100).optional(),
  date_of_birth: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date of birth must be YYYY-MM-DD')
};

const submitSchema = z.discriminatedUnion('tin_type', [
  z.object({ tin_type: z.literal('company'), ...companyFields, consent, ...pinField }),
  z.object({ tin_type: z.literal('individual'), ...individualFields, consent, ...pinField })
]);

const priceQuerySchema = z.enum(TIN_TYPES);

tinRoutes.get('/prices', async (_req, res) => {
  const prices = await listTinPrices();
  res.json({ status: true, data: prices });
});

tinRoutes.get('/price', async (req, res) => {
  const type: TinType = priceQuerySchema.parse(req.query.type);
  const price = await getTinPrice(type);
  res.json({ status: true, data: { unit_price: price.unitPrice } });
});

tinRoutes.get('/history', async (req, res) => {
  res.set('Cache-Control', 'no-store');
  const q = typeof req.query.q === 'string' ? req.query.q.trim() : undefined;
  const data = await listTinHistory(req.user!.id, q && q.length > 0 ? q : undefined);
  res.json({ status: true, data });
});

tinRoutes.post('/submit', async (req, res) => {
  const body = submitSchema.parse(req.body);
  await requirePinConfirmation(req.user!.id, body.pin);
  const submission =
    body.tin_type === 'company'
      ? {
          type: 'company' as const,
          businessType: body.business_type,
          businessRegNo: body.business_reg_no,
          cacStatusReport: body.cac_status_report
            ? { name: body.cac_status_report.name, mimeType: body.cac_status_report.mime_type, base64: body.cac_status_report.base64 }
            : undefined
        }
      : {
          type: 'individual' as const,
          nin: body.nin,
          firstName: body.first_name,
          lastName: body.last_name,
          middleName: body.middle_name || undefined,
          dateOfBirth: body.date_of_birth
        };
  const result = await submitTinRequest({
    userId: req.user!.id,
    submission,
    idempotencyKey: idempotencyKeyFrom(req)
  });
  res.json({
    status: true,
    message: `TIN request submitted \u2014 reference ${result.reference}. We will file it and deliver the certificate to your Deliveries.`,
    data: { reference: result.reference, balance_after: result.balanceAfter }
  });
});
