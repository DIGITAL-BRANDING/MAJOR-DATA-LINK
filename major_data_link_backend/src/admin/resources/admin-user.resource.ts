import { getModelByName } from '@adminjs/prisma';
import type { ResourceWithOptions } from 'adminjs';
import bcrypt from 'bcryptjs';
import { prisma } from '../../lib/prisma.js';
import type { AdminSessionUser } from '../auth.js';
import { logAdminAction } from '../audit.js';

const isSuperAdmin = ({ currentAdmin }: { currentAdmin?: Record<string, unknown> }) => {
  const admin = currentAdmin as unknown as AdminSessionUser | undefined;
  return admin?.role === 'SUPER_ADMIN';
};

export const adminUserResource: ResourceWithOptions = {
  resource: { model: getModelByName('AdminUser'), client: prisma },
  options: {
    id: 'AdminUser',
    navigation: { name: 'Access Control', icon: 'Shield' },
    listProperties: ['email', 'fullName', 'role', 'isActive', 'lastLoginAt'],
    showProperties: ['id', 'email', 'fullName', 'role', 'isActive', 'lastLoginAt', 'failedLoginCount', 'lockedUntil', 'totpEnabledAt', 'createdAt'],
    editProperties: ['email', 'fullName', 'role', 'isActive', 'lockedUntil', 'totpEnabledAt', 'password'],
    properties: {
      passwordHash: { isVisible: false },
      totpSecretEnc: { isVisible: false },
      totpLastStep: { isVisible: false },
      // Virtual field: never stored directly, converted to passwordHash in the
      // beforeSave hook below and stripped from the payload before Prisma sees it.
      password: {
        type: 'password',
        isVisible: { list: false, show: false, edit: true, filter: false }
      }
    },
    actions: {
      list: { isAccessible: isSuperAdmin },
      show: { isAccessible: isSuperAdmin },
      new: {
        isAccessible: isSuperAdmin,
        before: async (request) => {
          if (!request.payload?.password) {
            throw new Error('A password is required when creating a new admin account');
          }
          request.payload.passwordHash = await bcrypt.hash(request.payload.password as string, 12);
          delete request.payload.password;
          return request;
        }
      },
      edit: {
        isAccessible: isSuperAdmin,
        before: async (request, context) => {
          if (request.payload?.password) {
            request.payload.passwordHash = await bcrypt.hash(request.payload.password as string, 12);
          }
          delete request.payload?.password;
          // Clearing "lockedUntil" is how a SUPER_ADMIN unlocks an account
          // before the automatic 15 minutes are up: reset the streak too.
          if (request.payload && 'lockedUntil' in request.payload && !request.payload.lockedUntil) {
            request.payload.failedLoginCount = 0;
            request.payload.failedLoginAt = null;
          }
          // Clearing "totpEnabledAt" RESETS this admin's two-factor setup (lost
          // phone and no recovery codes): the secret and recovery codes are
          // wiped and they re-enrol at their next sign-in.
          if (request.payload && 'totpEnabledAt' in request.payload && !request.payload.totpEnabledAt) {
            request.payload.totpSecretEnc = null;
            request.payload.totpLastStep = null;
            const adminId = request.params?.recordId as string | undefined;
            if (adminId) {
              await prisma.adminRecoveryCode.deleteMany({ where: { adminId } });
              await logAdminAction({
                adminId: (context.currentAdmin as unknown as AdminSessionUser).id,
                action: 'ADMIN_2FA_RESET',
                targetType: 'AdminUser',
                targetId: adminId
              }).catch(() => undefined);
            }
          }
          return request;
        }
      },
      delete: { isAccessible: isSuperAdmin }
    }
  }
};
