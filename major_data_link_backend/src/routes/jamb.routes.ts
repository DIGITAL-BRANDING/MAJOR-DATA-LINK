import { Prisma, TransactionType } from '@prisma/client';
import { Router, type Request } from 'express';
import { z } from 'zod';
import { sealPII } from '../lib/pii.js';
import { requireAuth } from '../middleware/auth.js';
import { ApiError } from '../middleware/error.js';
import { pinField, requirePinConfirmation } from '../lib/require-pin.js';
import { prisma } from '../lib/prisma.js';
import { notifyUser } from '../services/notification.service.js';
import { debitWallet, refundWallet } from '../services/wallet.service.js';

export const jambRoutes = Router();

jambRoutes.use(requireAuth);

/** Server-side prices are authoritative. Never accept an amount from the browser. */
const JAMB_SERVICES = {
  cbt_practice_software: { label: 'JAMB CBT Practice Software', price: 5000 },
  original_result: { label: 'JAMB Original Result', price: 2500 },
  admission_letter: { label: 'JAMB Admission Letter', price: 2000 },
  exam_slip: { label: 'JAMB Exam Slip', price: 500 },
  result_slip: { label: 'JAMB Result Slip', price: 800 }
} as const;

const jambServiceIds = Object.keys(JAMB_SERVICES) as [keyof typeof JAMB_SERVICES, ...(keyof typeof JAMB_SERVICES)[]];

function idempotencyKeyFrom(req: Request) {
  const value = req.header('Idempotency-Key');
  return value && value.trim().length > 0 ? value.trim() : undefined;
}

jambRoutes.get('/services', (_req, res) => {
  res.json({
    status: true,
    data: Object.entries(JAMB_SERVICES).map(([id, service]) => ({ id, ...service }))
  });
});

/**
 * A JAMB document request is manual fulfilment, but it is still a paid service.
 * Debit happens only after the authenticated user's transaction PIN has been
 * checked, and the ledger row remains PENDING until an admin completes it or
 * reverses it (which refunds the wallet through the existing admin action).
 */
jambRoutes.post('/requests', async (req, res) => {
  const body = z.object({
    service: z.enum(jambServiceIds),
    registration_number: z.string().trim().min(4).max(40),
    candidate_full_name: z.string().trim().min(3).max(160),
    exam_year: z.coerce.number().int().min(2000).max(new Date().getFullYear() + 1),
    ...pinField
  }).parse(req.body);

  await requirePinConfirmation(req.user!.id, body.pin);
  const selected = JAMB_SERVICES[body.service];
  const debit = await debitWallet({
    userId: req.user!.id,
    amount: selected.price,
    type: TransactionType.JAMB_SERVICE_REQUEST,
    description: `${selected.label} request`,
    metadata: {
      service: 'JAMB_SERVICE_REQUEST',
      jamb_service: body.service,
      unit_price: selected.price,
      pii: sealPII({
        registration_number: body.registration_number,
        candidate_full_name: body.candidate_full_name,
        exam_year: body.exam_year
      })
    } as Prisma.InputJsonValue,
    idempotencyKey: idempotencyKeyFrom(req)
  });

  // A repeat of an already accepted request must never debit or create another ticket.
  if (debit.reused) {
    return res.json({
      status: true,
      message: 'This JAMB request was already received and is awaiting processing.',
      data: { reference: debit.reference, balance_after: debit.balanceAfter }
    });
  }

  try {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: req.user!.id } });
    await prisma.supportTicket.create({
      data: {
        userId: user.id,
        subject: `JAMB Service: ${selected.label} [${debit.reference}]`,
        messages: {
          create: {
            senderType: 'USER',
            senderId: user.id,
            senderName: user.fullName,
            message: `Paid JAMB service request\nReference: ${debit.reference}\nService: ${selected.label}\nAmount paid: ₦${selected.price.toLocaleString()}\n\nJAMB Registration Number: ${body.registration_number}\nCandidate Full Name: ${body.candidate_full_name}\nExam Year: ${body.exam_year}`
          }
        }
      }
    });
  } catch (error) {
    // Do not leave a user charged when the request cannot reach the admin queue.
    await refundWallet({
      transactionId: debit.transaction.id,
      userId: req.user!.id,
      reason: 'JAMB request could not be saved'
    });
    throw new ApiError(503, 'Your JAMB request could not be saved. The wallet charge has been reversed.', 'JAMB_REQUEST_FAILED');
  }

  void notifyUser({
    userId: req.user!.id,
    type: 'SERVICE',
    title: 'JAMB request received',
    body: `₦${selected.price.toLocaleString()} was deducted for ${selected.label}. Reference: ${debit.reference}. We will notify you when it is ready.`,
    data: { transactionId: debit.transaction.id, reference: debit.reference }
  }).catch(() => undefined);

  res.status(201).json({
    status: true,
    message: 'Your paid JAMB request has been received and is awaiting processing.',
    data: { reference: debit.reference, balance_after: debit.balanceAfter }
  });
});
