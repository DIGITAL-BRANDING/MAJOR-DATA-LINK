import crypto from 'node:crypto';
import { Router } from 'express';
import { env } from '../config/env.js';
import { prisma } from '../lib/prisma.js';
import { creditDirectDeposit, creditWalletByReference, markFundingFailed } from '../services/wallet.service.js';
import { paystackService } from '../services/paystack.service.js';

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
          await creditWalletByReference(reference);
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
