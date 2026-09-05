import { createHash, randomBytes } from 'node:crypto';
import { getModelByName } from '@adminjs/prisma';
import type { ResourceWithOptions } from 'adminjs';
import { prisma } from '../../lib/prisma.js';
import { logAdminAction } from '../audit.js';
import type { AdminSessionUser } from '../auth.js';

const canManagePartners = ({ currentAdmin }: { currentAdmin?: Record<string, unknown> }) => {
  const admin = currentAdmin as unknown as AdminSessionUser | undefined;
  return admin?.role === 'SUPER_ADMIN' || admin?.role === 'FINANCE';
};

function createApiKey() {
  const plaintext = `mdl_live_${randomBytes(32).toString('hex')}`;
  return {
    plaintext,
    keyPrefix: plaintext.slice(0, 16),
    secretHash: createHash('sha256').update(plaintext, 'utf8').digest('hex')
  };
}

/**
 * Deliberately separate from UserResource. API integrators are businesses with
 * their own prepaid wallet and keys, never ordinary app users.
 */
export const partnerResource: ResourceWithOptions = {
  resource: { model: getModelByName('Partner'), client: prisma },
  options: {
    id: 'Partner',
    navigation: { name: 'API Integrators', icon: 'Code' },
    listProperties: ['businessName', 'email', 'phone', 'walletBalanceKobo', 'status', 'createdAt'],
    showProperties: ['id', 'businessName', 'email', 'phone', 'walletBalanceKobo', 'status', 'virtualAccountNumber', 'virtualAccountBank', 'virtualAccountProvider', 'webhookUrl', 'createdAt', 'updatedAt'],
    editProperties: ['businessName', 'email', 'phone', 'status', 'webhookUrl'],
    filterProperties: ['businessName', 'email', 'phone', 'status', 'createdAt'],
    properties: {
      walletBalanceKobo: {
        isVisible: { list: true, show: true, edit: false, filter: false },
        description: 'Partner prepaid wallet in kobo. Fund/adjust through finance controls only; it is separate from Customer wallets.'
      },
      apiKeys: { isVisible: false },
      transactions: { isVisible: false },
      paystackCustomerCode: { isVisible: false },
      webhookSecretEncrypted: { isVisible: false },
      webhookSecretHash: { isVisible: false },
      webhookDeliveries: { isVisible: false }
    },
    actions: {
      list: { isAccessible: canManagePartners },
      show: { isAccessible: canManagePartners },
      new: { isAccessible: canManagePartners },
      edit: { isAccessible: canManagePartners },
      delete: { isAccessible: false },
      createApiKey: {
        actionType: 'record', icon: 'Key', component: false,
        guard: 'This generates a new live API key. The key will be shown once only. Continue?',
        isAccessible: canManagePartners,
        handler: async (_request, _response, context) => {
          const record = context.record;
          const admin = context.currentAdmin as unknown as AdminSessionUser | undefined;
          if (!record || !admin) throw new Error('Missing partner or admin context');
          const key = createApiKey();
          await prisma.partnerApiKey.create({ data: { partnerId: record.params.id as string, name: 'Live key', keyPrefix: key.keyPrefix, secretHash: key.secretHash } });
          await logAdminAction({ adminId: admin.id, action: 'CREATE_PARTNER_API_KEY', targetType: 'Partner', targetId: record.params.id as string });
          return { record: record.toJSON(context.currentAdmin), notice: { type: 'success', message: `Live API key (show once): ${key.plaintext}` } };
        }
      },
      suspendOrActivate: {
        actionType: 'record', icon: 'PauseCircle', component: false,
        isAccessible: canManagePartners,
        handler: async (_request, _response, context) => {
          const record = context.record;
          const admin = context.currentAdmin as unknown as AdminSessionUser | undefined;
          if (!record || !admin) throw new Error('Missing partner or admin context');
          const partner = await prisma.partner.findUniqueOrThrow({ where: { id: record.params.id as string } });
          const status = partner.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
          await prisma.partner.update({ where: { id: partner.id }, data: { status } });
          await logAdminAction({ adminId: admin.id, action: `${status}_PARTNER`, targetType: 'Partner', targetId: partner.id });
          return { record: record.toJSON(context.currentAdmin), notice: { type: 'success', message: `Partner is now ${status.toLowerCase()}.` } };
        }
      }
    }
  }
};

export const partnerApiKeyResource: ResourceWithOptions = {
  resource: { model: getModelByName('PartnerApiKey'), client: prisma },
  options: {
    id: 'PartnerApiKey', navigation: { name: 'API Integrators', icon: 'Key' },
    // `partnerId` is the scalar FK backing the relation. AdminJS Prisma hides
    // such read-only scalar FKs; use the relation property instead.
    listProperties: ['partner', 'name', 'keyPrefix', 'lastUsedAt', 'revokedAt', 'createdAt'],
    showProperties: ['id', 'partner', 'name', 'keyPrefix', 'lastUsedAt', 'revokedAt', 'createdAt'],
    filterProperties: ['partner', 'keyPrefix', 'revokedAt', 'createdAt'],
    properties: { secretHash: { isVisible: false } },
    actions: {
      new: { isAccessible: false }, edit: { isAccessible: false }, delete: { isAccessible: false },
      list: { isAccessible: canManagePartners }, show: { isAccessible: canManagePartners },
      revoke: {
        actionType: 'record', icon: 'Lock', component: false, guard: 'Revoke this key? It will stop working immediately.', isAccessible: canManagePartners,
        handler: async (_request, _response, context) => {
          const record = context.record;
          const admin = context.currentAdmin as unknown as AdminSessionUser | undefined;
          if (!record || !admin) throw new Error('Missing API key or admin context');
          await prisma.partnerApiKey.update({ where: { id: record.params.id as string }, data: { revokedAt: new Date() } });
          await logAdminAction({ adminId: admin.id, action: 'REVOKE_PARTNER_API_KEY', targetType: 'PartnerApiKey', targetId: record.params.id as string });
          return { record: record.toJSON(context.currentAdmin), notice: { type: 'success', message: 'API key revoked.' } };
        }
      }
    }
  }
};

export const partnerTransactionResource: ResourceWithOptions = {
  resource: { model: getModelByName('PartnerTransaction'), client: prisma },
  options: {
    id: 'PartnerTransaction', navigation: { name: 'API Integrators', icon: 'Activity' },
    listProperties: ['partner', 'reference', 'type', 'status', 'amountKobo', 'createdAt'],
    showProperties: ['id', 'partner', 'reference', 'type', 'status', 'amountKobo', 'balanceBeforeKobo', 'balanceAfterKobo', 'provider', 'providerRef', 'description', 'createdAt', 'updatedAt'],
    filterProperties: ['partner', 'reference', 'type', 'status', 'provider', 'createdAt'],
    properties: { idempotencyKey: { isVisible: false }, metadata: { isVisible: false } },
    actions: { new: { isAccessible: false }, edit: { isAccessible: false }, delete: { isAccessible: false }, list: { isAccessible: canManagePartners }, show: { isAccessible: canManagePartners } }
  }
};

/** Delivery history is operational evidence: it never exposes payloads or signing secrets. */
export const partnerWebhookDeliveryResource: ResourceWithOptions = {
  resource: { model: getModelByName('PartnerWebhookDelivery'), client: prisma },
  options: {
    id: 'PartnerWebhookDelivery', navigation: { name: 'API Integrators', icon: 'Send' },
    listProperties: ['partner', 'event', 'status', 'attemptCount', 'lastResponseStatus', 'createdAt'],
    showProperties: ['id', 'partner', 'eventId', 'event', 'status', 'attemptCount', 'nextAttemptAt', 'deliveredAt', 'lastAttemptAt', 'lastResponseStatus', 'lastError', 'createdAt'],
    filterProperties: ['partner', 'event', 'status', 'createdAt'],
    properties: { payload: { isVisible: false }, signingSecret: { isVisible: false }, eventKey: { isVisible: false }, lockedAt: { isVisible: false } },
    actions: { new: { isAccessible: false }, edit: { isAccessible: false }, delete: { isAccessible: false }, list: { isAccessible: canManagePartners }, show: { isAccessible: canManagePartners } }
  }
};
