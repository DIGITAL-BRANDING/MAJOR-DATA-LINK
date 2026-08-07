import { env } from '../config/env.js';
import { koboToNaira, nairaToKobo } from '../lib/money.js';
import { prisma } from '../lib/prisma.js';
import type { DataPlan } from './data-plans.data.js';

export type PricedDataPlan = DataPlan & {
  providerAmount: number;
  sellingAmount: number;
  profit: number;
  isActive: boolean;
  pricingId?: string;
  planType?: string;
};

function planTypeFrom(name: string) {
  const [type] = name.split(' - ');
  return type && type !== name ? type.trim().toUpperCase() : undefined;
}

function defaultSellingPrice(providerCost: number) {
  return Math.ceil(
    providerCost +
      (providerCost * env.DATA_PLAN_MARKUP_PERCENT) / 100 +
      env.DATA_PLAN_MARKUP_NAIRA
  );
}

export class DataPlanPricingService {
  /**
   * Was previously one sequential `upsert` per plan (N+1: ~50-100+ round trips
   * to Postgres, one per plan, every time the in-memory plan cache went cold).
   * With DATABASE_URL's connection_limit=1 that serialized queue alone could
   * take several seconds - this was the main cause of "data plans dinah dade
   * yana loading". Fixed by reading all existing pricing rows for this batch
   * in ONE query, computing prices from that in-memory map (no DB round trip
   * needed on the hot path for plans we've already priced before), and only
   * writing the rows that are actually new/changed - and doing that write
   * AFTER the response-relevant computation, via persistPricingUpdates(),
   * fired-and-forgotten so it never blocks what the user is waiting on.
   */
  async applyPricing(plans: DataPlan[], network: string) {
    if (plans.length === 0) return [];

    const existingRows = await prisma.dataPlanPricing.findMany({
      where: {
        provider: 'alrahuz',
        providerPlanId: { in: plans.map((plan) => plan.id) }
      }
    });
    const existingByPlanId = new Map(existingRows.map((row) => [row.providerPlanId, row]));

    const priced: PricedDataPlan[] = [];
    const toCreate: { plan: DataPlan; providerCostKobo: bigint; planType: string | undefined }[] = [];
    const toUpdate: { id: string; plan: DataPlan; providerCostKobo: bigint; planType: string | undefined }[] = [];

    for (const plan of plans) {
      const providerCostKobo = nairaToKobo(plan.amount);
      const planType = planTypeFrom(plan.name);
      const existing = existingByPlanId.get(plan.id);

      let providerAmount: number;
      let sellingAmount: number;
      let isActive: boolean;
      let pricingId: string | undefined;
      let resolvedPlanType: string | undefined;

      if (existing) {
        providerAmount = koboToNaira(providerCostKobo);
        sellingAmount = existing.sellingPriceKobo
          ? koboToNaira(existing.sellingPriceKobo)
          : defaultSellingPrice(providerAmount);
        isActive = existing.isActive;
        pricingId = existing.id;
        resolvedPlanType = existing.planType ?? planType;

        // Only queue a write if something Alrahuz-reported actually changed
        // (cost, name, validity) - avoids rewriting every row on every
        // cache refresh when nothing moved.
        const changed =
          existing.providerCostKobo !== providerCostKobo ||
          existing.name !== plan.name ||
          existing.validity !== plan.validity;
        if (changed) {
          toUpdate.push({ id: existing.id, plan, providerCostKobo, planType });
        }
      } else {
        providerAmount = koboToNaira(providerCostKobo);
        sellingAmount = defaultSellingPrice(providerAmount);
        isActive = true; // schema default - new plans are active until an admin disables them
        resolvedPlanType = planType;
        toCreate.push({ plan, providerCostKobo, planType });
      }

      priced.push({
        ...plan,
        amount: sellingAmount,
        providerAmount,
        sellingAmount,
        profit: sellingAmount - providerAmount,
        isActive,
        pricingId,
        planType: resolvedPlanType
      } satisfies PricedDataPlan);
    }

    if (toCreate.length > 0 || toUpdate.length > 0) {
      // Fire-and-forget: the priced list above already has everything the
      // caller needs, so persistence doesn't have to finish before we return.
      void this.persistPricingUpdates(network, toCreate, toUpdate);
    }

    return priced.filter((plan) => plan.isActive);
  }

  /**
   * Writes new/changed plan rows in the background, after applyPricing()
   * has already returned its answer. Still sequential (same connection_limit=1
   * constraint as before), but that no longer matters for response latency
   * since nothing is waiting on it - it just needs to finish eventually.
   */
  private async persistPricingUpdates(
    network: string,
    toCreate: { plan: DataPlan; providerCostKobo: bigint; planType: string | undefined }[],
    toUpdate: { id: string; plan: DataPlan; providerCostKobo: bigint; planType: string | undefined }[]
  ) {
    try {
      for (const { plan, providerCostKobo, planType } of toCreate) {
        await prisma.dataPlanPricing.create({
          data: {
            provider: 'alrahuz',
            providerPlanId: plan.id,
            network,
            networkId: plan.networkId,
            planType,
            name: plan.name,
            validity: plan.validity,
            providerCostKobo
          }
        });
      }
      for (const { id, plan, providerCostKobo, planType } of toUpdate) {
        await prisma.dataPlanPricing.update({
          where: { id },
          data: {
            network,
            networkId: plan.networkId,
            planType,
            name: plan.name,
            validity: plan.validity,
            providerCostKobo,
            lastSeenAt: new Date()
          }
        });
      }
    } catch (err) {
      console.error(`[pricing] background persist failed for ${network}:`, err);
    }
  }

  async getPricingRows(network?: string) {
    const rows = await prisma.dataPlanPricing.findMany({
      where: network ? { network: network.toUpperCase() } : undefined,
      orderBy: [{ networkId: 'asc' }, { planType: 'asc' }, { providerCostKobo: 'asc' }]
    });

    return rows.map((row) => {
      const providerCost = koboToNaira(row.providerCostKobo);
      const sellingPrice = row.sellingPriceKobo
        ? koboToNaira(row.sellingPriceKobo)
        : defaultSellingPrice(providerCost);
      return {
        id: row.id,
        provider_plan_id: row.providerPlanId,
        network: row.network,
        network_id: row.networkId,
        plan_type: row.planType,
        name: row.name,
        validity: row.validity,
        provider_cost: providerCost,
        selling_price: sellingPrice,
        profit: sellingPrice - providerCost,
        is_active: row.isActive,
        last_seen_at: row.lastSeenAt.toISOString(),
        updated_at: row.updatedAt.toISOString()
      };
    });
  }

  async updatePricing(
    id: string,
    params: { sellingPrice?: number | null; isActive?: boolean }
  ) {
    const row = await prisma.dataPlanPricing.update({
      where: { id },
      data: {
        ...(params.sellingPrice === null
          ? { sellingPriceKobo: null }
          : params.sellingPrice !== undefined
            ? { sellingPriceKobo: nairaToKobo(params.sellingPrice) }
            : {}),
        ...(params.isActive !== undefined ? { isActive: params.isActive } : {})
      }
    });

    const providerCost = koboToNaira(row.providerCostKobo);
    const sellingPrice = row.sellingPriceKobo
      ? koboToNaira(row.sellingPriceKobo)
      : defaultSellingPrice(providerCost);

    return {
      id: row.id,
      provider_plan_id: row.providerPlanId,
      network: row.network,
      name: row.name,
      provider_cost: providerCost,
      selling_price: sellingPrice,
      profit: sellingPrice - providerCost,
      is_active: row.isActive
    };
  }

  async applyMarkup(params: { network?: string; markupNaira: number; markupPercent: number }) {
    const rows = await prisma.dataPlanPricing.findMany({
      where: params.network ? { network: params.network.toUpperCase() } : undefined
    });

    // Sequential for the same reason as applyPricing() above: connection_limit=1
    // in DATABASE_URL means concurrent updates exhaust the pool and time out.
    for (const row of rows) {
      const providerCost = koboToNaira(row.providerCostKobo);
      const sellingPrice = Math.ceil(
        providerCost + (providerCost * params.markupPercent) / 100 + params.markupNaira
      );
      await prisma.dataPlanPricing.update({
        where: { id: row.id },
        data: { sellingPriceKobo: nairaToKobo(sellingPrice) }
      });
    }

    return { updated: rows.length };
  }
}

export const dataPlanPricingService = new DataPlanPricingService();
