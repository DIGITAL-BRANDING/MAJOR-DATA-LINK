import { Prisma, TransactionType } from '@prisma/client';
import { Router, type Request } from 'express';
import { z } from 'zod';
import { sealPII } from '../lib/pii.js';
import { requireAuth } from '../middleware/auth.js';
import { ApiError } from '../middleware/error.js';
import { pinField, requirePinConfirmation } from '../lib/require-pin.js';
import { notifyUser } from '../services/notification.service.js';
import { debitWallet } from '../services/wallet.service.js';
import { requireServiceActive } from '../lib/service-status.js';
import { JAMB_SERVICE_DEFAULTS, getJambServicePrice, listJambServices, type JambServiceId } from '../services/jamb-pricing.service.js';

export const jambRoutes = Router();

jambRoutes.use(requireAuth);

/**
 * Server-side prices are authoritative. Never accept an amount from the
 * browser. Exported so admin/jamb.ts (the "fulfil this request" admin page)
 * can show the same label without redefining this table a second time.
 */
// Kept as an exported catalogue for request validation and partner routes.
// Actual customer/partner prices come from ServicePricing, not this default.
export const JAMB_SERVICES = JAMB_SERVICE_DEFAULTS;

const jambServiceIds = Object.keys(JAMB_SERVICES) as [keyof typeof JAMB_SERVICES, ...(keyof typeof JAMB_SERVICES)[]];

function idempotencyKeyFrom(req: Request) {
  const value = req.header('Idempotency-Key');
  return value && value.trim().length > 0 ? value.trim() : undefined;
}

jambRoutes.get('/services', async (_req, res) => {
  res.json({
    status: true,
    data: await listJambServices()
  });
});

/**
 * A JAMB document request is manual fulfilment, but it is still a paid service.
 * Debit happens only after the authenticated user's transaction PIN has been
 * checked, and the ledger row remains PENDING until an admin completes it
 * from the "Fulfil JAMB request" page (admin/jamb.ts) - which delivers the
 * actual document to the customer's Deliveries inbox and marks this
 * transaction SUCCESS in one step - or reverses it (which refunds the
 * wallet through the existing generic admin action).
 *
 * The registration number, candidate name and exam year are only ever
 * stored sealed inside this transaction's metadata (sealPII below) - never
 * duplicated anywhere in plain text, so the admin fulfilment page is the
 * only place that can decrypt and read them.
 */
jambRoutes.post('/requests', async (req, res) => {
  const body = z.object({
    service: z.enum(jambServiceIds),
    registration_number: z.string().trim().min(4).max(40).optional(),
    email: z.string().email().max(254).optional(),
    phone: z.string().trim().min(6).max(40).optional(),
    organization_name: z.string().trim().min(2).max(180).optional(),
    staff_count: z.enum(['2-5', '5 - 10', '10 - 20', '20 - 50']).optional(),
    trainees_count: z.enum(['20 - 50', '50 - 100', '100 - above']).optional(),
    whatsapp_number: z.string().trim().min(6).max(40).optional(),
    candidate_full_name: z.string().trim().min(3).max(160).optional(),
    exam_year: z.coerce.number().int().min(2000).max(new Date().getFullYear() + 1).optional(),
    ...pinField
  }).parse(req.body);

  if (body.service === 'cbt_practice_software') {
    if (!body.email || !body.phone || !body.organization_name || !body.staff_count || !body.trainees_count || !body.whatsapp_number) throw new ApiError(400, 'Complete all CBT software application fields', 'INVALID_CBT_APPLICATION');
  } else if (!body.registration_number || !body.candidate_full_name || !body.exam_year) {
    throw new ApiError(400, 'Enter your JAMB registration number, full name and exam year', 'INVALID_JAMB_REQUEST');
  }
  await requirePinConfirmation(req.user!.id, body.pin);
  await requireServiceActive('JAMB_SERVICE_REQUEST', 'JAMB Services');
  const selected = await getJambServicePrice(body.service as JambServiceId);
  const debit = await debitWallet({
    userId: req.user!.id,
    amount: selected.unitPrice,
    type: TransactionType.JAMB_SERVICE_REQUEST,
    description: `${selected.label} request`,
    metadata: {
      service: 'JAMB_SERVICE_REQUEST',
      jamb_service: body.service,
      unit_price: selected.unitPrice,
      pii: sealPII({
        ...(body.service === 'cbt_practice_software' ? { email: body.email, phone: body.phone, organization_name: body.organization_name, staff_count: body.staff_count, trainees_count: body.trainees_count, whatsapp_number: body.whatsapp_number } : { registration_number: body.registration_number, candidate_full_name: body.candidate_full_name, exam_year: body.exam_year })
      })
    } as Prisma.InputJsonValue,
    idempotencyKey: idempotencyKeyFrom(req)
  });

  // A repeat of an already accepted request must never debit twice.
  if (debit.reused) {
    return res.json({
      status: true,
      message: 'This JAMB request was already received and is awaiting processing.',
      data: { reference: debit.reference, balance_after: debit.balanceAfter }
    });
  }

  void notifyUser({
    userId: req.user!.id,
    type: 'TRANSACTION',
    title: 'JAMB request received',
    body: `₦${selected.unitPrice.toLocaleString()} was deducted for ${selected.label}. Reference: ${debit.reference}. We will notify you when it is ready.`,
    data: { transactionId: debit.transaction.id, reference: debit.reference }
  }).catch(() => undefined);

  res.status(201).json({
    status: true,
    message: 'Your paid JAMB request has been received and is awaiting processing.',
    data: { reference: debit.reference, balance_after: debit.balanceAfter }
  });
});
