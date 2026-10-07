import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import 'express-async-errors';
import express from 'express';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';

const { prismaMock, verifyPin } = vi.hoisted(() => ({
  prismaMock: {
    user: { findUniqueOrThrow: vi.fn(), findFirst: vi.fn(), update: vi.fn() },
    transaction: { aggregate: vi.fn() }
  },
  verifyPin: vi.fn()
}));

vi.mock('../../lib/prisma.js', () => ({ prisma: prismaMock }));
vi.mock('../../middleware/auth.js', () => ({
  requireAuth: (req: express.Request, _res: express.Response, next: express.NextFunction) => {
    (req as unknown as { user: unknown }).user = { id: 'u1', email: 'old@example.com', phone: '08011111111' };
    next();
  }
}));
vi.mock('../../services/wallet.service.js', () => ({ setPin: vi.fn(), setPinIfUnset: vi.fn(), verifyPin }));
vi.mock('../../services/login-pin.service.js', () => ({ setLoginPin: vi.fn(), setLoginPinIfUnset: vi.fn(), verifyLoginPin: vi.fn() }));
vi.mock('../../services/kyc.service.js', () => ({ tryProvisionInstantVirtualAccount: vi.fn() }));
vi.mock('../../lib/public-user.js', () => ({
  publicUser: async (u: { fullName: string; email: string; phone: string }) => ({ full_name: u.fullName, email: u.email, phone: u.phone })
}));

import { userRoutes } from '../user.routes.js';
import { errorHandler } from '../../middleware/error.js';

let server: Server;
let base = '';
beforeAll(async () => {
  const app = express();
  app.use(express.json());
  app.use('/api/user', userRoutes);
  app.use(errorHandler);
  await new Promise<void>((resolve) => {
    server = app.listen(0, () => resolve());
  });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/user`;
});
afterAll(() => {
  server.close();
});

const current = { id: 'u1', fullName: 'Old Name', email: 'old@example.com', phone: '08011111111', pinHash: 'x', passwordHash: null };
beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  prismaMock.user.findUniqueOrThrow.mockResolvedValue(current);
  prismaMock.user.findFirst.mockResolvedValue(null);
  prismaMock.user.update.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({ ...current, ...Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined)) }));
  verifyPin.mockResolvedValue(undefined);
});

const post = (body: unknown) => fetch(`${base}/profile/update`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
const same = { email: 'old@example.com', phone: '08011111111' };

describe('GET /user/profile/summary (total funded)', () => {
  it('sums successful wallet fundings only and reports the count and last date', async () => {
    prismaMock.transaction.aggregate.mockResolvedValue({ _sum: { amountKobo: 12_550_000n }, _count: 3, _max: { createdAt: new Date('2026-10-01T08:00:00Z') } });
    const res = await fetch(`${base}/profile/summary`);
    expect(await res.json()).toEqual({ status: true, data: { total_funded: 125500, funding_count: 3, last_funded_at: '2026-10-01T08:00:00.000Z' } });
    const where = prismaMock.transaction.aggregate.mock.calls[0][0].where;
    expect(where).toEqual({ userId: 'u1', type: 'WALLET_FUNDING', status: 'SUCCESS' });
  });

  it('is zero (not an error) for someone who has never funded', async () => {
    prismaMock.transaction.aggregate.mockResolvedValue({ _sum: { amountKobo: null }, _count: 0, _max: { createdAt: null } });
    const res = await fetch(`${base}/profile/summary`);
    expect((await res.json()).data).toEqual({ total_funded: 0, funding_count: 0, last_funded_at: null });
  });
});

describe('POST /user/profile/update', () => {
  it('lets a user change their name without a PIN and leaves verification flags alone', async () => {
    const res = await post({ full_name: 'New Name', ...same });
    expect(res.status).toBe(200);
    expect((await res.json()).data.full_name).toBe('New Name');
    expect(verifyPin).not.toHaveBeenCalled();
    const data = prismaMock.user.update.mock.calls[0][0].data;
    expect(data).toMatchObject({ fullName: 'New Name' });
    expect(data.emailVerified).toBeUndefined();
    expect(data.phoneVerified).toBeUndefined();
  });

  it('requires the PIN to change the email, and does not write anything without it', async () => {
    const res = await post({ full_name: 'Old Name', email: 'new@example.com', phone: same.phone });
    expect(res.status).toBe(422);
    expect((await res.json()).code).toBe('CREDENTIAL_REQUIRED');
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });

  it('rejects a wrong PIN without changing anything', async () => {
    const { ApiError } = await import('../../middleware/error.js');
    verifyPin.mockRejectedValue(new ApiError(401, 'Incorrect PIN', 'INVALID_PIN'));
    const res = await post({ full_name: 'Old Name', email: same.email, phone: '08022222222', pin: '0000' });
    expect(res.status).toBe(401);
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });

  it('changes email/phone with the right PIN and marks the new contact unverified', async () => {
    const res = await post({ full_name: 'Old Name', email: 'NEW@Example.com', phone: '08022222222', pin: '1234' });
    expect(res.status).toBe(200);
    expect(verifyPin).toHaveBeenCalledWith('u1', '1234');
    const data = prismaMock.user.update.mock.calls[0][0].data;
    expect(data).toMatchObject({ email: 'new@example.com', phone: '08022222222', emailVerified: false, phoneVerified: false });
  });

  it('refuses an email or phone that belongs to another account', async () => {
    prismaMock.user.findFirst.mockResolvedValue({ id: 'someone-else' });
    const res = await post({ full_name: 'Old Name', email: 'taken@example.com', phone: same.phone, pin: '1234' });
    expect(res.status).toBe(409);
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });

  it('only checks conflicts for the field that actually changed', async () => {
    await post({ full_name: 'Old Name', email: same.email, phone: '08022222222', pin: '1234' });
    expect(prismaMock.user.findFirst.mock.calls[0][0].where.OR).toEqual([{ phone: '08022222222' }]);
  });

  it('validates input', async () => {
    expect((await post({ full_name: 'A', ...same })).status).toBe(422);
    expect((await post({ full_name: 'Valid Name', email: 'not-an-email', phone: same.phone })).status).toBe(422);
  });
});
