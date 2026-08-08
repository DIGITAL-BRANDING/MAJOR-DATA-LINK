import { prisma } from './prisma.js';
import { koboToNaira } from './money.js';

/**
 * The one place a User row gets turned into what the client sees. Every
 * route that returns a user object (/auth/login, /auth/register, /auth/me,
 * /user/profile, etc.) must call this - do not inline a copy of this object
 * anywhere else. A previous duplicate in /user/profile silently drifted out
 * of sync with this one and was missing is_admin/admin_role entirely, which
 * meant the app showed admin users as regular users almost immediately
 * after login (the moment anything re-fetched /user/profile).
 */
export async function publicUser(user: Awaited<ReturnType<typeof prisma.user.findUniqueOrThrow>>) {
  const admin = await prisma.adminUser.findFirst({
    where: {
      email: { equals: user.email, mode: 'insensitive' },
      isActive: true
    },
    select: { role: true }
  });

  return {
    id: user.id,
    full_name: user.fullName,
    email: user.email,
    phone: user.phone,
    photo_url: user.photoUrl,
    wallet_balance: koboToNaira(user.walletBalanceKobo),
    referral_code: user.referralCode,
    referral_earnings: koboToNaira(user.referralEarningsKobo),
    kyc_status: user.kycStatus.toLowerCase(),
    email_verified: user.emailVerified,
    phone_verified: user.phoneVerified,
    virtual_account_number: user.virtualAccountNumber,
    virtual_account_bank: user.virtualAccountBank,
    is_admin: !!admin,
    admin_role: admin?.role ?? null,
    created_at: user.createdAt.toISOString()
  };
}
