import { Router } from 'express';
import { nanoid } from 'nanoid';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { koboToNaira } from '../lib/money.js';
import { requireAuth } from '../middleware/auth.js';
import { paystackService } from '../services/paystack.service.js';
import { createPendingFunding, creditWalletByReference, redeemCoupon } from '../services/wallet.service.js';
import { tryProvisionInstantVirtualAccount } from '../services/kyc.service.js';

export const walletRoutes = Router();

walletRoutes.use(requireAuth);

walletRoutes.get('/balance', async (req, res) => {
  let user = await prisma.user.findUniqueOrThrow({ where: { id: req.user!.id } });

  // Covers users created before this feature existed, and anyone whose
  // signup-time attempt failed transiently. No-ops instantly if already provisioned.
  if (!user.virtualAccountNumber) {
    await tryProvisionInstantVirtualAccount(user.id);
    user = await prisma.user.findUniqueOrThrow({ where: { id: req.user!.id } });
  }

  res.json({
    balance: koboToNaira(user.walletBalanceKobo),
    currency: 'NGN',
    virtual_account_number: user.virtualAccountNumber,
    virtual_account_bank: user.virtualAccountBank
  });
});

walletRoutes.get('/virtual-account', async (req, res) => {
  let user = await prisma.user.findUniqueOrThrow({ where: { id: req.user!.id } });

  if (!user.virtualAccountNumber) {
    await tryProvisionInstantVirtualAccount(user.id);
    user = await prisma.user.findUniqueOrThrow({ where: { id: req.user!.id } });
  }

  res.json({
    balance: koboToNaira(user.walletBalanceKobo),
    currency: 'NGN',
    virtual_account_number: user.virtualAccountNumber,
    virtual_account_bank: user.virtualAccountBank
  });
});

walletRoutes.post('/fund', async (req, res) => {
  const body = z.object({
    amount: z.number().positive(),
    payment_method: z.string().optional()
  }).parse(req.body);

  const user = await prisma.user.findUniqueOrThrow({ where: { id: req.user!.id } });
  const reference = `IDS-FUND-${Date.now()}-${nanoid(8).toUpperCase()}`;

  // Record the attempt as PENDING first — the wallet balance only changes once
  // Paystack confirms payment via webhook (or the /fund/verify fallback below).
  await createPendingFunding({
    userId: user.id,
    amount: body.amount,
    reference,
    metadata: { payment_method: body.payment_method ?? 'card' }
  });

  const paystack = await paystackService.initializeTransaction({
    email: user.email,
    amountKobo: BigInt(Math.round(body.amount * 100)),
    reference
  });

  res.json({
    status: true,
    message: 'Payment initialized',
    data: {
      amount: body.amount,
      reference,
      authorization_url: paystack.authorization_url
    }
  });
});

/**
 * Fallback for the rare case a Paystack webhook doesn't arrive (network blip, server
 * restart mid-delivery). The Flutter app should call this after the payment webview
 * redirects back, so the wallet is credited even if the webhook is delayed or lost.
 * Safe to call repeatedly — creditWalletByReference is idempotent.
 */
walletRoutes.post('/fund/verify', async (req, res) => {
  const body = z.object({ reference: z.string() }).parse(req.body);

  const transaction = await prisma.transaction.findFirst({
    where: { reference: body.reference, userId: req.user!.id }
  });
  if (!transaction) {
    return res.status(404).json({ status: false, message: 'Transaction not found' });
  }

  const verified = await paystackService.verifyTransaction(body.reference);
  if (verified.status === 'success') {
    const updated = await creditWalletByReference(body.reference);
    return res.json({
      status: true,
      message: 'Wallet funded',
      data: { balance: koboToNaira(updated.balanceAfterKobo) }
    });
  }

  res.json({ status: false, message: `Payment ${verified.status}` });
});

/**
 * "Dynamic Account" — a one-time account number tied to this exact amount,
 * matching the Alrahuz "Dynamic Account" tab (temporary, dies after use/expiry).
 * Uses Paystack's Pay with Transfer channel instead of a Dedicated Virtual Account.
 */
walletRoutes.post('/fund/dynamic', async (req, res) => {
  const body = z.object({ amount: z.number().positive() }).parse(req.body);

  const user = await prisma.user.findUniqueOrThrow({ where: { id: req.user!.id } });
  const amountKobo = BigInt(Math.round(body.amount * 100));

  const charge = await paystackService.createTemporaryTransferAccount({
    email: user.email,
    amountKobo
  });

  // Record the attempt as PENDING using Paystack's own reference for this charge —
  // the webhook (or /fund/verify) credits the wallet once the transfer lands.
  await createPendingFunding({
    userId: user.id,
    amount: body.amount,
    reference: charge.reference,
    metadata: { payment_method: 'dynamic_transfer', account_number: charge.account_number }
  });

  res.json({
    status: true,
    message: 'Transfer this exact amount to the account below to fund your wallet',
    data: {
      amount: body.amount,
      reference: charge.reference,
      account_number: charge.account_number,
      account_name: charge.account_name,
      bank_name: charge.bank?.name,
      expires_at: charge.account_expires_at
    }
  });
});

/** "Fund with Coupon" — redeems a prepaid code for its face value. */
walletRoutes.post('/coupon/redeem', async (req, res) => {
  const body = z.object({ code: z.string().trim().min(4) }).parse(req.body);
  const result = await redeemCoupon(req.user!.id, body.code);
  res.json({
    status: true,
    message: 'Coupon redeemed',
    data: { balance: result.balanceAfter }
  });
});

// NOTE: transfer-to-another-user was removed (both the /wallet/transfer
// endpoint that used to live here and its dashboard button) - it was only
// ever a scaffold that validated the PIN and returned a fake "success"
// without moving any money, reachable directly by anyone calling the API
// even after the UI button was pulled. If this feature comes back, it needs
// a real implementation (recipient lookup, atomic debit+credit in one
// transaction, idempotency) - not resurrecting this stub.
