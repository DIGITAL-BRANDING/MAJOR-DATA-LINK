import 'dotenv/config';
import { prisma } from '../lib/prisma.js';

/**
 * Last-resort reset of an admin's two-factor setup, run on the server when no
 * other SUPER_ADMIN can do it from Access Control (e.g. the only super admin
 * lost their phone AND their recovery codes):
 *
 *   npm run admin:reset-2fa -- someone@example.com
 *
 * Wipes the authenticator secret and recovery codes and clears any lockout.
 * The admin sets 2FA up again at their next sign-in.
 */
async function main() {
  const email = (process.argv[2] ?? process.env.RESET_ADMIN_EMAIL ?? '').trim().toLowerCase();
  if (!email.includes('@')) throw new Error('Usage: npm run admin:reset-2fa -- <admin-email>');

  const admin = await prisma.adminUser.findUnique({ where: { email } });
  if (!admin) throw new Error(`No admin found with email ${email}`);

  await prisma.adminRecoveryCode.deleteMany({ where: { adminId: admin.id } });
  await prisma.adminUser.update({
    where: { id: admin.id },
    data: {
      totpSecretEnc: null,
      totpEnabledAt: null,
      totpLastStep: null,
      failedLoginCount: 0,
      failedLoginAt: null,
      lockedUntil: null
    }
  });
  await prisma.adminAuditLog.create({
    data: { adminId: admin.id, action: 'ADMIN_2FA_RESET', targetType: 'AdminUser', targetId: admin.id, metadata: { via: 'cli' } }
  });
  console.log(`Two-factor reset for ${email}. They will be asked to set it up again at next sign-in.`);
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
