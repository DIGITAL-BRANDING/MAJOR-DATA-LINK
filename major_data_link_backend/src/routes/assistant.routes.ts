import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { assistantWorkflows, parseAssistantIntent } from '../services/assistant-workflow.service.js';
import { prisma } from '../lib/prisma.js';
import { TransactionStatus, TransactionType } from '@prisma/client';

export const assistantRoutes = Router();
assistantRoutes.use(requireAuth);

assistantRoutes.get('/workflows', (_req, res) => res.json({ status: true, data: assistantWorkflows }));
assistantRoutes.post('/parse', (req, res) => {
  const { message } = z.object({ message: z.string().trim().min(1).max(500) }).parse(req.body);
  res.json({ status: true, data: parseAssistantIntent(message) });
});

/** Recent successful recipients are derived from the user's own transactions.
 * No PINs or full transaction payloads are returned. */
assistantRoutes.get('/beneficiaries', async (req, res) => {
  const rows = await prisma.transaction.findMany({
    where: {
      userId: req.user!.id,
      status: TransactionStatus.SUCCESS,
      type: { in: [TransactionType.DATA_PURCHASE, TransactionType.AIRTIME_PURCHASE] }
    },
    orderBy: { createdAt: 'desc' },
    take: 30
  });
  const seen = new Set<string>();
  const data = rows.flatMap((row) => {
    const metadata = row.metadata && typeof row.metadata === 'object' && !Array.isArray(row.metadata)
      ? row.metadata as Record<string, unknown>
      : {};
    const phone = typeof metadata.phone === 'string' ? metadata.phone : undefined;
    if (!phone || seen.has(phone)) return [];
    seen.add(phone);
    return [{ phone, network: typeof metadata.network === 'string' ? metadata.network : undefined, type: row.type === TransactionType.DATA_PURCHASE ? 'data' : 'airtime', last_used_at: row.createdAt.toISOString() }];
  });
  res.json({ status: true, data });
});

assistantRoutes.post('/events', async (req, res) => {
  const body = z.object({
    intent: z.string().trim().max(80).optional(),
    stage: z.string().trim().min(1).max(80),
    outcome: z.enum(['started', 'waiting', 'success', 'failed', 'fallback', 'cancelled']),
    error_code: z.string().trim().max(80).optional(),
    transaction_ref: z.string().trim().max(160).optional(),
    metadata: z.record(z.union([z.string().max(200), z.number(), z.boolean()])).optional()
  }).parse(req.body);
  const forbidden = /pin|password|otp|secret/i;
  if ([body.intent, body.stage, body.error_code, body.transaction_ref, ...Object.keys(body.metadata ?? {})].some((value) => value && forbidden.test(value))) {
    return res.status(400).json({ status: false, message: 'Sensitive fields are not accepted in assistant audit events' });
  }
  await prisma.assistantAuditEvent.create({ data: { userId: req.user!.id, intent: body.intent, stage: body.stage, outcome: body.outcome, errorCode: body.error_code, transactionRef: body.transaction_ref, metadata: body.metadata } });
  return res.status(201).json({ status: true });
});

assistantRoutes.post('/fallback', async (req, res) => {
  const body = z.object({ reason: z.string().trim().min(3).max(240), stage: z.string().trim().max(80).default('unknown') }).parse(req.body);
  const user = await prisma.user.findUniqueOrThrow({ where: { id: req.user!.id } });
  const ticket = await prisma.supportTicket.create({ data: {
    userId: user.id,
    subject: 'MAJOR Assistant handoff',
    messages: { create: { senderType: 'USER', senderId: user.id, senderName: user.fullName, message: `Assistant handoff requested at stage "${body.stage}": ${body.reason}` } }
  } });
  await prisma.assistantAuditEvent.create({ data: { userId: user.id, stage: body.stage, outcome: 'fallback', errorCode: 'HUMAN_HANDOFF' } });
  return res.status(201).json({ status: true, data: { ticket_id: ticket.id } });
});
