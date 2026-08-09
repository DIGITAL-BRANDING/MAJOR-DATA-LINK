import crypto from 'node:crypto';
import { Router } from 'express';
import { env } from '../config/env.js';
import { prisma } from '../lib/prisma.js';
import { creditDirectDeposit, creditWalletByReference, markFundingFailed } from '../services/wallet.service.js';
import { paystackService } from '../services/paystack.service.js';
import { advanceSession } from '../services/whatsapp-session.service.js';

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
