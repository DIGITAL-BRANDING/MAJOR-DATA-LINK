import { getModelByName } from '@adminjs/prisma';
import type { ResourceWithOptions } from 'adminjs';
import { prisma } from '../../lib/prisma.js';
import type { AdminSessionUser } from '../auth.js';

const canManagePricing = ({ currentAdmin }: { currentAdmin?: Record<string, unknown> }) => {
  const admin = currentAdmin as unknown as AdminSessionUser | undefined;
  return admin?.role === 'SUPER_ADMIN' || admin?.role === 'FINANCE';
};

export const dataPlanPricingResource: ResourceWithOptions = {
  resource: { model: getModelByName('DataPlanPricing'), client: prisma },
  options: {
    id: 'DataPlanPricing',
    navigation: { name: 'Products', icon: 'ShoppingCart' },
    listProperties: ['network', 'planType', 'name', 'providerCostKobo', 'sellingPriceKobo', 'isActive'],
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
      'sellingPriceKobo',
      'isActive',
      'lastSeenAt',
      'updatedAt'
    ],
    editProperties: ['sellingPriceKobo', 'isActive'],
    actions: {
      new: { isAccessible: false },
      delete: { isAccessible: false },
      edit: { isAccessible: canManagePricing }
    },
    properties: {
      providerCostKobo: {
        isDisabled: true,
        description: 'Provider cost in kobo. Example: 21500 = NGN 215.'
      },
      sellingPriceKobo: {
        description: 'Selling price in kobo. Example: 23000 = NGN 230. Leave empty to use default markup.'
      }
    }
  }
};
