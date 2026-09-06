import { randomBytes } from 'node:crypto';
import { getModelByName } from '@adminjs/prisma';
import type { ResourceWithOptions } from 'adminjs';
import bcrypt from 'bcryptjs';
import { prisma } from '../../lib/prisma.js';
import { logAdminAction } from '../audit.js';
import type { AdminSessionUser } from '../auth.js';
import { createPartnerApiKey } from '../../lib/partner-api-key.js';

const canManagePartners = ({ currentAdmin }: { currentAdmin?: Record<string, unknown> }) => {
  const admin = currentAdmin as unknown as AdminSessionUser | undefined;
  return admin?.role === 'SUPER_ADMIN' || admin?.role === 'FINANCE';
};

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
      webhookDeliveries: { isVisible: false },
      passwordHash: { isVisible: false },
      passwordFailures: { isVisible: false },
      passwordFailureAt: { isVisible: false },
      passwordLockedUntil: { isVisible: false }
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
          const key = createPartnerApiKey();
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
          if (partner.status === 'PENDING_REVIEW') {
            return {
              record: record.toJSON(context.currentAdmin),
              notice: { type: 'error', message: 'This partner is still pending review - use "Approve Partner" first.' }
            };
          }
          const status = partner.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
          await prisma.partner.update({ where: { id: partner.id }, data: { status } });
          await logAdminAction({ adminId: admin.id, action: `${status}_PARTNER`, targetType: 'Partner', targetId: partner.id });
          return { record: record.toJSON(context.currentAdmin), notice: { type: 'success', message: `Partner is now ${status.toLowerCase()}.` } };
        }
      },
      approvePartner: {
        actionType: 'record', icon: 'CheckCircle', component: false,
        guard: "This approves the partner's self-registration, moving them from Pending Review to Active. They'll then be able to generate live API keys from their own portal login. Continue?",
        isAccessible: canManagePartners,
        handler: async (_request, _response, context) => {
          const record = context.record;
          const admin = context.currentAdmin as unknown as AdminSessionUser | undefined;
          if (!record || !admin) throw new Error('Missing partner or admin context');
          const partner = await prisma.partner.findUniqueOrThrow({ where: { id: record.params.id as string } });
          if (partner.status !== 'PENDING_REVIEW') {
            return {
              record: record.toJSON(context.currentAdmin),
              notice: { type: 'error', message: 'Only a partner still pending review can be approved.' }
            };
          }
          await prisma.partner.update({ where: { id: partner.id }, data: { status: 'ACTIVE' } });
          await logAdminAction({ adminId: admin.id, action: 'APPROVE_PARTNER', targetType: 'Partner', targetId: partner.id });
          return { record: record.toJSON(context.currentAdmin), notice: { type: 'success', message: 'Partner approved and active. They can now generate live API keys from their portal login.' } };
        }
      },
      resetPortalPassword: {
        actionType: 'record', icon: 'Key', component: false,
        guard:
          "This sets a new random portal login password for this partner, replacing any password they've set " +
          'themselves. Use only when a partner has lost access and asked for a reset out of band. Continue?',
        isAccessible: canManagePartners,
        handler: async (_request, _response, context) => {
          const record = context.record;
          const admin = context.currentAdmin as unknown as AdminSessionUser | undefined;
          if (!record || !admin) throw new Error('Missing partner or admin context');
          const partner = await prisma.partner.findUniqueOrThrow({ where: { id: record.params.id as string } });
          const newPassword = randomBytes(9).toString('base64url');
          const passwordHash = await bcrypt.hash(newPassword, 12);
          await prisma.partner.update({
            where: { id: partner.id },
            data: { passwordHash, passwordFailures: 0, passwordFailureAt: null, passwordLockedUntil: null }
          });
          await logAdminAction({ adminId: admin.id, action: 'RESET_PARTNER_PORTAL_PASSWORD', targetType: 'Partner', targetId: partner.id });
          return {
            record: record.toJSON(context.currentAdmin),
            notice: { type: 'success', message: `New portal password (show once, hand off to partner): ${newPassword}` }
          };
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
