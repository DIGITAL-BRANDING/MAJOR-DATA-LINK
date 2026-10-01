import { Router } from 'express';
import type { Request } from 'express';
import { z } from 'zod';
import type { ChatOwnerType } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { verifyAuthToken } from '../lib/auth-token.js';
import {
  getWebPushPublicKey,
  removeWebPushSubscription,
  saveWebPushSubscription
} from '../services/web-push.service.js';

export const webPushRoutes = Router();

/**
 * Resolves who is subscribing the same way the live-chat socket does
 * (chat-socket.ts resolveOwnerToken): a bare access token is tried as a
 * customer first, then as a partner - the customer site and the partner
 * portal both embed the same chat widget with their own separate tokens.
 */
async function resolveOwner(req: Request): Promise<{ ownerType: ChatOwnerType; ownerId: string } | null> {
  const header = req.header('authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) return null;

  let sub: string;
  try {
    sub = verifyAuthToken(token, 'access').sub;
  } catch {
    return null;
  }

  const user = await prisma.user.findUnique({ where: { id: sub }, select: { id: true, accountStatus: true } });
  if (user) return user.accountStatus === 'ACTIVE' ? { ownerType: 'USER', ownerId: user.id } : null;

  const partner = await prisma.partner.findUnique({ where: { id: sub }, select: { id: true } });
  if (partner) return { ownerType: 'PARTNER', ownerId: partner.id };

  return null;
}

/** Public: the browser needs the VAPID public key before it can subscribe. */
webPushRoutes.get('/public-key', (_req, res) => {
  const publicKey = getWebPushPublicKey();
  res.json({ status: true, data: { enabled: publicKey !== null, public_key: publicKey } });
});

const SubscribeSchema = z.object({
  subscription: z.object({
    endpoint: z.string().url().max(2048).startsWith('https://'),
    keys: z.object({
      p256dh: z.string().min(1).max(256),
      auth: z.string().min(1).max(256)
    })
  })
});

webPushRoutes.post('/subscribe', async (req, res) => {
  if (!getWebPushPublicKey()) {
    return res.status(503).json({ status: false, message: 'Browser push is not enabled on this server' });
  }
  const owner = await resolveOwner(req);
  if (!owner) return res.status(401).json({ status: false, message: 'Not signed in' });

  const body = SubscribeSchema.parse(req.body ?? {});
  await saveWebPushSubscription(owner, body.subscription, req.header('user-agent') ?? undefined);
  res.json({ status: true, message: 'Subscribed' });
});

/**
 * Deliberately not token-gated: it is called on logout (and when a session
 * has just expired), when there is no valid token left to present. The
 * endpoint URL is an unguessable per-browser secret, and all this can do is
 * stop alerts to that one browser.
 */
webPushRoutes.post('/unsubscribe', async (req, res) => {
  const body = z.object({ endpoint: z.string().url().max(2048) }).parse(req.body ?? {});
  await removeWebPushSubscription(body.endpoint);
  res.json({ status: true, message: 'Unsubscribed' });
});
