import { getModelByName } from '@adminjs/prisma';
import type { ResourceWithOptions } from 'adminjs';
import { prisma } from '../../lib/prisma.js';
import { decryptTransactionPII } from '../../services/verification.service.js';
import { refundWallet } from '../../services/wallet.service.js';
import { logAdminAction } from '../audit.js';
import type { AdminSessionUser } from '../auth.js';

export const transactionResource: ResourceWithOptions = {
  resource: { model: getModelByName('Transaction'), client: prisma },
  options: {
    id: 'Transaction',
    navigation: { name: 'Ledger', icon: 'List' },
    listProperties: ['reference', 'type', 'status', 'amountKobo', 'provider', 'user', 'createdAt'],
    showProperties: [
      'id',
      'reference',
      'user',
      'type',
      'status',
      'amountKobo',
      'balanceBeforeKobo',
      'balanceAfterKobo',
      'provider',
      'providerRef',
      'idempotencyKey',
      'description',
      'metadata',
      'createdAt',
      'updatedAt'
    ],
    filterProperties: ['reference', 'user', 'type', 'status', 'createdAt'],
    actions: {
      // The ledger is append-only from the admin panel's perspective — corrections
      // happen via `reverse` (which creates its own audited record), never by editing
      // or deleting history directly.
      new: { isAccessible: false },
      edit: { isAccessible: false },
      delete: { isAccessible: false },
      reverse: {
        actionType: 'record',
        icon: 'RotateCcw',
        guard: "This credits the amount back to the user's wallet and marks the transaction REVERSED. Continue?",
        isAccessible: ({ currentAdmin, record }) => {
          const admin = currentAdmin as unknown as AdminSessionUser | undefined;
          if (!admin || admin.role === 'SUPPORT') return false;
          const status = record?.params?.status;
          return status === 'SUCCESS' || status === 'FAILED';
        },
        handler: async (request, response, context) => {
          const { record, currentAdmin } = context;
          const admin = currentAdmin as unknown as AdminSessionUser | undefined;
          if (!record || !admin) {
            throw new Error('Missing record or admin context');
          }

          try {
            await refundWallet({
              transactionId: record.params.id as string,
              userId: record.params.user as string
            });

            await logAdminAction({
              adminId: admin.id,
              action: 'REVERSE_TRANSACTION',
              targetType: 'Transaction',
              targetId: record.params.id as string,
              metadata: { reference: record.params.reference }
            });

            return {
              record: record.toJSON(currentAdmin),
              notice: { message: 'Transaction reversed and wallet credited.', type: 'success' }
            };
          } catch (error) {
            return {
              record: record.toJSON(currentAdmin),
              notice: {
                message: error instanceof Error ? error.message : 'Reversal failed',
                type: 'error'
              }
            };
          }
        }
      },
      // NIN/BVN/names/phone/generated slip PDFs are encrypted at rest under
      // metadata.pii (see src/lib/pii.ts) precisely so that browsing the
      // Transaction list - or a raw DB dump - never exposes them. This is
      // the one deliberate, narrow door back in: SUPER_ADMIN only, and every
      // single use is written to AdminAuditLog (who, when, which record) via
      // logAdminAction below, same as `reverse` above. It never persists the
      // decrypted value anywhere - it's read fresh from the DB, decrypted in
      // memory, shown once, and gone.
      viewPii: {
        actionType: 'record',
        icon: 'Eye',
        guard:
          'This decrypts and displays the NIN/BVN/name/phone/slip data on this transaction, and is logged to the audit trail. Continue?',
        isAccessible: ({ currentAdmin }) => {
          const admin = currentAdmin as unknown as AdminSessionUser | undefined;
          return admin?.role === 'SUPER_ADMIN';
        },
        handler: async (request, response, context) => {
          const { record, currentAdmin } = context;
          const admin = currentAdmin as unknown as AdminSessionUser | undefined;
          if (!record || !admin) {
            throw new Error('Missing record or admin context');
          }

          const fresh = await prisma.transaction.findUnique({ where: { id: record.params.id as string } });
          const pii = fresh ? decryptTransactionPII(fresh.metadata) : null;

          await logAdminAction({
            adminId: admin.id,
            action: 'VIEW_TRANSACTION_PII',
            targetType: 'Transaction',
            targetId: record.params.id as string,
            metadata: { reference: record.params.reference }
          });

          return {
            record: record.toJSON(currentAdmin),
            notice: pii
              ? { message: `Decrypted: ${JSON.stringify(pii)}`, type: 'success' }
              : { message: 'No PII found on this transaction, or it failed to decrypt.', type: 'error' }
          };
        }
      }
    }
  }
};
