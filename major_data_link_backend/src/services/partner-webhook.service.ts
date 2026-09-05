import { createHash, createHmac, randomBytes, randomUUID } from 'node:crypto';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { PartnerWebhookDeliveryStatus, TransactionStatus, type PartnerTransaction } from '@prisma/client';
import { koboToNaira } from '../lib/money.js';
import { openPII, sealPII, type SealedPII } from '../lib/pii.js';
import { prisma } from '../lib/prisma.js';
import { ApiError } from '../middleware/error.js';

const MAX_ATTEMPTS = 8;
const REQUEST_TIMEOUT_MS = 10_000;

function sha256(value: string) { return createHash('sha256').update(value, 'utf8').digest('hex'); }
function secretFromSealed(value: unknown) { return openPII<{ secret?: string }>(value)?.secret; }

function isPrivateAddress(address: string) {
  if (isIP(address) === 4) {
    const [a, b] = address.split('.').map(Number);
    return a === 0 || a === 10 || a === 127 || a === 169 && b === 254 || a === 172 && b >= 16 && b <= 31 || a === 192 && b === 168 || a >= 224;
  }
  const v = address.toLowerCase();
  return v === '::1' || v === '::' || v.startsWith('fc') || v.startsWith('fd') || v.startsWith('fe80:');
}

/** Rejects non-public callback endpoints before config and before every send. */
export async function assertSafeWebhookUrl(raw: string) {
  let url: URL;
  try { url = new URL(raw); } catch { throw new ApiError(422, 'Webhook URL must be a valid HTTPS URL', 'INVALID_WEBHOOK_URL'); }
  if (url.protocol !== 'https:' || url.username || url.password || url.hash) {
    throw new ApiError(422, 'Webhook URL must use HTTPS and cannot contain credentials or a fragment', 'INVALID_WEBHOOK_URL');
  }
  if (url.hostname === 'localhost' || url.hostname.endsWith('.localhost')) {
    throw new ApiError(422, 'Webhook URL must point to a public host', 'UNSAFE_WEBHOOK_URL');
  }
  const addresses = await lookup(url.hostname, { all: true, verbatim: true }).catch(() => []);
  if (!addresses.length || addresses.some((item) => isPrivateAddress(item.address))) {
    throw new ApiError(422, 'Webhook URL must resolve to a public internet address', 'UNSAFE_WEBHOOK_URL');
  }
  return url.toString();
}

export async function configurePartnerWebhook(partnerId: string, rawUrl: string) {
  const webhookUrl = await assertSafeWebhookUrl(rawUrl);
  const secret = `mdl_whsec_${randomBytes(32).toString('hex')}`;
  const sealed = sealPII({ secret });
  await prisma.partner.update({ where: { id: partnerId }, data: { webhookUrl, webhookSecretEncrypted: sealed, webhookSecretHash: sha256(secret) } });
  // Secret is intentionally returned only here. The encrypted value is never
  // exposed by dashboard/admin APIs or logged.
  return { webhookUrl, secret };
}

export async function webhookConfiguration(partnerId: string) {
  const partner = await prisma.partner.findUniqueOrThrow({ where: { id: partnerId }, select: { webhookUrl: true, webhookSecretEncrypted: true } });
  return { webhook_url: partner.webhookUrl, configured: Boolean(partner.webhookUrl && secretFromSealed(partner.webhookSecretEncrypted)) };
}

function payloadFor(tx: PartnerTransaction, eventId: string) {
  return {
    id: eventId,
    event: 'transaction.updated',
    created_at: new Date().toISOString(),
    data: {
      reference: tx.reference,
      status: tx.status.toLowerCase(),
      type: tx.type.toLowerCase(),
      amount: koboToNaira(tx.amountKobo),
      balance_after: koboToNaira(tx.balanceAfterKobo),
      provider: tx.provider ?? null
    }
  };
}

/** Writes a terminal transaction event into the transactional outbox. */
export async function enqueuePartnerTransactionWebhook(tx: PartnerTransaction) {
  if (tx.status === TransactionStatus.PENDING) return;
  const eventId = randomUUID();
  await enqueuePartnerWebhookEvent(tx.partnerId, 'transaction.updated', `${tx.id}:${tx.status}`, payloadFor(tx, eventId), eventId);
}

async function enqueuePartnerWebhookEvent(partnerId: string, event: string, eventKey: string, payload: object, eventId = randomUUID()) {
  const partner = await prisma.partner.findUnique({ where: { id: partnerId }, select: { webhookUrl: true, webhookSecretEncrypted: true } });
  const secret = secretFromSealed(partner?.webhookSecretEncrypted);
  if (!partner?.webhookUrl || !secret) return;
  try {
    await prisma.partnerWebhookDelivery.create({ data: {
      partnerId, eventId, eventKey, event,
      payload, signingSecret: sealPII({ secret }), nextAttemptAt: new Date()
    }});
  } catch (error: any) {
    // The unique event key makes the queue idempotent. A replay must not
    // produce a second partner notification.
    if (error?.code !== 'P2002') throw error;
  }
}

export async function queuePartnerWebhookTest(partnerId: string) {
  const eventId = randomUUID();
  await enqueuePartnerWebhookEvent(partnerId, 'webhook.test', `test:${eventId}`, {
    id: eventId, event: 'webhook.test', created_at: new Date().toISOString(), data: { message: 'Major Data Link webhook configuration test' }
  }, eventId);
  await deliverDuePartnerWebhooks(1);
  return prisma.partnerWebhookDelivery.findUnique({ where: { eventId } });
}

function retryAt(attempt: number) {
  // 1, 2, 4, 8, 16, 32 minutes, then cap at one hour.
  return new Date(Date.now() + Math.min(60, 2 ** Math.max(0, attempt - 1)) * 60_000);
}

async function deliverOne(id: string) {
  const now = new Date();
  const claimed = await prisma.partnerWebhookDelivery.updateMany({ where: { id, status: PartnerWebhookDeliveryStatus.PENDING, nextAttemptAt: { lte: now } }, data: { status: PartnerWebhookDeliveryStatus.PROCESSING, lockedAt: now } });
  if (!claimed.count) return;
  const delivery = await prisma.partnerWebhookDelivery.findUniqueOrThrow({ where: { id }, include: { partner: { select: { webhookUrl: true } } } });
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const rawBody = JSON.stringify(delivery.payload);
  let responseStatus: number | null = null;
  let errorMessage: string | null = null;
  try {
    if (!delivery.partner.webhookUrl) throw new Error('Partner webhook URL is no longer configured');
    const endpoint = await assertSafeWebhookUrl(delivery.partner.webhookUrl);
    const secret = secretFromSealed(delivery.signingSecret);
    if (!secret) throw new Error('Webhook signing secret is unavailable');
    const signature = createHmac('sha256', secret).update(`${timestamp}.${rawBody}`, 'utf8').digest('hex');
    // Do not follow redirects: a public endpoint could otherwise redirect the
    // server into an internal/private network after our URL validation.
    const response = await fetch(endpoint, { method: 'POST', redirect: 'error', signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS), headers: {
      'Content-Type': 'application/json', 'User-Agent': 'MajorDataLink-Webhooks/1.0',
      'X-MDL-Event': delivery.event, 'X-MDL-Event-ID': delivery.eventId,
      'X-MDL-Timestamp': timestamp, 'X-MDL-Signature': `sha256=${signature}`
    }, body: rawBody });
    responseStatus = response.status;
    if (response.status >= 200 && response.status < 300) {
      await prisma.partnerWebhookDelivery.update({ where: { id }, data: { status: PartnerWebhookDeliveryStatus.DELIVERED, deliveredAt: new Date(), lastAttemptAt: new Date(), lastResponseStatus: responseStatus, lockedAt: null, lastError: null } });
      return;
    }
    errorMessage = `Endpoint returned HTTP ${response.status}`;
  } catch (error) {
    errorMessage = error instanceof Error ? error.message : 'Webhook request failed';
  }
  const attemptCount = delivery.attemptCount + 1;
  await prisma.partnerWebhookDelivery.update({ where: { id }, data: {
    status: attemptCount >= MAX_ATTEMPTS ? PartnerWebhookDeliveryStatus.FAILED : PartnerWebhookDeliveryStatus.PENDING,
    attemptCount, nextAttemptAt: retryAt(attemptCount), lockedAt: null, lastAttemptAt: new Date(),
    lastResponseStatus: responseStatus, lastError: errorMessage?.slice(0, 500) ?? 'Webhook delivery failed'
  }});
}

/** Processes due work; safe to run on every application instance. */
export async function deliverDuePartnerWebhooks(limit = 25) {
  // Recover a delivery abandoned by an instance restart after two minutes.
  await prisma.partnerWebhookDelivery.updateMany({ where: { status: PartnerWebhookDeliveryStatus.PROCESSING, lockedAt: { lt: new Date(Date.now() - 120_000) } }, data: { status: PartnerWebhookDeliveryStatus.PENDING, lockedAt: null, nextAttemptAt: new Date() } });
  const due = await prisma.partnerWebhookDelivery.findMany({ where: { status: PartnerWebhookDeliveryStatus.PENDING, nextAttemptAt: { lte: new Date() } }, orderBy: { nextAttemptAt: 'asc' }, take: limit, select: { id: true } });
  await Promise.allSettled(due.map((delivery) => deliverOne(delivery.id)));
}

export function startPartnerWebhookWorker() {
  void deliverDuePartnerWebhooks().catch((error) => console.error('[partner-webhooks] initial worker run failed', error));
  const timer = setInterval(() => void deliverDuePartnerWebhooks().catch((error) => console.error('[partner-webhooks] worker run failed', error)), 30_000);
  timer.unref();
  return () => clearInterval(timer);
}
