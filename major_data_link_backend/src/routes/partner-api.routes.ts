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
import { createPartnerDynamicFunding, partnerFundingResponse, provisionPartnerVirtualAccount, verifyPartnerFunding } from '../services/partner-funding.service.js';

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
  res.json({ status: true, data: partnerFundingResponse(partner) });
});

partnerApiRoutes.post('/wallet/funding-account', async (req, res) => {
  const partner = await provisionPartnerVirtualAccount(req.partner!.id);
  res.json({ status: true, message: 'Partner funding account is ready', data: partnerFundingResponse(partner) });
});

partnerApiRoutes.post('/wallet/fund/dynamic', async (req, res) => {
  const body = z.object({ amount: z.number().positive().max(5_000_000) }).parse(req.body);
  const funding = await createPartnerDynamicFunding(req.partner!.id, body.amount);
  res.status(201).json({ status: true, message: 'Transfer this exact amount to fund your partner wallet', data: {
    amount: body.amount, reference: funding.reference, account_number: funding.accountNumber,
    account_name: funding.accountName, bank_name: funding.bankName ?? null, expires_at: funding.expiresAt ?? null
  }});
});

partnerApiRoutes.post('/wallet/fund/verify', async (req, res) => {
  const body = z.object({ reference: z.string().trim().min(1) }).parse(req.body);
  const owned = await prisma.partnerTransaction.findFirst({ where: { partnerId: req.partner!.id, reference: body.reference, type: TransactionType.WALLET_FUNDING } });
  if (!owned) return res.status(404).json({ status: false, message: 'Partner funding transaction not found', code: 'PARTNER_FUNDING_NOT_FOUND' });
  const result = await verifyPartnerFunding(body.reference);
  res.json({ status: result.status === 'success', message: result.status === 'success' ? 'Partner wallet funded' : `Payment ${result.status}`, data: partnerTransactionResponse(result.transaction) });
});

partnerApiRoutes.get('/dashboard', async (req, res) => {
  const now = new Date();
  const today = new Date(now); today.setHours(0, 0, 0, 0);
  const thirtyDaysAgo = new Date(now); thirtyDaysAgo.setDate(now.getDate() - 29); thirtyDaysAgo.setHours(0, 0, 0, 0);
  const [partner, all, recent, verificationPrices] = await Promise.all([
    prisma.partner.findUniqueOrThrow({ where: { id: req.partner!.id } }),
    prisma.partnerTransaction.findMany({
      where: { partnerId: req.partner!.id, createdAt: { gte: thirtyDaysAgo }, type: { not: TransactionType.REFUND } },
      select: { status: true, amountKobo: true, createdAt: true }
    }),
    prisma.partnerTransaction.findMany({
      where: { partnerId: req.partner!.id }, orderBy: { createdAt: 'desc' }, take: 20
    }),
    listVerificationPrices()
  ]);
  const calls = all.length;
  const successful = all.filter((tx) => tx.status === TransactionStatus.SUCCESS).length;
  const failed = all.filter((tx) => tx.status === TransactionStatus.FAILED || tx.status === TransactionStatus.REVERSED).length;
  const todayCalls = all.filter((tx) => tx.createdAt >= today).length;
  const totalSpendKobo = all.filter((tx) => tx.status === TransactionStatus.SUCCESS).reduce((sum, tx) => sum + tx.amountKobo, 0n);
  const byDay = Array.from({ length: 30 }, (_, index) => {
    const date = new Date(thirtyDaysAgo); date.setDate(thirtyDaysAgo.getDate() + index);
    const next = new Date(date); next.setDate(date.getDate() + 1);
    const dayTransactions = all.filter((tx) => tx.createdAt >= date && tx.createdAt < next);
    return { date: date.toISOString().slice(0, 10), total: dayTransactions.length,
      successful: dayTransactions.filter((tx) => tx.status === TransactionStatus.SUCCESS).length,
      failed: dayTransactions.filter((tx) => tx.status === TransactionStatus.FAILED || tx.status === TransactionStatus.REVERSED).length };
  });
  res.json({ status: true, data: {
    partner: { business_name: partner.businessName, email: partner.email, phone: partner.phone },
    wallet: partnerFundingResponse(partner),
    summary: { today_calls: todayCalls, total_calls: calls, total_spend: koboToNaira(totalSpendKobo), successful_calls: successful, failed_calls: failed },
    chart: byDay, recent_transactions: recent.map(partnerTransactionResponse),
    service_pricing: verificationPrices.filter((price) => price.isActive).map((price) => ({ service: price.service, label: price.label, price: price.unitPrice }))
  }});
});

partnerApiRoutes.post('/partner/phone', async (req, res) => {
  const body = z.object({ phone: z.string().trim().min(6).max(20) }).parse(req.body);
  const partner = await prisma.partner.update({ where: { id: req.partner!.id }, data: { phone: body.phone } });
  res.json({ status: true, message: 'Partner phone number saved', data: { phone: partner.phone } });
});

partnerApiRoutes.get('/transactions', async (req, res) => {
  const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);
  const transactions = await prisma.partnerTransaction.findMany({ where: { partnerId: req.partner!.id }, orderBy: { createdAt: 'desc' }, take: limit });
  res.json({ status: true, data: transactions.map(partnerTransactionResponse) });
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

function asyncVerificationResponse(result: { reference: string; ticketId: string; balanceAfter?: number; status: 'pending' | 'success' | 'failed'; response?: Record<string, unknown> | null }) {
  return { status: result.status !== 'failed', data: {
    reference: result.reference, ticket_id: result.ticketId, status: result.status,
    ...(result.balanceAfter === undefined ? {} : { balance_after: result.balanceAfter }),
    ...(result.response === undefined ? {} : { response: result.response })
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

// Async NIN services: submit once with Idempotency-Key, then poll the returned
// ticket endpoint. A pending request must never be re-submitted as a new order.
const ninValidationType = z.enum(['nin_validation', 'no_record', 'sim', 'modification', 'photo_error', 'bank_validation', 'v.nin_validation', 'update_records']);

partnerApiRoutes.post('/verification/nin/validation', async (req, res) => {
  const body = z.object({ nin: z.string().trim().length(11), validation_type: ninValidationType.optional() }).parse(req.body);
  const result = await partnerVerification.submitNinValidation(req.partner!.id, body.nin, body.validation_type, idempotencyKeyFrom(req));
  res.set('Cache-Control', 'no-store');
  res.status(202).json(asyncVerificationResponse(result));
});

partnerApiRoutes.get('/verification/nin/validation/:ticketId', async (req, res) => {
  const result = await partnerVerification.checkNinValidation(req.partner!.id, req.params.ticketId);
  res.set('Cache-Control', 'no-store');
  res.json(asyncVerificationResponse(result));
});

partnerApiRoutes.post('/verification/nin/ipe-clearance', async (req, res) => {
  const body = z.object({ tracking_id: z.string().trim().min(1).max(50) }).parse(req.body);
  const result = await partnerVerification.submitIpeClearance(req.partner!.id, body.tracking_id, idempotencyKeyFrom(req));
  res.set('Cache-Control', 'no-store');
  res.status(202).json(asyncVerificationResponse(result));
});

partnerApiRoutes.get('/verification/nin/ipe-clearance/:ticketId', async (req, res) => {
  const result = await partnerVerification.checkIpeClearance(req.partner!.id, req.params.ticketId);
  res.set('Cache-Control', 'no-store');
  res.json(asyncVerificationResponse(result));
});

partnerApiRoutes.post('/verification/nin/personalization', async (req, res) => {
  const body = z.object({ tracking_id: z.string().trim().min(1).max(50) }).parse(req.body);
  const result = await partnerVerification.submitPersonalization(req.partner!.id, body.tracking_id, idempotencyKeyFrom(req));
  res.set('Cache-Control', 'no-store');
  res.status(202).json(asyncVerificationResponse(result));
});

partnerApiRoutes.get('/verification/nin/personalization/:ticketId', async (req, res) => {
  const result = await partnerVerification.checkPersonalization(req.partner!.id, req.params.ticketId);
  res.set('Cache-Control', 'no-store');
  res.json(asyncVerificationResponse(result));
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
