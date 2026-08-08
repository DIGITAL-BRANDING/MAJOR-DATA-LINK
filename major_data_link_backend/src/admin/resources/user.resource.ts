import { getModelByName } from '@adminjs/prisma';
import type { ResourceWithOptions } from 'adminjs';
import { prisma } from '../../lib/prisma.js';
import { notifyUser } from '../../services/notification.service.js';
import type { AdminSessionUser } from '../auth.js';

export const userResource: ResourceWithOptions = {
  resource: { model: getModelByName('User'), client: prisma },
  options: {
    id: 'User',
    navigation: { name: 'Customers', icon: 'Users' },
    listProperties: ['fullName', 'email', 'phone', 'walletBalanceKobo', 'kycStatus', 'createdAt'],
    showProperties: [
      'id',
      'fullName',
      'email',
      'phone',
      'walletBalanceKobo',
      'referralCode',
      'referralEarningsKobo',
      'kycStatus',
      'emailVerified',
      'phoneVerified',
      'virtualAccountNumber',
      'virtualAccountBank',
      'createdAt',
      'updatedAt'
    ],
    editProperties: ['kycStatus', 'phoneVerified', 'emailVerified'],
    filterProperties: ['fullName', 'email', 'phone', 'kycStatus', 'createdAt'],
    properties: {
      pinHash: { isVisible: false },
      pinFailures: { isVisible: { list: false, show: true, edit: false, filter: false } },
      pinLockedUntil: { isVisible: { list: false, show: true, edit: false, filter: false } },
      walletBalanceKobo: { isVisible: { list: true, show: true, edit: false, filter: false } },
      referralEarningsKobo: { isVisible: { list: false, show: true, edit: false, filter: false } }
    },
    actions: {
      // Users are created by the app via Firebase sign-in, never directly by an admin.
      new: { isAccessible: false },
      // A user has related transactions - deleting would break the ledger. Deactivate
      // via kycStatus/support workflow instead of allowing hard deletes here.
      delete: { isAccessible: false },
      edit: {
        isAccessible: ({ currentAdmin }) =>
          !!currentAdmin && (currentAdmin as unknown as AdminSessionUser).role !== 'SUPPORT',
        after: async (response: any, _request: any, context: any) => {
          // Only the ONE user whose record was just edited gets notified - this is a
          // targeted per-user alert, not a broadcast, regardless of how many other
          // users an admin edits over the course of a day.
          const previousStatus = context?.record?.params?.kycStatus;
          const updatedStatus = response?.record?.params?.kycStatus;
          const userId = response?.record?.params?.id as string | undefined;

          if (userId && updatedStatus && previousStatus !== updatedStatus && !response?.record?.errors) {
            if (updatedStatus === 'VERIFIED') {
              await notifyUser({
                userId,
                type: 'KYC',
                title: 'Verification successful',
                body: 'Your account has been verified by our team.'
              });
            } else if (updatedStatus === 'REJECTED') {
              await notifyUser({
                userId,
                type: 'KYC',
                title: 'Verification update',
                body: 'There was an issue verifying your account. Please contact support for details.'
              });
            }
          }
          return response;
        }

      }
    }
  }
};
