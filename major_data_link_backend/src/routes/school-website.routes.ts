import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { pinField, requirePinConfirmation } from '../lib/require-pin.js';
import { listSchoolWebsitePlans, listSchoolWebsiteSubscriptions, purchaseSchoolWebsiteSubscription } from '../services/school-website.service.js';

export const schoolWebsiteRoutes = Router();
schoolWebsiteRoutes.use(requireAuth);

const purchaseSchema = z.object({
  plan: z.enum(['MONTHLY', 'TERMLY', 'ANNUAL']),
  school_name: z.string().trim().min(2).max(120),
  contact_phone: z.string().trim().min(7).max(24),
  ...pinField
});

schoolWebsiteRoutes.get('/plans', async (_req, res) => {
  res.set('Cache-Control', 'no-store');
  res.json({ status: true, data: await listSchoolWebsitePlans() });
});

schoolWebsiteRoutes.get('/subscriptions', async (req, res) => {
  res.set('Cache-Control', 'no-store');
  res.json({ status: true, data: await listSchoolWebsiteSubscriptions(req.user!.id) });
});

schoolWebsiteRoutes.post('/subscribe', async (req, res) => {
  const body = purchaseSchema.parse(req.body);
  await requirePinConfirmation(req.user!.id, body.pin);
  const result = await purchaseSchoolWebsiteSubscription({
    userId: req.user!.id,
    plan: body.plan,
    schoolName: body.school_name,
    contactPhone: body.contact_phone,
    idempotencyKey: req.header('Idempotency-Key')?.trim() || undefined
  });
  res.json({ status: true, message: result.reused ? 'This subscription request was already received.' : 'Subscription request received. Our team will activate your EduTrac access shortly.', data: result });
});
