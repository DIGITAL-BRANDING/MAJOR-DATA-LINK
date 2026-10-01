import bcrypt from 'bcryptjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Admin sign-in lockout. Uses a tiny in-memory stand-in for prisma.adminUser
 * (just the operators auth.ts uses) and the real bcrypt, so the counting
 * logic - including the parallel-guess case - is what is actually tested.
 */
type Row = {
  id: string; email: string; passwordHash: string; fullName: string; role: string; isActive: boolean;
  lastLoginAt: Date | null; failedLoginCount: number; failedLoginAt: Date | null; lockedUntil: Date | null;
};
const rows = new Map<string, Row>();

function matches(row: Row, where: Record<string, any>): boolean {
  return Object.entries(where).every(([k, v]) => {
    if (k === 'OR') return (v as Record<string, any>[]).some((w) => matches(row, w));
    const val = (row as any)[k];
    if (v === null) return val === null;
    if (v && typeof v === 'object' && !(v instanceof Date)) {
      if ('lt' in v) return val !== null && val < v.lt;
      if ('lte' in v) return val !== null && val <= v.lte;
    }
    return val === v;
  });
}
function apply(row: Row, data: Record<string, any>) {
  for (const [k, v] of Object.entries(data)) {
    if (v && typeof v === 'object' && 'increment' in v) (row as any)[k] += v.increment;
    else (row as any)[k] = v;
  }
}

vi.mock('../../lib/prisma.js', () => ({
  prisma: {
    adminUser: {
      findUnique: async ({ where }: any) => {
        const r = [...rows.values()].find((x) => x.email === where.email || x.id === where.id);
        return r ? { ...r } : null;
      },
      update: async ({ where, data }: any) => {
        const r = rows.get(where.id)!;
        apply(r, data);
        return { ...r };
      },
      updateMany: async ({ where, data }: any) => {
        let count = 0;
        for (const r of rows.values()) if (matches(r, where)) { apply(r, data); count++; }
        return { count };
      }
    },
    adminAuditLog: { create: vi.fn().mockResolvedValue({}) }
  }
}));
vi.mock('../audit.js', () => ({ logAdminAction: vi.fn().mockResolvedValue(undefined) }));

const { authenticateAdmin, ADMIN_MAX_FAILURES } = await import('../auth.js');
const hash = bcrypt.hashSync('correct-horse', 4);

function seed() {
  rows.clear();
  rows.set('a1', { id: 'a1', email: 'boss@ktech.test', passwordHash: hash, fullName: 'Boss', role: 'SUPPORT',
    isActive: true, lastLoginAt: null, failedLoginCount: 0, failedLoginAt: null, lockedUntil: null });
}

describe('authenticateAdmin lockout', () => {
  beforeEach(seed);

  it('signs in with the right password and clears the failure streak', async () => {
    await authenticateAdmin('boss@ktech.test', 'wrong');
    await authenticateAdmin('boss@ktech.test', 'wrong');
    const ok = await authenticateAdmin('boss@ktech.test', 'correct-horse');
    expect(ok?.id).toBe('a1');
    expect(rows.get('a1')!.failedLoginCount).toBe(0);
  });

  it('locks after the maximum wrong passwords, even for the correct password afterwards', async () => {
    for (let i = 0; i < ADMIN_MAX_FAILURES; i++) {
      expect(await authenticateAdmin('boss@ktech.test', 'guess' + i)).toBeNull();
    }
    expect(rows.get('a1')!.lockedUntil).not.toBeNull();
    await expect(authenticateAdmin('boss@ktech.test', 'correct-horse')).rejects.toThrow(/Too many failed/);
  });

  it('parallel guesses cannot bypass the limit: at most MAX passwords are ever checked', async () => {
    const spy = vi.spyOn(bcrypt, 'compare');
    const results = await Promise.allSettled(
      Array.from({ length: 40 }, (_, i) => authenticateAdmin('boss@ktech.test', 'guess' + i))
    );
    const checked = spy.mock.calls.length;
    expect(checked).toBeLessThanOrEqual(ADMIN_MAX_FAILURES);
    expect(rows.get('a1')!.lockedUntil).not.toBeNull();
    expect(results.some((r) => r.status === 'fulfilled' && r.value !== null)).toBe(false);
    spy.mockRestore();
  });

  it('unlocks on its own once the lock has expired', async () => {
    for (let i = 0; i < ADMIN_MAX_FAILURES; i++) await authenticateAdmin('boss@ktech.test', 'x');
    rows.get('a1')!.lockedUntil = new Date(Date.now() - 1000);
    const ok = await authenticateAdmin('boss@ktech.test', 'correct-horse');
    expect(ok?.id).toBe('a1');
  });

  it('a streak older than the reset window does not count towards the lock', async () => {
    const r = rows.get('a1')!;
    r.failedLoginCount = ADMIN_MAX_FAILURES - 1;
    r.failedLoginAt = new Date(Date.now() - 60 * 60_000);
    expect(await authenticateAdmin('boss@ktech.test', 'wrong')).toBeNull();
    expect(rows.get('a1')!.lockedUntil).toBeNull();
    expect(rows.get('a1')!.failedLoginCount).toBe(1);
  });

  it('treats unknown emails like wrong passwords (and still does a password check)', async () => {
    const spy = vi.spyOn(bcrypt, 'compare');
    expect(await authenticateAdmin('nobody@ktech.test', 'whatever')).toBeNull();
    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });

  it('for 2FA roles the password step does NOT reset the counter (no free code guesses per login)', async () => {
    const r = rows.get('a1')!;
    r.role = 'SUPER_ADMIN';
    r.failedLoginCount = 2;
    r.failedLoginAt = new Date();
    const user = await authenticateAdmin('boss@ktech.test', 'correct-horse');
    expect(user?.role).toBe('SUPER_ADMIN');
    expect(rows.get('a1')!.failedLoginCount).toBe(3); // 2 earlier + this attempt, kept until the code step passes
    expect(rows.get('a1')!.lastLoginAt).toBeNull();
  });

  it('rejects deactivated admins', async () => {
    rows.get('a1')!.isActive = false;
    expect(await authenticateAdmin('boss@ktech.test', 'correct-horse')).toBeNull();
  });
});
