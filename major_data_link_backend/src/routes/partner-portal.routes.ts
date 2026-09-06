import bcrypt from 'bcryptjs';
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { koboToNaira } from '../lib/money.js';
import { clearLockout, isLocked, recordFailure } from '../lib/lockout.js';
import {
  issuePartnerAuthTokens,
  revokePartnerRefreshToken,
  rotatePartnerRefreshToken
} from '../lib/auth-token.js';
import { createPartnerApiKey } from '../lib/partner-api-key.js';
import { requirePartnerSession } from '../middleware/partner-auth.js';
import { ApiError } from '../middleware/error.js';
import {
  configurePartnerWebhook,
  queuePartnerWebhookTest,
  webhookConfiguration
} from '../services/partner-webhook.service.js';
import {
  createPartnerDynamicFunding,
  partnerFundingResponse,
  provisionPartnerVirtualAccount,
  verifyPartnerFunding
} from '../services/partner-funding.service.js';
import { TransactionType } from '@prisma/client';

/**
 * Self-service partner portal - a normal email+password login for the
 * company itself, completely separate from requirePartnerApiKey (the
 * X-API-Key header their own backend uses to call the commercial API).
 * Modeled on routes/auth.routes.ts's customer register/login/refresh flow
 * (same bcrypt cost, same lockout behavior - see lib/lockout.ts), and on
 * PartnerStatus's doc-comment in schema.prisma for the PENDING_REVIEW gate:
 * anyone can register a company account here, but an admin has to approve
 * it (admin/resources/partner.resource.ts's "Approve Partner" action)
 * before that partner can generate a live API key or have a purchase
 * actually succeed - requirePartnerApiKey already rejects anything but
 * ACTIVE.
 */

export const partnerPortalRoutes = Router();

const MAX_PASSWORD_FAILURES = 5;
const PASSWORD_LOCKOUT_MINUTES = 30;

function partnerProfile(partner: {
  id: string;
  businessName: string;
  email: string;
  phone: string | null;
  status: string;
  walletBalanceKobo: bigint;
  createdAt: Date;
}) {
  return {
    id: partner.id,
    business_name: partner.businessName,
    email: partner.email,
    phone: partner.phone,
    status: partner.status.toLowerCase(),
    wallet_balance: koboToNaira(partner.walletBalanceKobo),
    created_at: partner.createdAt.toISOString()
  };
}

partnerPortalRoutes.post('/register', async (req, res) => {
  const body = z
    .object({
      business_name: z.string().trim().min(2),
      contact_phone: z.string().trim().min(6).optional(),
      email: z.string().trim().email().transform((value) => value.toLowerCase()),
      password: z.string().min(8)
    })
    .parse(req.body);

  const existing = await prisma.partner.findUnique({ where: { email: body.email } });
  if (existing) {
    throw new ApiError(409, 'A partner account already exists with this email', 'ACCOUNT_EXISTS');
  }

  const passwordHash = await bcrypt.hash(body.password, 12);
  // status defaults to PENDING_REVIEW (see schema.prisma) - not usable for
  // live API calls until an admin approves it, but the company can log
  // into the portal immediately and see that status.
  const partner = await prisma.partner.create({
    data: {
      businessName: body.business_name,
      email: body.email,
      phone: body.contact_phone ?? null,
      passwordHash
    }
  });

  const tokens = await issuePartnerAuthTokens(partner);
  res.status(201).json({
    status: true,
    data: {
      access_token: tokens.accessToken,
      refresh_token: tokens.refreshToken,
      expires_in: tokens.expiresIn,
      partner: partnerProfile(partner)
    }
  });
});

partnerPortalRoutes.post('/login', async (req, res) => {
  const body = z.object({ email: z.string().trim().email(), password: z.string().min(1) }).parse(req.body);
  const email = body.email.toLowerCase();

  const partner = await prisma.partner.findUnique({ where: { email } });
  if (!partner || !partner.passwordHash) {
    throw new ApiError(401, 'Invalid email or password', 'INVALID_CREDENTIALS');
  }

  if (isLocked(partner.passwordLockedUntil)) {
    throw new ApiError(
      423,
      'Too many failed login attempts. Try again in a bit, or ask an admin to reset your portal password.',
      'PASSWORD_LOCKED'
    );
  }

  const ok = await bcrypt.compare(body.password, partner.passwordHash);
  if (!ok) {
    const next = recordFailure(
      { failures: partner.passwordFailures, failureAt: partner.passwordFailureAt },
      { maxFailures: MAX_PASSWORD_FAILURES, lockoutMinutes: PASSWORD_LOCKOUT_MINUTES }
    );
    await prisma.partner.update({
      where: { id: partner.id },
      data: { passwordFailures: next.failures, passwordLockedUntil: next.lockedUntil, passwordFailureAt: next.failureAt }
    });
    throw new ApiError(401, 'Invalid email or password', 'INVALID_CREDENTIALS');
  }

  if (partner.passwordFailures > 0 || partner.passwordLockedUntil) {
    const cleared = clearLockout();
    await prisma.partner.update({
      where: { id: partner.id },
      data: { passwordFailures: cleared.failures, passwordLockedUntil: cleared.lockedUntil, passwordFailureAt: cleared.failureAt }
    });
  }

  const tokens = await issuePartnerAuthTokens(partner);
  res.json({
    status: true,
    data: {
      access_token: tokens.accessToken,
      refresh_token: tokens.refreshToken,
      expires_in: tokens.expiresIn,
      partner: partnerProfile(partner)
    }
  });
});

partnerPortalRoutes.post('/refresh', async (req, res) => {
  const body = z.object({ refresh_token: z.string().min(1) }).parse(req.body);
  const { partner, tokens } = await rotatePartnerRefreshToken(body.refresh_token);
  res.json({
    status: true,
    data: { access_token: tokens.accessToken, refresh_token: tokens.refreshToken, expires_in: tokens.expiresIn, partner: partnerProfile(partner) }
  });
});

partnerPortalRoutes.post('/logout', requirePartnerSession, async (req, res) => {
  const body = z.object({ refresh_token: z.string().min(1) }).parse(req.body);
  await revokePartnerRefreshToken(body.refresh_token);
  res.json({ status: true, message: 'Logged out' });
});

partnerPortalRoutes.get('/me', requirePartnerSession, async (req, res) => {
  const partner = await prisma.partner.findUniqueOrThrow({ where: { id: req.partner!.id } });
  const webhook = await webhookConfiguration(partner.id);
  res.json({ status: true, data: { ...partnerProfile(partner), webhook } });
});

partnerPortalRoutes.get('/recent-transactions', requirePartnerSession, async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 20, 50);
  const transactions = await prisma.partnerTransaction.findMany({
    where: { partnerId: req.partner!.id },
    orderBy: { createdAt: 'desc' },
    take: limit
  });
  res.json({
    status: true,
    data: transactions.map((t) => ({
      reference: t.reference,
      type: t.type.toLowerCase(),
      status: t.status.toLowerCase(),
      amount: koboToNaira(t.amountKobo),
      description: t.description,
      created_at: t.createdAt.toISOString()
    }))
  });
});

// ── Self-service API key management ──────────────────────────────────
// Everything below requires an ACTIVE partner - a PENDING_REVIEW company
// can log in and see its status (via /me above) but can't generate a live
// key until an admin approves it (see this file's top doc-comment).

partnerPortalRoutes.get('/api-keys', requirePartnerSession, async (req, res) => {
  const keys = await prisma.partnerApiKey.findMany({
    where: { partnerId: req.partner!.id },
    orderBy: { createdAt: 'desc' }
  });
  res.json({
    status: true,
    data: keys.map((k) => ({
      id: k.id,
      name: k.name,
      key_prefix: k.keyPrefix,
      last_used_at: k.lastUsedAt?.toISOString() ?? null,
      revoked_at: k.revokedAt?.toISOString() ?? null,
      created_at: k.createdAt.toISOString()
    }))
  });
});

partnerPortalRoutes.post('/api-keys', requirePartnerSession, async (req, res) => {
  const body = z.object({ name: z.string().trim().min(1).max(80).optional() }).parse(req.body ?? {});
  const partner = await prisma.partner.findUniqueOrThrow({ where: { id: req.partner!.id } });
  if (partner.status !== 'ACTIVE') {
    throw new ApiError(
      403,
      'Your account is not active yet. An admin needs to approve your registration before you can generate a live API key.',
      'PARTNER_NOT_ACTIVE'
    );
  }

  // No hard cap on live keys per partner today (mirrors the admin "Create
  // API Key" action, which also allows any number) - a partner rotating
  // keys across multiple services/environments is a normal, expected use
  // case, not something to restrict here.
  const key = createPartnerApiKey();
  await prisma.partnerApiKey.create({
    data: { partnerId: partner.id, name: body.name ?? 'Live key', keyPrefix: key.keyPrefix, secretHash: key.secretHash }
  });

  res.status(201).json({
    status: true,
    // Shown once - same rule as the admin-issued key. Nothing else in this
    // response or any later one ever includes the plaintext again.
    data: { key: key.plaintext, key_prefix: key.keyPrefix }
  });
});

partnerPortalRoutes.post('/api-keys/:id/revoke', requirePartnerSession, async (req, res) => {
  const keyId = String(req.params.id);
  const key = await prisma.partnerApiKey.findUnique({ where: { id: keyId } });
  if (!key || key.partnerId !== req.partner!.id) {
    throw new ApiError(404, 'API key not found', 'API_KEY_NOT_FOUND');
  }
  await prisma.partnerApiKey.update({ where: { id: key.id }, data: { revokedAt: new Date() } });
  res.json({ status: true, message: 'API key revoked' });
});

// ── Wallet funding + webhook configuration ──────────────────────────────
// Thin session-authenticated mirrors of the same-named /api/v1 endpoints
// (partner-api.routes.ts), calling the exact same service functions - so
// the portal UI never needs a live API key for anything at all. The /api/v1
// versions stay exactly as they are, for a partner's own backend to call
// directly if it prefers (e.g. to provision a funding account
// programmatically instead of through this UI).

partnerPortalRoutes.get('/wallet', requirePartnerSession, async (req, res) => {
  const partner = await prisma.partner.findUniqueOrThrow({ where: { id: req.partner!.id } });
  res.json({ status: true, data: partnerFundingResponse(partner) });
});

partnerPortalRoutes.post('/wallet/funding-account', requirePartnerSession, async (req, res) => {
  const partner = await provisionPartnerVirtualAccount(req.partner!.id);
  res.json({ status: true, message: 'Partner funding account is ready', data: partnerFundingResponse(partner) });
});

partnerPortalRoutes.post('/wallet/fund/dynamic', requirePartnerSession, async (req, res) => {
  const body = z.object({ amount: z.number().positive().max(5_000_000) }).parse(req.body);
  const funding = await createPartnerDynamicFunding(req.partner!.id, body.amount);
  res.status(201).json({
    status: true,
    message: 'Transfer this exact amount to fund your partner wallet',
    data: {
      amount: body.amount,
      reference: funding.reference,
      account_number: funding.accountNumber,
      account_name: funding.accountName,
      bank_name: funding.bankName ?? null,
      expires_at: funding.expiresAt ?? null
    }
  });
});

partnerPortalRoutes.post('/wallet/fund/verify', requirePartnerSession, async (req, res) => {
  const body = z.object({ reference: z.string().trim().min(1) }).parse(req.body);
  const owned = await prisma.partnerTransaction.findFirst({
    where: { partnerId: req.partner!.id, reference: body.reference, type: TransactionType.WALLET_FUNDING }
  });
  if (!owned) throw new ApiError(404, 'Partner funding transaction not found', 'PARTNER_FUNDING_NOT_FOUND');
  const result = await verifyPartnerFunding(body.reference);
  res.json({
    status: result.status === 'success',
    message: result.status === 'success' ? 'Partner wallet funded' : `Payment ${result.status}`,
    data: partnerFundingResponse(await prisma.partner.findUniqueOrThrow({ where: { id: req.partner!.id } }))
  });
});

partnerPortalRoutes.get('/webhook', requirePartnerSession, async (req, res) => {
  res.json({ status: true, data: await webhookConfiguration(req.partner!.id) });
});

partnerPortalRoutes.post('/webhook', requirePartnerSession, async (req, res) => {
  const body = z.object({ webhook_url: z.string().trim().url().max(2048) }).parse(req.body);
  const config = await configurePartnerWebhook(req.partner!.id, body.webhook_url);
  res.status(201).json({
    status: true,
    message: 'Webhook configured. Save the secret now; it will not be shown again.',
    data: { webhook_url: config.webhookUrl, webhook_secret: config.secret }
  });
});

partnerPortalRoutes.post('/webhook/test', requirePartnerSession, async (req, res) => {
  const delivery = await queuePartnerWebhookTest(req.partner!.id);
  if (!delivery) {
    throw new ApiError(422, 'Configure a webhook URL before sending a test event.', 'WEBHOOK_NOT_CONFIGURED');
  }
  res.status(202).json({
    status: true,
    message: 'Webhook test queued',
    data: { event_id: delivery.eventId, status: delivery.status.toLowerCase(), attempts: delivery.attemptCount }
  });
});

partnerPortalRoutes.get('/webhook/deliveries', requirePartnerSession, async (req, res) => {
  const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);
  const rows = await prisma.partnerWebhookDelivery.findMany({
    where: { partnerId: req.partner!.id },
    orderBy: { createdAt: 'desc' },
    take: limit
  });
  res.json({
    status: true,
    data: rows.map((row) => ({
      event_id: row.eventId,
      event: row.event,
      status: row.status.toLowerCase(),
      attempts: row.attemptCount,
      response_status: row.lastResponseStatus,
      last_error: row.lastError,
      created_at: row.createdAt.toISOString(),
      delivered_at: row.deliveredAt?.toISOString() ?? null,
      next_attempt_at: row.status === 'PENDING' ? row.nextAttemptAt.toISOString() : null
    }))
  });
});
