import { Router, type Request } from 'express';
import { Prisma, TransactionStatus, TransactionType } from '@prisma/client';
import { z } from 'zod';
import { koboToNaira } from '../lib/money.js';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { providerService, type ProviderPurchaseInput } from '../services/provider.service.js';
import { debitWallet, refundWallet } from '../services/wallet.service.js';
import { recordProviderDebit } from '../services/provider-ledger.service.js';
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
export async function processProviderPurchase(params: {
  userId: string;
  amount: number;
  type: TransactionType;
  description: string;
  metadata: Prisma.InputJsonValue;
  idempotencyKey?: string;
  /**
   * Our best-known cost basis at debit time (e.g. plan.providerAmount for
   * data). Omit for purchase types with no config-based cost available up
   * front (airtime) - `provider.costKobo`, the ACTUAL cost Alrahuz's
   * response reports, always wins over this estimate on success; this is
   * only what gets stored if that actual figure isn't available. See the
   * costKobo doc-comment on debitWallet() in wallet.service.ts.
   */
  costKobo?: bigint;
  callProvider: (reference: string) => ReturnType<typeof providerService.buyData>;
}) {
  const debit = await debitWallet({
    userId: params.userId,
    amount: params.amount,
    type: params.type,
    description: params.description,
    metadata: params.metadata,
    idempotencyKey: params.idempotencyKey,
    costKobo: params.costKobo
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
    const finalCostKobo = provider.costKobo ?? params.costKobo;

    await prisma.transaction.update({
      where: { id: debit.transaction.id },
      data: {
        status: TransactionStatus.SUCCESS,
        provider: 'alrahuz',
        providerRef: provider.providerRef ?? null,
        // Alrahuz's own reported balance delta, when present, is more
        // accurate than the config-based estimate debitWallet() stored above
        // (it's what we were ACTUALLY charged, this one time) - overwrite
        // with it. Otherwise leave the estimate (or null) as-is.
        ...(provider.costKobo !== undefined ? { costKobo: provider.costKobo } : {})
      }
    });

    // Best-effort - never blocks a successful purchase response. Only
    // recorded when a real cost figure exists (see recordProviderDebit's
    // own no-op-on-null-ish-amount guard) - an unknown-cost purchase must
    // never appear as a free (zero-cost) debit on the provider ledger.
    if (finalCostKobo !== undefined) {
      await recordProviderDebit({
        provider: 'alrahuz',
        amountKobo: finalCostKobo,
        relatedTransactionId: debit.transaction.id,
        description: params.description
      }).catch((error) => {
        console.error('[provider-ledger] failed to record debit for', debit.transaction.id, error);
      });
    }

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
    balanceAfter: koboToNaira(refunded.transaction.balanceAfterKobo)
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
    // What this plan cost us according to our last pricing sync
    // (DataPlanPricing.providerCostKobo) - overwritten with Alrahuz's actual
    // reported balance delta on success, see processProviderPurchase above.
    costKobo: BigInt(Math.round(plan.providerAmount * 100)),
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
    // No `costKobo` here on purpose - unlike data plans, airtime has no
    // pricing-config table to estimate from (Alrahuz doesn't quote a fixed
    // discount rate up front). Our real cost is only knowable from Alrahuz's
    // own balance_before/balance_after delta once they respond - see
    // provider.costKobo in processProviderPurchase above. In MOCK_PROVIDER
    // mode (no real balance movement), this stays null - "unknown", not "0
    // margin" - see the costKobo comment on the Transaction model.
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
