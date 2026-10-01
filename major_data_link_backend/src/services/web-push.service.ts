import webpush from 'web-push';
import type { ChatOwnerType } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { env } from '../config/env.js';

/**
 * Browser Web Push (VAPID) - the "alert me even though the site is closed"
 * half of live chat for the WEB app, complementing the Firebase push the
 * Flutter app already gets (see notification.service.ts's pushToTokens).
 *
 * How it reaches a closed browser: the page registers /sw.js (web/public/sw.js)
 * and subscribes through the browser's push service (Google/Mozilla/Apple).
 * We store that subscription here; when an admin replies we POST an encrypted
 * payload to the subscription's endpoint, the browser wakes the service
 * worker, and the worker shows an OS notification - no tab needed.
 *
 * Fully optional: without VAPID_* env vars every function here is a no-op and
 * the in-page alerts in LiveChatWidget.tsx keep working exactly as before.
 */

const MAX_SUBSCRIPTIONS_PER_OWNER = 10;

let configuredState: 'unknown' | 'on' | 'off' = 'unknown';

function ensureConfigured(): boolean {
  if (configuredState !== 'unknown') return configuredState === 'on';
  if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY) {
    configuredState = 'off';
    return false;
  }
  try {
    webpush.setVapidDetails(
      env.VAPID_SUBJECT || 'mailto:support@localhost.invalid',
      env.VAPID_PUBLIC_KEY,
      env.VAPID_PRIVATE_KEY
    );
    configuredState = 'on';
  } catch (error) {
    // Bad key/subject must never take the API down - just leave push off.
    console.error('[web-push] invalid VAPID configuration - web push disabled', error);
    configuredState = 'off';
  }
  return configuredState === 'on';
}

export function isWebPushConfigured() {
  return ensureConfigured();
}

export function getWebPushPublicKey(): string | null {
  return ensureConfigured() ? (env.VAPID_PUBLIC_KEY ?? null) : null;
}

export type WebPushSubscriptionInput = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
};

export async function saveWebPushSubscription(
  owner: { ownerType: ChatOwnerType; ownerId: string },
  subscription: WebPushSubscriptionInput,
  userAgent?: string
) {
  // Upsert on endpoint (not owner+endpoint): if this browser profile was last
  // used by someone else, the subscription is REASSIGNED to the account that
  // just signed in, so the previous person stops receiving this browser's
  // alerts. Same reasoning as registerDeviceToken().
  await prisma.webPushSubscription.upsert({
    where: { endpoint: subscription.endpoint },
    create: {
      ownerType: owner.ownerType,
      ownerId: owner.ownerId,
      endpoint: subscription.endpoint,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
      userAgent: userAgent?.slice(0, 300)
    },
    update: {
      ownerType: owner.ownerType,
      ownerId: owner.ownerId,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
      userAgent: userAgent?.slice(0, 300),
      lastSeenAt: new Date()
    }
  });

  // Keep only the newest few per owner so stale browsers can't pile up forever.
  const all = await prisma.webPushSubscription.findMany({
    where: { ownerType: owner.ownerType, ownerId: owner.ownerId },
    orderBy: { lastSeenAt: 'desc' },
    select: { id: true }
  });
  if (all.length > MAX_SUBSCRIPTIONS_PER_OWNER) {
    await prisma.webPushSubscription.deleteMany({
      where: { id: { in: all.slice(MAX_SUBSCRIPTIONS_PER_OWNER).map((row: { id: string }) => row.id) } }
    });
  }
}

export async function removeWebPushSubscription(endpoint: string) {
  await prisma.webPushSubscription.deleteMany({ where: { endpoint } });
}

export type WebPushPayload = {
  title: string;
  body: string;
  /** Where a click on the notification should land (path on this site). */
  url: string;
  tag?: string;
};

/** Sends to every browser the owner has subscribed. Never throws. */
export async function sendWebPushToOwner(
  owner: { ownerType: ChatOwnerType; ownerId: string },
  payload: WebPushPayload
) {
  if (!ensureConfigured()) return;

  const subscriptions = await prisma.webPushSubscription.findMany({
    where: { ownerType: owner.ownerType, ownerId: owner.ownerId }
  });
  if (subscriptions.length === 0) return;

  const body = JSON.stringify(payload);
  const dead: string[] = [];

  await Promise.all(
    subscriptions.map(async (sub: { endpoint: string; p256dh: string; auth: string }) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          body,
          // Hold for up to a day if the device is offline (it then arrives when
          // the phone/PC reconnects); "high" asks phones to wake up for it.
          { TTL: 24 * 60 * 60, urgency: 'high', timeout: 10_000 }
        );
      } catch (error) {
        const status = (error as { statusCode?: number }).statusCode;
        // 404/410 = the browser unsubscribed or the subscription expired.
        if (status === 404 || status === 410) {
          dead.push(sub.endpoint);
        } else {
          console.error('[web-push] send failed', status ?? '', (error as Error).message);
        }
      }
    })
  );

  if (dead.length > 0) {
    await prisma.webPushSubscription.deleteMany({ where: { endpoint: { in: dead } } });
  }
}
