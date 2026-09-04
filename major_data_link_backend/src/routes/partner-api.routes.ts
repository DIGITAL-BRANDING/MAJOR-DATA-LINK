import { Router, type Request } from 'express';
import rateLimit from 'express-rate-limit';
import { Prisma, TransactionStatus, TransactionType } from '@prisma/client';
import { z } from 'zod';
import { koboToNaira } from '../lib/money.js';
import { prisma } from '../lib/prisma.js';
import { ApiError } from '../middleware/error.js';
import { requirePartnerApiKey } from '../middleware/partner-auth.js';
import { providerService, type ProviderPurchaseInput } from '../services/provider.service.js';
import * as bilalsadasub from '../services/bilalsadasub.service.js';
import { getPricingSettings } from '../services/pricing-settings.service.js';
import {
  completePartnerPurchase,
  debitPartnerWallet,
  partnerTransactionResponse,
  reversePartnerPurchase
} from '../services/partner-wallet.service.js';
import type { NormalizedProviderResponse } from '../services/provider-types.js';
import { listVerificationPrices } from '../services/verification.service.js';
import { partnerVerification } from '../services/partner-verification.service.js';

export const partnerApiRoutes = Router();

function idempotencyKeyFrom(req: Request) {
  const key = req.header('Idempotency-Key')?.trim();
  if (!key || key.length < 8 || key.length > 128) {
    throw new ApiError(422, 'Idempotency-Key header is required and must be 8-128 characters', 'IDEMPOTENCY_KEY_REQUIRED');
  }
  return key;
}

async function activeDataAirtimeProvider(): Promise<'alrahuz' | 'bilalsadasub'> {
  const settings = await getPricingSettings();
  return settings.dataAirtimeProvider === 'bilalsadasub' ? 'bilalsadasub' : 'alrahuz';
}

async function purchaseForPartner(input: {
  partnerId: string;
  amount: number;
  type: TransactionType;
  description: string;
  metadata: Prisma.InputJsonValue;
  idempotencyKey: string;
  provider: 'alrahuz' | 'bilalsadasub';
  callProvider: (reference: string) => Promise<NormalizedProviderResponse>;
}) {
  const debit = await debitPartnerWallet(input);
  if (debit.reused && debit.transaction.status !== TransactionStatus.PENDING) {
    return { transaction: debit.transaction, message: 'Transaction already processed' };
  }

  const upstream = await input.callProvider(debit.transaction.reference);
  if (upstream.status) {
    const transaction = await completePartnerPurchase(debit.transaction.id, input.provider, upstream.providerRef);
    return { transaction, message: upstream.message ?? 'Transaction processed' };
  }
  if (upstream.pending) {
    // The exact same upstream reference is retained, so a status reconciler can
    // safely complete it later without asking the partner to submit a new order.
    return { transaction: debit.transaction, message: upstream.message ?? 'Transaction is pending confirmation' };
  }
  const transaction = await reversePartnerPurchase(debit.transaction.id, upstream.message ?? 'Provider rejected transaction');
  return { transaction, message: upstream.message ?? 'Transaction failed and was refunded' };
}

partnerApiRoutes.get('/health', (_req, res) => {
  res.json({ status: true, service: 'major-data-link-partner-api', version: 'v1' });
});

partnerApiRoutes.use(requirePartnerApiKey);
partnerApiRoutes.use(rateLimit({
  windowMs: 60_000,
  limit: 60,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: (req) => `partner:${req.partner!.id}`,
  message: { status: false, message: 'Partner API rate limit exceeded', code: 'RATE_LIMITED' }
}));

partnerApiRoutes.get('/wallet/balance', async (req, res) => {
  const partner = await prisma.partner.findUniqueOrThrow({ where: { id: req.partner!.id } });
  res.json({ status: true, data: { balance: koboToNaira(partner.walletBalanceKobo), currency: 'NGN' } });
});

partnerApiRoutes.get('/data/plans/:network/categories', async (req, res) => {
  const provider = await activeDataAirtimeProvider();
  const data = provider === 'bilalsadasub'
    ? await bilalsadasub.getDataPlanCategories(req.params.network)
    : await providerService.getDataPlanCategories(req.params.network);
  res.json({ status: true, data });
});

partnerApiRoutes.get('/data/plans/:network', async (req, res) => {
  const category = typeof req.query.category === 'string' ? req.query.category : undefined;
  const provider = await activeDataAirtimeProvider();
  const plans = provider === 'bilalsadasub'
    ? await bilalsadasub.getDataPlans(req.params.network, category)
    : await providerService.getDataPlans(req.params.network, category);
  res.json({ status: true, data: [...plans].sort((a, b) => a.sellingAmount - b.sellingAmount) });
});

partnerApiRoutes.get('/verification/prices', async (_req, res) => {
  const prices = await listVerificationPrices();
  res.json({ status: true, data: prices });
});

function verificationResponse(result: Awaited<ReturnType<typeof partnerVerification.ninByNin>>) {
  // Identity results are intentionally returned only to the authenticated
  // requesting partner and are never logged by this route.
  return { status: result.status, message: result.message, data: {
    reference: result.reference, balance_after: result.balanceAfter,
    user_data: result.userData ?? null, pdf_base64: result.pdfBase64 ?? null, pdf_url: result.pdfUrl ?? null
  }};
}

partnerApiRoutes.post('/verification/nin/by-nin', async (req, res) => {
  const body = z.object({ nin: z.string().trim().length(11), tier: z.enum(['premium', 'standard', 'regular', 'vnin']) }).parse(req.body);
  const result = await partnerVerification.ninByNin(req.partner!.id, body.nin, body.tier, idempotencyKeyFrom(req));
  res.set('Cache-Control', 'no-store');
  res.json(verificationResponse(result));
});

partnerApiRoutes.post('/verification/nin/by-phone', async (req, res) => {
  const body = z.object({ phone: z.string().trim().length(11), tier: z.enum(['premium', 'standard', 'regular']) }).parse(req.body);
  const result = await partnerVerification.ninByPhone(req.partner!.id, body.phone, body.tier, idempotencyKeyFrom(req));
  res.set('Cache-Control', 'no-store');
  res.json(verificationResponse(result));
});

partnerApiRoutes.post('/verification/nin/by-demographic', async (req, res) => {
  const body = z.object({ firstname: z.string().trim().min(1), lastname: z.string().trim().min(1), dob: z.string().trim().min(1), gender: z.enum(['MALE', 'FEMALE']).optional() }).parse(req.body);
  const result = await partnerVerification.ninByDemographic(req.partner!.id, body, idempotencyKeyFrom(req));
  res.set('Cache-Control', 'no-store');
  res.json(verificationResponse(result));
});

partnerApiRoutes.post('/verification/bvn/slip', async (req, res) => {
  const body = z.object({ bvn: z.string().trim().length(11), tier: z.enum(['premium', 'standard']) }).parse(req.body);
  const result = await partnerVerification.bvnSlip(req.partner!.id, body.bvn, body.tier, idempotencyKeyFrom(req));
  res.set('Cache-Control', 'no-store');
  res.json(verificationResponse(result));
});

partnerApiRoutes.post('/data/purchase', async (req, res) => {
  const body = z.object({ network: z.string().min(1), plan_id: z.string().min(1), phone: z.string().trim().min(6).max(20) }).parse(req.body);
  const provider = await activeDataAirtimeProvider();
  const plan = provider === 'bilalsadasub'
    ? await bilalsadasub.getDataPlan(body.network, body.plan_id)
    : await providerService.getDataPlan(body.network, body.plan_id);
  const result = await purchaseForPartner({
    partnerId: req.partner!.id,
    amount: plan.amount,
    type: TransactionType.DATA_PURCHASE,
    description: `${plan.name} data purchase for ${body.phone}`,
    metadata: { ...body, plan_name: plan.name, validity: plan.validity },
    idempotencyKey: idempotencyKeyFrom(req),
    provider,
    callProvider: (reference) => provider === 'bilalsadasub'
      ? bilalsadasub.buyData({ network: body.network, planId: body.plan_id, phone: body.phone, reference })
      : providerService.buyData({ network: body.network, planId: body.plan_id, phone: body.phone, amount: plan.amount, reference } satisfies ProviderPurchaseInput)
  });
  res.json({ status: result.transaction.status === TransactionStatus.SUCCESS, message: result.message, data: partnerTransactionResponse(result.transaction) });
});

partnerApiRoutes.post('/airtime/purchase', async (req, res) => {
  const body = z.object({ network: z.string().min(1), phone: z.string().trim().min(6).max(20), amount: z.number().positive().max(500000) }).parse(req.body);
  const provider = await activeDataAirtimeProvider();
  const result = await purchaseForPartner({
    partnerId: req.partner!.id,
    amount: body.amount,
    type: TransactionType.AIRTIME_PURCHASE,
    description: `Airtime purchase for ${body.phone}`,
    metadata: body,
    idempotencyKey: idempotencyKeyFrom(req),
    provider,
    callProvider: (reference) => provider === 'bilalsadasub'
      ? bilalsadasub.buyAirtime({ network: body.network, phone: body.phone, amount: body.amount, reference })
      : providerService.buyAirtime({ network: body.network, phone: body.phone, amount: body.amount, reference } satisfies ProviderPurchaseInput)
  });
  res.json({ status: result.transaction.status === TransactionStatus.SUCCESS, message: result.message, data: partnerTransactionResponse(result.transaction) });
});

partnerApiRoutes.get('/transactions/:reference', async (req, res) => {
  const transaction = await prisma.partnerTransaction.findFirst({ where: { partnerId: req.partner!.id, reference: req.params.reference } });
  if (!transaction) return res.status(404).json({ status: false, message: 'Transaction not found', code: 'TRANSACTION_NOT_FOUND' });
  res.json({ status: true, data: partnerTransactionResponse(transaction) });
});
