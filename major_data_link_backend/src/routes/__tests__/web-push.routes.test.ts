import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import 'express-async-errors';
import express from 'express';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';

const { prismaMock, saveSub, removeSub } = vi.hoisted(() => ({
  prismaMock: { user: { findUnique: vi.fn() }, partner: { findUnique: vi.fn() } },
  saveSub: vi.fn(),
  removeSub: vi.fn()
}));

vi.mock('../../lib/prisma.js', () => ({ prisma: prismaMock }));
vi.mock('../../services/web-push.service.js', () => ({
  getWebPushPublicKey: () => 'test-public-key',
  saveWebPushSubscription: saveSub,
  removeWebPushSubscription: removeSub
}));

import { createAuthToken } from '../../lib/auth-token.js';
import { webPushRoutes } from '../web-push.routes.js';

let server: Server;
let base = '';

beforeAll(async () => {
  const app = express();
  app.use(express.json());
  app.use('/api/web-push', webPushRoutes);
  // Mirrors the app's error handler closely enough for zod validation errors.
  app.use((_err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    res.status(400).json({ status: false });
  });
  await new Promise<void>((resolve) => {
    server = app.listen(0, () => resolve());
  });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/web-push`;
});

afterAll(() => {
  server.close();
});

beforeEach(() => {
  vi.clearAllMocks();
});

const subscription = { endpoint: 'https://fcm.googleapis.com/fcm/send/abc', keys: { p256dh: 'p', auth: 'a' } };
const post = (path: string, body: unknown, token?: string) =>
  fetch(`${base}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body)
  });

describe('web push routes', () => {
  it('publishes the VAPID public key without auth', async () => {
    const res = await fetch(`${base}/public-key`);
    expect(await res.json()).toEqual({ status: true, data: { enabled: true, public_key: 'test-public-key' } });
  });

  it('rejects a subscribe call with no or an invalid token', async () => {
    expect((await post('/subscribe', { subscription })).status).toBe(401);
    expect((await post('/subscribe', { subscription }, 'garbage')).status).toBe(401);
    expect(saveSub).not.toHaveBeenCalled();
  });

  it('subscribes a signed-in customer', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ id: 'u1', accountStatus: 'ACTIVE' });
    const token = createAuthToken({ userId: 'u1', email: 'a@b.co', type: 'access', ttlSeconds: 600 });

    const res = await post('/subscribe', { subscription }, token);

    expect(res.status).toBe(200);
    expect(saveSub).toHaveBeenCalledWith({ ownerType: 'USER', ownerId: 'u1' }, subscription, expect.anything());
  });

  it('subscribes a signed-in partner (token that is not a customer)', async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);
    prismaMock.partner.findUnique.mockResolvedValue({ id: 'p1' });
    const token = createAuthToken({ userId: 'p1', email: 'p@b.co', type: 'access', ttlSeconds: 600 });

    const res = await post('/subscribe', { subscription }, token);

    expect(res.status).toBe(200);
    expect(saveSub).toHaveBeenCalledWith({ ownerType: 'PARTNER', ownerId: 'p1' }, subscription, expect.anything());
  });

  it('refuses a non-https push endpoint', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ id: 'u1', accountStatus: 'ACTIVE' });
    const token = createAuthToken({ userId: 'u1', email: 'a@b.co', type: 'access', ttlSeconds: 600 });
    const res = await post('/subscribe', { subscription: { ...subscription, endpoint: 'http://evil.example/x' } }, token);
    expect(res.status).toBe(400);
    expect(saveSub).not.toHaveBeenCalled();
  });

  it('unsubscribes by endpoint without needing a token (used on logout)', async () => {
    const res = await post('/unsubscribe', { endpoint: subscription.endpoint });
    expect(res.status).toBe(200);
    expect(removeSub).toHaveBeenCalledWith(subscription.endpoint);
  });
});
