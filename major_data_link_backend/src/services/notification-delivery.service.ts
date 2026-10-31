import { nanoid } from 'nanoid';
import type { NotificationType } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { pushToTokens } from './notification.service.js';

const MAX_ATTEMPTS = 8;

export async function enqueueUserNotificationDelivery(tx: any, notificationId: string) {
  await tx.notificationDelivery.upsert({
    where: { notificationId },
    create: { id: nanoid(), notificationId },
    update: {}
  });
}

function retryAt(attempt: number) {
  return new Date(Date.now() + Math.min(60, 2 ** Math.max(0, attempt - 1)) * 60_000);
}

export async function deliverUserNotificationQueue(limit = 30) {
  const now = new Date();
  const rows = await prisma.notificationDelivery.findMany({
    where: { OR: [
      { status: 'PENDING', nextAttemptAt: { lte: now } },
      { status: 'PROCESSING', lastAttemptAt: { lte: new Date(now.getTime() - 5 * 60_000) } }
    ] },
    orderBy: { nextAttemptAt: 'asc' }, take: limit,
    include: { notification: true }
  });
  await Promise.allSettled(rows.map(async (delivery) => {
    const claimed = await prisma.notificationDelivery.updateMany({
      where: { id: delivery.id, OR: [
        { status: 'PENDING', nextAttemptAt: { lte: new Date() } },
        { status: 'PROCESSING', lastAttemptAt: { lte: new Date(Date.now() - 5 * 60_000) } }
      ] },
      data: { status: 'PROCESSING', lastAttemptAt: new Date() }
    });
    if (!claimed.count) return;
    try {
      const devices = await prisma.deviceToken.findMany({ where: { userId: delivery.notification.userId }, select: { token: true } });
      await pushToTokens(devices.map((device) => device.token), delivery.notification.title, delivery.notification.body, {
        type: delivery.notification.type as NotificationType,
        notificationId: delivery.notification.id
      }, true);
      await prisma.notificationDelivery.update({ where: { id: delivery.id }, data: { status: 'DELIVERED', lastError: null } });
    } catch (error) {
      const attemptCount = delivery.attemptCount + 1;
      await prisma.notificationDelivery.update({ where: { id: delivery.id }, data: {
        status: attemptCount >= MAX_ATTEMPTS ? 'FAILED' : 'PENDING',
        attemptCount,
        nextAttemptAt: retryAt(attemptCount),
        lastError: (error instanceof Error ? error.message : 'Push delivery failed').slice(0, 500)
      } });
    }
  }));
}

export function startUserNotificationDeliveryWorker() {
  void deliverUserNotificationQueue().catch((error) => console.error('[user-notifications] initial delivery failed', error));
  const timer = setInterval(() => void deliverUserNotificationQueue().catch((error) => console.error('[user-notifications] delivery worker failed', error)), 30_000);
  timer.unref();
  return () => clearInterval(timer);
}
