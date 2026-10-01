import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma.js';
import { FAILURE_RESET_MINUTES, isLocked } from '../lib/lockout.js';
import { logAdminAction } from './audit.js';

export type AdminSessionUser = {
  id: string;
  email: string;
  fullName: string;
  role: 'SUPER_ADMIN' | 'FINANCE' | 'SUPPORT';
};

/** Wrong passwords / codes allowed inside one streak before the account locks. */
export const ADMIN_MAX_FAILURES = 5;
export const ADMIN_LOCKOUT_MINUTES = 15;

/** Roles that must use two-factor authentication. Anyone else (SUPPORT) is
 *  required to use it only once they have chosen to turn it on. */
export const MFA_REQUIRED_ROLES: ReadonlyArray<string> = ['SUPER_ADMIN', 'FINANCE'];

export function adminRequiresMfa(role: string, totpEnabledAt: Date | null | undefined): boolean {
  return !!totpEnabledAt || MFA_REQUIRED_ROLES.includes(role);
}

// Compared against when the email does not exist, so "unknown account" and
// "wrong password" take the same time and cannot be told apart by timing.
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 12);

export function lockedError(until: Date) {
  const minutes = Math.max(1, Math.ceil((until.getTime() - Date.now()) / 60_000));
  return new Error(`Too many failed sign-in attempts. Try again in ${minutes} minute${minutes === 1 ? '' : 's'}.`);
}

async function lockAdmin(adminId: string, ip?: string) {
  const until = new Date(Date.now() + ADMIN_LOCKOUT_MINUTES * 60_000);
  const res = await prisma.adminUser.updateMany({
    where: { id: adminId, OR: [{ lockedUntil: null }, { lockedUntil: { lte: new Date() } }] },
    data: { lockedUntil: until }
  });
  if (res.count > 0) {
    console.warn('[admin-auth] account locked after repeated failures', { adminId, ip });
    await logAdminAction({
      adminId,
      action: 'ADMIN_LOGIN_LOCKED',
      targetType: 'AdminUser',
      targetId: adminId,
      metadata: { ip: ip ?? null, minutes: ADMIN_LOCKOUT_MINUTES }
    }).catch(() => undefined);
  }
  return until;
}

/**
 * RESERVE an attempt (password or second factor) before checking it.
 *
 * The counter is incremented atomically in the database BEFORE the secret is
 * verified and cleared again on success. A read-then-write counter would let
 * an attacker fire many guesses in parallel: each request reads "0 failures",
 * all of them get a free check, and the lock never trips. Reserving first
 * means at most ADMIN_MAX_FAILURES guesses per streak are ever checked, no
 * matter how many requests arrive at once.
 */
export async function reserveAdminAttempt(
  adminId: string,
  ip?: string
): Promise<{ locked: false; count: number } | { locked: true; until: Date }> {
  const admin = await prisma.adminUser.findUnique({ where: { id: adminId } });
  if (!admin) return { locked: true, until: new Date(Date.now() + ADMIN_LOCKOUT_MINUTES * 60_000) };
  if (isLocked(admin.lockedUntil)) return { locked: true, until: admin.lockedUntil as Date };

  // A lock that has expired starts the account over with a clean slate.
  if (admin.lockedUntil) {
    await prisma.adminUser.updateMany({
      where: { id: adminId, lockedUntil: { lte: new Date() } },
      data: { failedLoginCount: 0, failedLoginAt: null, lockedUntil: null }
    });
  }
  // An old streak (no failure for FAILURE_RESET_MINUTES) stops counting.
  await prisma.adminUser.updateMany({
    where: { id: adminId, failedLoginAt: { lt: new Date(Date.now() - FAILURE_RESET_MINUTES * 60_000) } },
    data: { failedLoginCount: 0 }
  });

  const reserved = await prisma.adminUser.update({
    where: { id: adminId },
    data: { failedLoginCount: { increment: 1 }, failedLoginAt: new Date() }
  });
  if (reserved.failedLoginCount > ADMIN_MAX_FAILURES) return { locked: true, until: await lockAdmin(adminId, ip) };
  return { locked: false, count: reserved.failedLoginCount };
}

/** Call after a reserved attempt turned out to be WRONG. */
export async function noteAdminFailure(adminId: string, count: number, ip?: string) {
  if (count >= ADMIN_MAX_FAILURES) await lockAdmin(adminId, ip);
  console.warn('[admin-auth] failed verification', { adminId, ip, attempt: count });
}

/** Call once the person has fully signed in (every required factor passed). */
export async function completeAdminSignIn(adminId: string) {
  await prisma.adminUser.update({
    where: { id: adminId },
    data: { lastLoginAt: new Date(), failedLoginCount: 0, failedLoginAt: null, lockedUntil: null }
  });
}

/**
 * Step 1 of admin sign-in (email + password) with per-account lockout.
 * For roles / accounts that need two-factor authentication this only proves
 * the password: the session is not usable until the second step in mfa.ts
 * succeeds (enforced by the gate there), so the failure counter is NOT reset
 * here - otherwise a password holder could get a fresh batch of code guesses
 * on every login.
 */
export async function authenticateAdmin(
  email: string,
  password: string,
  meta: { ip?: string } = {}
): Promise<AdminSessionUser | null> {
  const admin = await prisma.adminUser.findUnique({
    where: { email: String(email ?? '').toLowerCase().trim() }
  });
  if (!admin || !admin.isActive) {
    await bcrypt.compare(String(password ?? ''), DUMMY_HASH);
    return null;
  }

  const attempt = await reserveAdminAttempt(admin.id, meta.ip);
  if (attempt.locked) throw lockedError(attempt.until);

  const valid = await bcrypt.compare(String(password ?? ''), admin.passwordHash);
  if (!valid) {
    await noteAdminFailure(admin.id, attempt.count, meta.ip);
    return null;
  }

  if (!adminRequiresMfa(admin.role, admin.totpEnabledAt)) await completeAdminSignIn(admin.id);

  return {
    id: admin.id,
    email: admin.email,
    fullName: admin.fullName,
    role: admin.role as AdminSessionUser['role']
  };
}
