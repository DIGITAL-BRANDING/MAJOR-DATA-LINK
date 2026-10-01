import { beforeEach, describe, expect, it, vi } from 'vitest';

const { sendNotification, setVapidDetails, prismaMock } = vi.hoisted(() => ({
  sendNotification: vi.fn(),
  setVapidDetails: vi.fn(),
  prismaMock: {
    webPushSubscription: {
      upsert: vi.fn(),
      findMany: vi.fn(),
      deleteMany: vi.fn()
    }
  }
}));

vi.mock('web-push', () => ({ default: { sendNotification, setVapidDetails } }));
vi.mock('../../lib/prisma.js', () => ({ prisma: prismaMock }));
vi.mock('../../config/env.js', () => ({
  env: { VAPID_PUBLIC_KEY: 'pub', VAPID_PRIVATE_KEY: 'priv', VAPID_SUBJECT: 'mailto:test@example.com' }
}));

import { saveWebPushSubscription, sendWebPushToOwner } from '../web-push.service.js';

const owner = { ownerType: 'USER' as const, ownerId: 'user-1' };
const payload = { title: 'K-Tech Support', body: 'Hello', url: '/dashboard?livechat=1' };

beforeEach(() => {
  vi.clearAllMocks();
});

describe('sendWebPushToOwner', () => {
  it('sends the payload to every subscribed browser of the owner', async () => {
    prismaMock.webPushSubscription.findMany.mockResolvedValue([
      { endpoint: 'https://push.example/a', p256dh: 'k1', auth: 'a1' },
      { endpoint: 'https://push.example/b', p256dh: 'k2', auth: 'a2' }
    ]);
    sendNotification.mockResolvedValue({});

    await sendWebPushToOwner(owner, payload);

    expect(sendNotification).toHaveBeenCalledTimes(2);
    expect(sendNotification.mock.calls[0][0]).toEqual({ endpoint: 'https://push.example/a', keys: { p256dh: 'k1', auth: 'a1' } });
    expect(JSON.parse(sendNotification.mock.calls[0][1] as string)).toEqual(payload);
    expect(prismaMock.webPushSubscription.deleteMany).not.toHaveBeenCalled();
  });

  it('prunes subscriptions the push service reports as gone (404/410) but keeps ones with transient errors', async () => {
    prismaMock.webPushSubscription.findMany.mockResolvedValue([
      { endpoint: 'https://push.example/gone', p256dh: 'k', auth: 'a' },
      { endpoint: 'https://push.example/flaky', p256dh: 'k', auth: 'a' },
      { endpoint: 'https://push.example/ok', p256dh: 'k', auth: 'a' }
    ]);
    sendNotification.mockImplementation(async (sub: { endpoint: string }) => {
      if (sub.endpoint.endsWith('/gone')) throw Object.assign(new Error('gone'), { statusCode: 410 });
      if (sub.endpoint.endsWith('/flaky')) throw Object.assign(new Error('boom'), { statusCode: 500 });
      return {};
    });
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    await sendWebPushToOwner(owner, payload);

    expect(prismaMock.webPushSubscription.deleteMany).toHaveBeenCalledWith({
      where: { endpoint: { in: ['https://push.example/gone'] } }
    });
  });

  it('does nothing when the owner has no subscriptions', async () => {
    prismaMock.webPushSubscription.findMany.mockResolvedValue([]);
    await sendWebPushToOwner(owner, payload);
    expect(sendNotification).not.toHaveBeenCalled();
  });
});

describe('saveWebPushSubscription', () => {
  it('reassigns an existing browser endpoint to the account that just signed in', async () => {
    prismaMock.webPushSubscription.upsert.mockResolvedValue({});
    prismaMock.webPushSubscription.findMany.mockResolvedValue([]);

    await saveWebPushSubscription(owner, { endpoint: 'https://push.example/a', keys: { p256dh: 'k', auth: 'a' } }, 'UA');

    const call = prismaMock.webPushSubscription.upsert.mock.calls[0][0];
    expect(call.where).toEqual({ endpoint: 'https://push.example/a' });
    expect(call.update).toMatchObject({ ownerType: 'USER', ownerId: 'user-1' });
  });

  it('keeps only the newest 10 subscriptions per owner', async () => {
    prismaMock.webPushSubscription.upsert.mockResolvedValue({});
    prismaMock.webPushSubscription.findMany.mockResolvedValue(
      Array.from({ length: 12 }, (_v, i) => ({ id: `sub-${i}` }))
    );

    await saveWebPushSubscription(owner, { endpoint: 'https://push.example/a', keys: { p256dh: 'k', auth: 'a' } });

    expect(prismaMock.webPushSubscription.deleteMany).toHaveBeenCalledWith({ where: { id: { in: ['sub-10', 'sub-11'] } } });
  });
});
