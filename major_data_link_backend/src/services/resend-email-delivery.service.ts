import type { WebhookEventPayload } from 'resend';
import { prisma } from '../lib/prisma.js';

const EMAIL_EVENT_STATUS: Partial<Record<WebhookEventPayload['type'], { status: string; rank: number }>> = {
  'email.sent': { status: 'sent', rank: 1 },
  'email.delivery_delayed': { status: 'delivery_delayed', rank: 2 },
  'email.delivered': { status: 'delivered', rank: 3 },
  'email.bounced': { status: 'bounced', rank: 4 },
  'email.complained': { status: 'complained', rank: 4 },
  'email.failed': { status: 'failed', rank: 4 },
  'email.suppressed': { status: 'suppressed', rank: 4 }
};

function eventDetail(event: WebhookEventPayload): string | null {
  switch (event.type) {
    case 'email.bounced': return event.data.bounce.message;
    case 'email.failed': return event.data.failed.reason;
    case 'email.suppressed': return event.data.suppressed.message;
    default: return null;
  }
}

async function updateDelivery(emailId: string, eventType: WebhookEventPayload['type'], occurredAt: Date, detail: string | null) {
  const mapping = EMAIL_EVENT_STATUS[eventType];
  if (!mapping) return 0;
  const allowedFrom = Object.values(EMAIL_EVENT_STATUS)
    .filter((status) => status && status.rank <= mapping.rank)
    .map((status) => status!.status);
  const result = await prisma.emailDelivery.updateMany({
    where: { resendEmailId: emailId, status: { in: allowedFrom } },
    data: {
      status: mapping.status,
      lastEventAt: Number.isNaN(occurredAt.getTime()) ? new Date() : occurredAt,
      ...(detail ? { errorMessage: detail } : {})
    }
  });
  return result.count;
}

/** Apply a verified Resend event, retaining it if its delivery row is not saved yet. */
export async function applyResendEmailDeliveryEvent(event: WebhookEventPayload, webhookEventId: string): Promise<void> {
  const mapping = EMAIL_EVENT_STATUS[event.type];
  if (!mapping || !('email_id' in event.data) || !event.data.email_id) return;

  const emailId = event.data.email_id;
  const occurredAt = new Date(event.created_at);
  const detail = eventDetail(event);
  const updated = await updateDelivery(emailId, event.type, occurredAt, detail);
  if (updated) return;

  await prisma.resendEmailDeliveryEvent.upsert({
    where: { id: webhookEventId },
    create: {
      id: webhookEventId,
      resendEmailId: emailId,
      eventType: event.type,
      occurredAt: Number.isNaN(occurredAt.getTime()) ? new Date() : occurredAt,
      errorMessage: detail
    },
    update: {}
  });
}

/** Replay race-window events immediately after their EmailDelivery rows are created. */
export async function replayPendingResendEmailEvents(emailIds: string[]): Promise<void> {
  const ids = [...new Set(emailIds.filter(Boolean))];
  if (!ids.length) return;
  const events = await prisma.resendEmailDeliveryEvent.findMany({
    where: { resendEmailId: { in: ids } },
    orderBy: [{ occurredAt: 'asc' }, { createdAt: 'asc' }]
  });

  for (const event of events) {
    const mapping = EMAIL_EVENT_STATUS[event.eventType as WebhookEventPayload['type']];
    if (mapping) {
      await updateDelivery(
        event.resendEmailId,
        event.eventType as WebhookEventPayload['type'],
        event.occurredAt,
        event.errorMessage
      );
    }
    await prisma.resendEmailDeliveryEvent.delete({ where: { id: event.id } });
  }
}
