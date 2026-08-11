import crypto from 'node:crypto';
import { Router } from 'express';
import { env } from '../config/env.js';
import { prisma } from '../lib/prisma.js';
import {
  creditDirectDeposit,
  creditDirectDepositByAccountNumber,
  creditWalletByReference,
  markFundingFailed
} from '../services/wallet.service.js';
import { paystackService } from '../services/paystack.service.js';
import { katpayService } from '../services/katpay.service.js';
import { advanceSession } from '../services/whatsapp-session.service.js';

function normalizeKatpayStatus(value: unknown): string | undefined {
  if (typeof value === 'string' || typeof value === 'number') return String(value).trim().toUpperCase();
  if (typeof value === 'boolean') return value ? 'SUCCESS' : 'FAILED';
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    for (const key of ['status', 'value', 'name', 'code']) {
      const normalized = normalizeKatpayStatus(record[key]);
      if (normalized) return normalized;
    }
  }
  return undefined;
}

export const webhookRoutes = Router();

/**
 * Paystack webhook. Mounted in app.ts with express.raw() (NOT express.json()) ahead of
 * the global JSON parser, because the signature is computed over the exact raw request
 * body — parsing/re-serializing it first would make the signature check unreliable.
 */
webhookRoutes.post('/paystack', async (req, res) => {
  const signature = req.header('x-paystack-signature');
  if (!env.PAYSTACK_SECRET_KEY || !signature) {
    return res.status(400).json({ status: false, message: 'Missing signature' });
  }

  const rawBody = req.body as Buffer;
  const expectedSignature = crypto
    .createHmac('sha512', env.PAYSTACK_SECRET_KEY)
    .update(rawBody)
    .digest('hex');

  if (expectedSignature !== signature) {
    return res.status(401).json({ status: false, message: 'Invalid signature' });
  }

  const event = JSON.parse(rawBody.toString('utf8'));

  if (event.event === 'charge.success') {
    const reference = event.data?.reference as string | undefined;
    const channel = event.data?.channel as string | undefined;
    const customerCode = event.data?.customer?.customer_code as string | undefined;

    if (reference) {
      // Don't trust the webhook payload's amount/status directly — re-verify
      // server-to-server before crediting anything.
      const verified = await paystackService.verifyTransaction(reference);

      if (verified.status === 'success') {
        const existingTransaction = await prisma.transaction.findUnique({ where: { reference } });

        if (existingTransaction) {
          // A funding attempt WE initiated — card charge (/wallet/fund) or a
          // Pay-with-Transfer dynamic account (/wallet/fund/dynamic) — already has
          // a PENDING row waiting for this exact reference. Credit it as before.
          const credited = await creditWalletByReference(reference);

          // If this funding attempt came from the WhatsApp bot's "fund" command
          // (tagged in metadata when the PENDING row was created — see
          // whatsapp-session.service.ts), let the same chat know it went through,
          // since the in-app push notification creditWalletByReference already
          // sent won't be seen by someone who paid entirely from WhatsApp.
          const metadata = credited.metadata as { channel?: string; whatsapp_phone?: string } | null;
          if (metadata?.channel === 'whatsapp' && metadata.whatsapp_phone) {
            await sendWhatsAppText(
              metadata.whatsapp_phone,
              `Payment received! NGN${(Number(credited.amountKobo) / 100).toFixed(2)} was added to your wallet. Reply "fund" to top up again, or pick a network to buy data.`
            );
          }
        } else if (customerCode && (channel === 'dedicated_nuban' || channel === 'bank_transfer')) {
          // No pending transaction exists for this reference, which means the
          // money arrived as a direct transfer into the user's permanent Dedicated
          // Virtual Account — out-of-band, not through any endpoint of ours. This
          // is the "just transfer to the account on your dashboard" flow. Credit
          // it on the fly, matched by the Paystack customer_code stored on the
          // user's record.
          await creditDirectDeposit({
            reference,
            amountKobo: BigInt(verified.amount),
            customerCode,
            channel
          });
        }
        // Any other charge.success with no matching transaction and no
        // recognizable channel/customer is ignored rather than guessed at.
      } else {
        await markFundingFailed(reference);
      }
    }
  }

  // Paystack expects a fast 200 regardless of whether we acted on the event type.
  res.sendStatus(200);
});

/**
 * KatPay webhook. Mounted under the same express.raw() as /paystack above (see
 * app.ts) — KatPay's X-Katpay-Signature, like Paystack's, is computed over the
 * exact raw request bytes, so it must be verified before any JSON parsing happens.
 *
 * Handles the two events relevant to wallet funding:
 *   - virtual_account.payment_received: money landed directly in a user's
 *     permanent KatPay virtual account (the "just transfer to the account on your
 *     dashboard" flow) — no pending transaction exists for this yet, matched by
 *     the account number instead.
 *   - transfer_payment.completed: confirms a one-time /wallet/fund/dynamic order
 *     initiated by us — a PENDING transaction already exists, matched by our own
 *     merchant_reference.
 * Both other event types (transaction.completed, payout.processed) are accepted
 * but currently no-ops — nothing in this app consumes them yet.
 */
webhookRoutes.post('/katpay', async (req, res) => {
  const signature = req.header('x-katpay-signature');
  const timestamp = req.header('x-katpay-timestamp');
  const secret = env.KATPAY_WEBHOOK_SECRET ?? env.KATPAY_SECRET_KEY;

  if (!secret || !signature || !timestamp) {
    return res.status(400).json({ error: 'Missing required headers' });
  }

  const rawBody = req.body as Buffer;
  const signedPayload = `${timestamp}.${rawBody.toString('utf8')}`;
  const expectedSignature = crypto.createHmac('sha256', secret).update(signedPayload).digest('hex');

  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);
  const signatureValid =
    signatureBuffer.length === expectedBuffer.length && crypto.timingSafeEqual(signatureBuffer, expectedBuffer);

  if (!signatureValid) {
    return res.status(401).json({ error: 'Invalid signature' });
  }

  const event = JSON.parse(rawBody.toString('utf8'));
  const eventType = event.event_type as string | undefined;

  try {
    if (eventType === 'virtual_account.payment_received') {
      const transaction = event.data?.transaction ?? {};
      const virtualAccount = event.data?.virtual_account ?? {};
      const orderStatus = normalizeKatpayStatus(transaction.order_status);
      const accountNumber = virtualAccount.account_number as string | undefined;
      const reference = (transaction.reference ?? transaction.order_no) as string | undefined;
      const amountKobo =
        transaction.order_amount_cents != null
          ? BigInt(transaction.order_amount_cents)
          : BigInt(Math.round(Number(transaction.order_amount ?? 0) * 100));

      if (['SUCCESS', 'COMPLETED', 'PAID', '1', 'TRUE'].includes(orderStatus ?? '') && accountNumber && reference) {
        await creditDirectDepositByAccountNumber({
          reference,
          amountKobo,
          accountNumber,
          channel: 'katpay_virtual_account'
        });
      }
    } else if (eventType === 'transfer_payment.completed') {
      // NOTE: KatPay's published docs don't show this event's exact payload shape -
      // this reads the same field names the /v1/transfer-payments response itself
      // uses (merchant_reference/status), which is the most likely shape for the
      // webhook too. Confirm against a real delivered webhook once KatPay sends one
      // and adjust the paths below if it's nested differently.
      const payment = event.data?.transfer_payment ?? event.data ?? {};
      const reference = payment.merchant_reference as string | undefined;

      if (reference) {
        // Same "never trust the webhook payload alone" principle the /paystack
        // handler above follows - re-check directly with KatPay before crediting,
        // rather than trusting event.data.transfer_payment.status as-is. Needs the
        // KatPay uuid, which was stored in the pending Transaction's metadata when
        // /wallet/fund/dynamic created it (see payment-provider.service.ts).
        const pending = await prisma.transaction.findUnique({ where: { reference } });
        const uuid = (pending?.metadata as { provider_reference?: string } | null)?.provider_reference;

        if (uuid) {
          const verified = await katpayService.getTransferPaymentStatus(uuid);
          // Accept both 'success' and 'completed' - see the comment on
          // KatpayTransferPayment['status'] in katpay.service.ts for why.
          if (verified.status === 'success' || verified.status === 'completed') {
            await creditWalletByReference(reference);
          } else if (verified.status === 'failed' || verified.status === 'expired') {
            await markFundingFailed(reference);
          }
          // Any other in-between status (e.g. 'processing') - do nothing, a later
          // webhook delivery or the /fund/verify fallback will resolve it.
        }
      }
    }
  } catch (error) {
    console.error('[katpay-webhook] failed to process event', eventType, error);
    // Return non-2xx for a genuine processing failure so KatPay retries delivery.
    return res.status(500).json({ error: 'Webhook processing failed' });
  }

  res.sendStatus(200);
});

/**
 * One-time handshake Meta sends when you register this URL in the App Dashboard.
 * No body involved, so mounting under the raw-body parser above is harmless.
 */
webhookRoutes.get('/whatsapp', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && env.WHATSAPP_VERIFY_TOKEN && token === env.WHATSAPP_VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }
  return res.sendStatus(403);
});

/**
 * Inbound WhatsApp messages. Mounted under the same express.raw() as /paystack
 * above (see app.ts) because, exactly like Paystack, Meta's X-Hub-Signature-256
 * is computed over the exact raw request bytes - parsing first would make the
 * signature check unreliable.
 */
webhookRoutes.post('/whatsapp', async (req, res) => {
  const signatureHeader = req.header('x-hub-signature-256');
  if (!env.WHATSAPP_APP_SECRET || !signatureHeader) {
    return res.sendStatus(400);
  }

  const rawBody = req.body as Buffer;
  const expectedSignature =
    'sha256=' + crypto.createHmac('sha256', env.WHATSAPP_APP_SECRET).update(rawBody).digest('hex');

  if (
    signatureHeader.length !== expectedSignature.length ||
    !crypto.timingSafeEqual(Buffer.from(signatureHeader), Buffer.from(expectedSignature))
  ) {
    return res.sendStatus(401);
  }

  // Meta expects a fast 200 regardless of what we do with the payload, and retries
  // aggressively on non-2xx - respond immediately so a slow provider call downstream
  // can never cause a duplicate delivery on top of the idempotency key already in place.
  res.sendStatus(200);

  try {
    const payload = JSON.parse(rawBody.toString('utf8'));
    const entries = payload?.entry ?? [];

    for (const entry of entries) {
      for (const change of entry.changes ?? []) {
        const messages = change.value?.messages ?? [];
        for (const msg of messages) {
          const from = msg.from as string; // E.164 without a leading '+'
          const text: string =
            msg.text?.body ?? msg.button?.text ?? msg.interactive?.button_reply?.title ?? '';
          if (!from || !text) continue;

          const reply = await advanceSession(from, text, msg.id);
          await sendWhatsAppText(from, reply);
        }
      }
    }
  } catch (error) {
    console.error('[whatsapp-webhook] failed to process inbound message', error);
  }
});

async function sendWhatsAppText(to: string, body: string) {
  if (!env.WHATSAPP_TOKEN || !env.WHATSAPP_PHONE_NUMBER_ID) {
    console.error('[whatsapp-webhook] WHATSAPP_TOKEN/WHATSAPP_PHONE_NUMBER_ID not configured, cannot reply');
    return;
  }

  const response = await fetch(
    `https://graph.facebook.com/v20.0/${env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.WHATSAPP_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ messaging_product: 'whatsapp', to, type: 'text', text: { body } })
    }
  );

  if (!response.ok) {
    console.error('[whatsapp-webhook] failed to send reply', response.status, await response.text());
  }
}
