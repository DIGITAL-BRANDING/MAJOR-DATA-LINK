import { getModelByName } from '@adminjs/prisma';
import type { ResourceWithOptions } from 'adminjs';
import { prisma } from '../../lib/prisma.js';
import type { AdminSessionUser } from '../auth.js';

const canManagePricing = ({ currentAdmin }: { currentAdmin?: Record<string, unknown> }) => {
  const admin = currentAdmin as unknown as AdminSessionUser | undefined;
  return admin?.role === 'SUPER_ADMIN' || admin?.role === 'FINANCE';
};

/**
 * providerCostKobo/sellingPriceKobo/partnerSellingPriceKobo are BigInt
 * columns, so @adminjs/prisma can hand them to these hooks as a bigint, a
 * plain number, or a numeric string depending on where the value came from
 * (a fresh DB read vs. an already-serialized response) - this deliberately
 * accepts all three rather than assuming one.
 */
function koboToNairaDisplay(value: unknown): string {
  if (value === null || value === undefined || value === '') return '';
  try {
    const kobo = typeof value === 'bigint' ? value : BigInt(Math.round(Number(value)));
    return (Number(kobo) / 100).toFixed(2);
  } catch {
    return '';
  }
}

/** Recomputes the read-only *Naira mirror fields from the current *Kobo values - used after every list/show/edit read so the Naira columns never go stale. */
function mirrorNairaFields(params?: Record<string, unknown>) {
  if (!params) return;
  params.providerCostNaira = koboToNairaDisplay(params.providerCostKobo);
  params.sellingPriceNaira = koboToNairaDisplay(params.sellingPriceKobo);
  params.partnerSellingPriceNaira = koboToNairaDisplay(params.partnerSellingPriceKobo);
}

/**
 * An admin can fill EITHER the Kobo field or the matching Naira field on the
 * edit form - whichever is easier for them in the moment. If the Naira
 * field is filled, it wins and is converted into the real *Kobo column;
 * if it's left blank, whatever is already in the Kobo field applies as
 * before. The virtual *Naira keys are always deleted from the payload
 * before it reaches @adminjs/prisma, since ServicePricing has no such
 * columns and the adapter would otherwise reject the update.
 */
function applyNairaOverrides(payload: Record<string, unknown>) {
  const consume = (nairaKey: string, koboKey: string) => {
    if (!(nairaKey in payload)) return;
    const raw = payload[nairaKey];
    delete payload[nairaKey];
    const trimmed = typeof raw === 'string' ? raw.trim() : raw == null ? '' : String(raw).trim();
    if (trimmed === '') return;
    const naira = Number(trimmed);
    if (Number.isFinite(naira) && naira >= 0) {
      payload[koboKey] = String(Math.round(naira * 100));
    }
  };
  consume('sellingPriceNaira', 'sellingPriceKobo');
  consume('partnerSellingPriceNaira', 'partnerSellingPriceKobo');
}

/**
 * Admin page for the ServicePricing table - covers BOTH Techhub's NIN/BVN
 * verification services and Alrahuz's WAEC/NECO/NABTEB result-pin services
 * (distinguished by the `provider` column). Until this resource existed,
 * there was no AdminJS UI for either: rows were only readable/editable via
 * the raw `GET/PATCH /api/admin/service-prices` API, which is why prices
 * looked "wrong" in the app - nobody had a way to actually set them.
 *
 * Rows are created lazily on first read (see getOrCreateVerificationPricingRow
 * / getOrCreateServicePricingRow in the two services) with a providerCostKobo
 * default and no sellingPriceKobo - so a freshly-deployed environment shows
 * these rows only after each service has been hit at least once (e.g. by
 * loading the app's verification/result-pin price list). `new`/`delete` are
 * disabled here for the same reason as Data Plan Pricing: rows are meant to
 * be provider-synced/lazily-created, not hand-authored.
 */
export const servicePricingResource: ResourceWithOptions = {
  resource: { model: getModelByName('ServicePricing'), client: prisma },
  options: {
    id: 'ServicePricing',
    navigation: { name: 'Products', icon: 'Tag' },
    listProperties: ['provider', 'service', 'label', 'providerCostNaira', 'sellingPriceNaira', 'partnerSellingPriceNaira', 'isActive'],
    showProperties: [
      'id',
      'provider',
      'service',
      'label',
      'providerCostKobo',
      'providerCostNaira',
      'sellingPriceKobo',
      'sellingPriceNaira',
      'partnerSellingPriceKobo',
      'partnerSellingPriceNaira',
      'isActive',
      'lastSyncedAt',
      'createdAt',
      'updatedAt'
    ],
    editProperties: ['sellingPriceKobo', 'sellingPriceNaira', 'partnerSellingPriceKobo', 'partnerSellingPriceNaira', 'isActive'],
    filterProperties: ['provider', 'service', 'isActive'],
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
      bulkPricingTool: {
        actionType: 'resource',
        icon: 'TrendingUp',
        component: false,
        isAccessible: canManagePricing,
        handler: async () => ({ redirectUrl: '/admin/bulk-pricing' }),
        guard: 'Open the Bulk Pricing tool to reprice many services at once?'
      }
    },
    properties: {
      providerCostKobo: {
        isDisabled: true,
        description: 'What the provider (Techhub/Alrahuz) charges us, in kobo. Example: 12000 = NGN 120.'
      },
      providerCostNaira: {
        type: 'string',
        isDisabled: true,
        isVisible: { list: true, filter: false, show: true, edit: false },
        description: 'Same value as Provider Cost (Kobo), shown in Naira for reference only.'
      },
      sellingPriceKobo: {
        description:
          'What we charge a retail web/app user, in kobo (e.g. 15000 = NGN 150). Fill this OR "Selling Price (Naira)" below, not both - if you fill the Naira field, it wins. Leave both empty to sell at zero markup (provider cost).'
      },
      sellingPriceNaira: {
        type: 'string',
        isVisible: { list: true, filter: false, show: true, edit: true },
        description: 'Same price as above, in Naira (e.g. 150). Easier to type than kobo - fill this instead of "Selling Price (Kobo)" if you prefer. Leave empty to use the Kobo field instead.'
      },
      partnerSellingPriceKobo: {
        description:
          'What we charge an API Partner for this same service, in kobo. Fill this OR "Partner Price (Naira)" below, not both. Leave both empty to charge partners the same as the web selling price above.'
      },
      partnerSellingPriceNaira: {
        type: 'string',
        isVisible: { list: true, filter: false, show: true, edit: true },
        description: 'Same partner price as above, in Naira. Fill this instead of "Partner Price (Kobo)" if you prefer. Leave empty to use the Kobo field instead.'
      }
    }
  }
};
