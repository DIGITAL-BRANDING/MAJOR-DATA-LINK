import { getModelByName } from '@adminjs/prisma';
import type { ResourceWithOptions } from 'adminjs';
import { prisma } from '../../lib/prisma.js';

/**
 * Read-only view of YOUR balance at Alrahuz — see ProviderBalanceStatus in
 * schema.prisma and recordProviderBalance in provider.service.ts. This is not
 * editable here because it's just a mirror of what Alrahuz itself reports;
 * the only way to actually change it is to fund your Alrahuz account.
 */
export const providerBalanceResource: ResourceWithOptions = {
  resource: { model: getModelByName('ProviderBalanceStatus'), client: prisma },
  options: {
    id: 'ProviderBalanceStatus',
    navigation: { name: 'Wallet', icon: 'AlertTriangle' },
    listProperties: ['provider', 'lastKnownBalance', 'lastCheckedAt', 'lowBalanceAlertSentAt'],
    showProperties: ['provider', 'lastKnownBalance', 'lastCheckedAt', 'lowBalanceAlertSentAt'],
    actions: {
      new: { isAccessible: false },
      edit: { isAccessible: false },
      delete: { isAccessible: false }
    },
    properties: {
      lastKnownBalance: {
        description: 'Your last known balance at Alrahuz — updates automatically after every purchase.'
      }
    }
  }
};
