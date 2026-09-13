import { getModelByName } from '@adminjs/prisma';
import type { ResourceWithOptions } from 'adminjs';
import { prisma } from '../../lib/prisma.js';
import type { AdminSessionUser } from '../auth.js';

const canManagePricing = ({ currentAdmin }: { currentAdmin?: Record<string, unknown> }) => {
  const admin = currentAdmin as unknown as AdminSessionUser | undefined;
  return admin?.role === 'SUPER_ADMIN' || admin?.role === 'FINANCE';
};

/** Same reasoning as service-pricing.resource.ts's identical helpers - kept in sync with those. */
function koboToNairaDisplay(value: unknown): string {
  if (value === null || value === undefined || value === '') return '';
  try {
    const kobo = typeof value === 'bigint' ? value : BigInt(Math.round(Number(value)));
    return (Number(kobo) / 100).toFixed(2);
  } catch {
    return '';
  }
}

function mirrorNairaFields(params?: Record<string, unknown>) {
  if (!params) return;
  params.providerCostNaira = koboToNairaDisplay(params.providerCostKobo);
  params.sellingPriceNaira = koboToNairaDisplay(params.sellingPriceKobo);
}

function applyNairaOverrides(payload: Record<string, unknown>) {
  if (!('sellingPriceNaira' in payload)) return;
  const raw = payload.sellingPriceNaira;
  delete payload.sellingPriceNaira;
  const trimmed = typeof raw === 'string' ? raw.trim() : raw == null ? '' : String(raw).trim();
  if (trimmed === '') return;
  const naira = Number(trimmed);
  if (Number.isFinite(naira) && naira >= 0) {
    payload.sellingPriceKobo = String(Math.round(naira * 100));
  }
}

export const dataPlanPricingResource: ResourceWithOptions = {
  resource: { model: getModelByName('DataPlanPricing'), client: prisma },
  options: {
    id: 'DataPlanPricing',
    navigation: { name: 'Products', icon: 'ShoppingCart' },
    listProperties: ['network', 'planType', 'name', 'providerCostNaira', 'sellingPriceNaira', 'isActive'],
    showProperties: [
      'id',
      'provider',
      'providerPlanId',
      'network',
      'networkId',
      'planType',
      'name',
      'validity',
      'providerCostKobo',
      'providerCostNaira',
      'sellingPriceKobo',
      'sellingPriceNaira',
      'isActive',
      'lastSeenAt',
      'updatedAt'
    ],
    editProperties: ['sellingPriceKobo', 'sellingPriceNaira', 'isActive'],
    actions: {
      new: { isAccessible: false },
      delete: { isAccessible: false },
      list: {
        isAccessible: canManagePricing,
        after: async (response: any) => {
          for (const record of response.records ?? []) mirrorNairaFields(record?.params);
          return response;
        }
      },
      show: {
        isAccessible: canManagePricing,
        after: async (response: any) => {
          mirrorNairaFields(response.record?.params);
          return response;
        }
      },
      edit: {
        isAccessible: canManagePricing,
        before: async (request: any) => {
          if (request.payload) applyNairaOverrides(request.payload);
          return request;
        },
        after: async (response: any) => {
          mirrorNairaFields(response.record?.params);
          return response;
        }
      },
      // Redirects to the plain server-rendered /admin/bulk-pricing page
      // (src/admin/bulk-pricing.ts) - a resource-level action needs no input
      // form of its own here, it's just a discoverable button in this
      // resource's toolbar pointing at the real tool, so an admin editing
      // one plan's price notices there's a faster way to do 250 of them at
      // once instead of one at a time.
      bulkPricingTool: {
        actionType: 'resource',
        icon: 'TrendingUp',
        component: false,
        isAccessible: canManagePricing,
        handler: async () => ({ redirectUrl: '/admin/bulk-pricing' }),
        guard: 'Open the Bulk Pricing tool to reprice many plans at once?'
      }
    },
    properties: {
      providerCostKobo: {
        isDisabled: true,
        description: 'Provider cost in kobo. Example: 21500 = NGN 215.'
      },
      providerCostNaira: {
        type: 'string',
        isDisabled: true,
        isVisible: { list: true, filter: false, show: true, edit: false, new: false },
        description: 'Same value as Provider Cost (Kobo), shown in Naira for reference only.'
      },
      sellingPriceKobo: {
        description: 'Selling price in kobo. Fill this OR "Selling Price (Naira)" below, not both - if you fill the Naira field, it wins. Leave both empty to use the default markup.'
      },
      sellingPriceNaira: {
        type: 'string',
        isVisible: { list: true, filter: false, show: true, edit: true, new: false },
        description: 'Same price as above, in Naira (e.g. 230). Easier to type than kobo - fill this instead of "Selling Price (Kobo)" if you prefer.'
      }
    }
  }
};
