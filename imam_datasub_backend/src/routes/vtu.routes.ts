import { Router, type Request } from 'express';
import { Prisma, TransactionStatus, TransactionType } from '@prisma/client';
import { z } from 'zod';
import { koboToNaira } from '../lib/money.js';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { providerService, type ProviderPurchaseInput } from '../services/provider.service.js';
import { debitWallet, refundWallet } from '../services/wallet.service.js';
import { awardReferralCommission } from '../services/referral.service.js';

export const vtuRoutes = Router();

vtuRoutes.use(requireAuth);

function idempotencyKeyFrom(req: Request) {
  const header = req.header('Idempotency-Key');
  return header && header.trim().length > 0 ? header.trim() : undefined;
}

/**
 * Shared purchase flow for anything that debits the wallet then calls the provider
 * (data, airtime, and later electricity/cable). Handles:
 *  - idempotent replay: if this request was already processed, return the cached result
 *    instead of debiting/calling the provider again
 *  - refund on provider failure: the debit always happens first (so balance can never go
 *    negative if the provider call times out mid-flight), and is reversed if the provider
 *    reports failure
 */
async function processProviderPurchase(params: {
  userId: string;
  amount: number;
  type: TransactionType;
  description: string;
  metadata: Prisma.InputJsonValue;
  idempotencyKey?: string;
  callProvider: (reference: string) => ReturnType<typeof providerService.buyData>;
}) {
  const debit = await debitWallet({
    userId: params.userId,
    amount: params.amount,
    type: params.type,
    description: params.description,
    metadata: params.metadata,
    idempotencyKey: params.idempotencyKey
  });

  // Replaying a request we've already fully handled (success, failed+refunded, or reversed) —
  // don't call the provider again, just return what happened last time.
  if (debit.reused && debit.transaction.status !== TransactionStatus.PENDING) {
    return {
      status: debit.transaction.status === TransactionStatus.SUCCESS ? ('success' as const) : false,
      message: 'Transaction already processed',
      reference: debit.reference,
      balanceAfter: koboToNaira(debit.transaction.balanceAfterKobo)
    };
  }

  const provider = await params.callProvider(debit.reference);

  if (provider.status) {
    await prisma.transaction.update({
      where: { id: debit.transaction.id },
      data: {
        status: TransactionStatus.SUCCESS,
        provider: 'alrahuz',
        providerRef: provider.providerRef ?? null
      }
    });

    // Best-effort by design (see the function's own doc comment) - never
    // throws, so it can't turn a successful purchase into a failed response.
    await awardReferralCommission({
      buyerId: params.userId,
      purchaseAmountKobo: debit.transaction.amountKobo,
      sourceTransactionId: debit.transaction.id
    });

    return {
      status: 'success' as const,
      message: provider.message ?? 'Transaction processed',
      reference: debit.reference,
      balanceAfter: debit.balanceAfter
    };
  }

  // Provider failed: reverse the debit so the user isn't charged for nothing.
  await prisma.transaction.update({
    where: { id: debit.transaction.id },
    data: {
      status: TransactionStatus.FAILED,
      provider: 'alrahuz',
      providerRef: provider.providerRef ?? null
    }
  });
  const refunded = await refundWallet({ transactionId: debit.transaction.id, userId: params.userId });

  return {
    status: false as const,
    message: provider.message ?? 'Transaction failed and was refunded',
    reference: debit.reference,
    balanceAfter: koboToNaira(refunded.balanceAfterKobo)
  };
}

vtuRoutes.get('/data/plans/:network/categories', async (req, res) => {
  const categories = await providerService.getDataPlanCategories(req.params.network);
  res.json({ status: true, data: categories });
});

vtuRoutes.get('/data/plans/:network', async (req, res) => {
  const category = typeof req.query.category === 'string' ? req.query.category : undefined;
  const plans = await providerService.getDataPlans(req.params.network, category);
  res.json({ status: true, data: plans });
});

vtuRoutes.post('/data/purchase', async (req, res) => {
  const body = z.object({
    network: z.string(),
    plan_id: z.string(),
    phone: z.string(),
    amount: z.number().positive().optional()
  }).parse(req.body);
  const plan = await providerService.getDataPlan(body.network, body.plan_id);

  const result = await processProviderPurchase({
    userId: req.user!.id,
    amount: plan.amount,
    type: TransactionType.DATA_PURCHASE,
    description: `${plan.name} data purchase for ${body.phone}`,
    metadata: { ...body, amount: plan.amount, plan_name: plan.name, validity: plan.validity },
    idempotencyKey: idempotencyKeyFrom(req),
    callProvider: (reference) =>
      providerService.buyData({
        network: body.network,
        planId: body.plan_id,
        phone: body.phone,
        amount: plan.amount,
        reference
      } satisfies ProviderPurchaseInput)
  });

  res.json({
    status: result.status,
    message: result.message,
    data: { reference: result.reference, balance_after: result.balanceAfter }
  });
});

vtuRoutes.post('/airtime/purchase', async (req, res) => {
  const body = z.object({
    network: z.string(),
    phone: z.string(),
    amount: z.number().positive()
  }).parse(req.body);

  const result = await processProviderPurchase({
    userId: req.user!.id,
    amount: body.amount,
    type: TransactionType.AIRTIME_PURCHASE,
    description: `Airtime purchase for ${body.phone}`,
    metadata: body,
    idempotencyKey: idempotencyKeyFrom(req),
    callProvider: (reference) =>
      providerService.buyAirtime({
        network: body.network,
        phone: body.phone,
        amount: body.amount,
        reference
      } satisfies ProviderPurchaseInput)
  });

  res.json({
    status: result.status,
    message: result.message,
    data: { reference: result.reference, balance_after: result.balanceAfter }
  });
});
