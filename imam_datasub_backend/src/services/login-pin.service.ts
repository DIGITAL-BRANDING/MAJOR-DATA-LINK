import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma.js';
import { ApiError } from '../middleware/error.js';

const MAX_FAILURES = 5;
const LOCKOUT_MINUTES = 30;

/** Sets (or overwrites) the user's 6-digit login PIN and clears any lockout. */
export async function setLoginPin(userId: string, pin: string) {
  if (!/^\d{6}$/.test(pin)) {
    throw new ApiError(422, 'Login PIN must be 6 digits', 'INVALID_LOGIN_PIN');
  }
  const loginPinHash = await bcrypt.hash(pin, 12);
  await prisma.user.update({
    where: { id: userId },
    data: { loginPinHash, loginPinFailures: 0, loginPinLockedUntil: null }
  });
}

/**
 * Verifies a login PIN, tracking failures and locking out after
 * MAX_FAILURES - mirrors the transaction PIN's verifyPin() lockout behavior
 * in wallet.service.ts, kept separate since these are different secrets
 * with different lockout counters.
 */
export async function verifyLoginPin(userId: string, pin: string) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });

  if (user.loginPinLockedUntil && user.loginPinLockedUntil > new Date()) {
    throw new ApiError(423, 'Login PIN is temporarily locked', 'LOGIN_PIN_LOCKED');
  }
  if (!user.loginPinHash) {
    throw new ApiError(400, 'Login PIN has not been set', 'LOGIN_PIN_NOT_SET');
  }

  const ok = await bcrypt.compare(pin, user.loginPinHash);
  if (!ok) {
    const failures = user.loginPinFailures + 1;
    await prisma.user.update({
      where: { id: userId },
      data: {
        loginPinFailures: failures,
        loginPinLockedUntil:
          failures >= MAX_FAILURES ? new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000) : null
      }
    });
    throw new ApiError(401, 'Invalid login PIN', 'INVALID_LOGIN_PIN');
  }

  await prisma.user.update({
    where: { id: userId },
    data: { loginPinFailures: 0, loginPinLockedUntil: null }
  });
  return true;
}
