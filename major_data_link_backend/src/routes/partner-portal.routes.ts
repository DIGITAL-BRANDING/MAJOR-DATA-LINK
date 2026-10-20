import bcrypt from 'bcryptjs';
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { syncResendContact } from '../lib/resend-contacts.js';
import { koboToNaira } from '../lib/money.js';
import { clearLockout, isLocked, recordFailure } from '../lib/lockout.js';
import {
  issuePartnerAuthTokens,
  revokePartnerRefreshToken,
  rotatePartnerRefreshToken
} from '../lib/auth-token.js';
import { createPartnerApiKey } from '../lib/partner-api-key.js';
import { getPartnerActivitySummary } from '../services/partner-wallet.service.js';
import { requirePartnerSession } from '../middleware/partner-auth.js';
import { ApiError } from '../middleware/error.js';
import {
  configurePartnerWebhook,
  queuePartnerWebhookTest,
  retryFailedPartnerTransactionWebhooks,
  retryPartnerWebhookDelivery,
  webhookConfiguration
} from '../services/partner-webhook.service.js';
import {
  createPartnerDynamicFunding,
  partnerFundingResponse,
  partnerBvnFromBody,
  provisionPartnerVirtualAccount,
  verifyPartnerFunding
} from '../services/partner-funding.service.js';
import { PartnerWebhookDeliveryStatus, Prisma, TransactionStatus, TransactionType } from '@prisma/client';
import { listPartnerEnterprisePrices } from '../services/partner-enterprise-catalog.service.js';
import { getPartnerAccessSummary } from '../services/partner-access.service.js';
import { createEnterpriseOfferCode, ensurePartnerEnterpriseOfferCode } from '../services/partner-enterprise-profile.service.js';

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

async function partnerProfile(partner: {
  id: string;
  businessName: string;
  email: string;
  phone: string | null;
  contactName?: string | null;
  companyRegistrationNumber?: string | null;
  businessType?: string | null;
  websiteUrl?: string | null;
  useCase?: string | null;
  expectedMonthlyVolume?: number | null;
  requestedServices?: unknown;
  integrationEnvironment?: string | null;
  technicalContactEmail?: string | null;
  technicalContactPhone?: string | null;
  enterpriseOfferCode?: string | null;
  status: string;
  walletBalanceKobo: bigint;
  createdAt: Date;
}) {
  const enterpriseOfferCode = partner.enterpriseOfferCode ?? await ensurePartnerEnterpriseOfferCode(partner.id);
  return {
    id: partner.id,
    business_name: partner.businessName,
    email: partner.email,
    phone: partner.phone,
    enterprise_offer_code: enterpriseOfferCode,
    enterprise_profile: {
      contact_name: partner.contactName ?? null,
      company_registration_number: partner.companyRegistrationNumber ?? null,
      business_type: partner.businessType ?? null,
      website_url: partner.websiteUrl ?? null,
      use_case: partner.useCase ?? null,
      expected_monthly_volume: partner.expectedMonthlyVolume ?? null,
      requested_services: partner.requestedServices ?? [],
      integration_environment: partner.integrationEnvironment ?? null,
      technical_contact_email: partner.technicalContactEmail ?? null,
      technical_contact_phone: partner.technicalContactPhone ?? null
    },
    status: partner.status.toLowerCase(),
    wallet_balance: koboToNaira(partner.walletBalanceKobo),
    api_access: await getPartnerAccessSummary(partner.id, partner.walletBalanceKobo),
    created_at: partner.createdAt.toISOString()
  };
}

partnerPortalRoutes.post('/register', async (req, res) => {
  const body = z
    .object({
      business_name: z.string().trim().min(2).max(160),
      contact_name: z.string().trim().min(2).max(120).optional(),
      contact_phone: z.string().trim().min(6).max(30).optional(),
      email: z.string().trim().email().transform((value) => value.toLowerCase()),
      company_registration_number: z.string().trim().max(80).optional(),
      business_type: z.string().trim().max(80).optional(),
      website_url: z.string().trim().url().max(255).optional(),
      use_case: z.string().trim().max(2_000).optional(),
      expected_monthly_volume: z.coerce.number().int().min(1).max(10_000_000).optional(),
      requested_services: z.array(z.string().trim().min(1).max(80)).max(40).optional(),
      integration_environment: z.enum(['sandbox', 'production', 'both']).optional(),
      technical_contact_email: z.string().trim().email().transform((value) => value.toLowerCase()).optional(),
      technical_contact_phone: z.string().trim().min(6).max(30).optional(),
      password: z.string().min(8).max(200)
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
      contactName: body.contact_name ?? null,
      companyRegistrationNumber: body.company_registration_number ?? null,
      businessType: body.business_type ?? null,
      websiteUrl: body.website_url ?? null,
      useCase: body.use_case ?? null,
      expectedMonthlyVolume: body.expected_monthly_volume ?? null,
      requestedServices: body.requested_services ?? [],
      integrationEnvironment: body.integration_environment ?? 'sandbox',
      technicalContactEmail: body.technical_contact_email ?? null,
      technicalContactPhone: body.technical_contact_phone ?? null,
      enterpriseOfferCode: createEnterpriseOfferCode(),
      passwordHash,
      lastPortalLoginAt: new Date()
    }
  });

  void syncResendContact('partner', { id: partner.id, email: partner.email, name: partner.businessName, resendContactId: partner.resendContactId }).catch(() => {});

  const tokens = await issuePartnerAuthTokens(partner);
  res.status(201).json({
    status: true,
    data: {
      access_token: tokens.accessToken,
      refresh_token: tokens.refreshToken,
      expires_in: tokens.expiresIn,
      partner: await partnerProfile(partner)
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

  const cleared = clearLockout();
  await prisma.partner.update({
    where: { id: partner.id },
    data: {
      passwordFailures: cleared.failures,
      passwordLockedUntil: cleared.lockedUntil,
      passwordFailureAt: cleared.failureAt,
      lastPortalLoginAt: new Date()
    }
  });

  const tokens = await issuePartnerAuthTokens(partner);
  res.json({
    status: true,
    data: {
      access_token: tokens.accessToken,
      refresh_token: tokens.refreshToken,
      expires_in: tokens.expiresIn,
      partner: await partnerProfile(partner)
    }
  });
});

partnerPortalRoutes.post('/refresh', async (req, res) => {
  const body = z.object({ refresh_token: z.string().min(1) }).parse(req.body);
  const { partner, tokens } = await rotatePartnerRefreshToken(body.refresh_token);
  res.json({
    status: true,
    data: { access_token: tokens.accessToken, refresh_token: tokens.refreshToken, expires_in: tokens.expiresIn, partner: await partnerProfile(partner) }
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
  res.json({ status: true, data: { ...(await partnerProfile(partner)), webhook } });
});

// ── Notifications ───────────────────────────────────────────────────
// Partner-portal counterpart of notification.routes.ts - every query below
// is scoped to req.partner!.id from the verified session token, never to a
// body/query param, so one partner can never read or mutate another
// partner's notifications. See notifyPartner/fanOutPartnerBroadcast in
// notification.service.ts for how rows land here.
partnerPortalRoutes.get('/notifications', requirePartnerSession, async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 50, 100);

  const notifications = await prisma.partnerNotification.findMany({
    where: { partnerId: req.partner!.id },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: limit
  });

  res.json({
    status: true,
    data: notifications.map((n) => ({
      id: n.id,
      title: n.title,
      body: n.body,
      type: n.type.toLowerCase(),
      is_read: n.isRead,
      broadcast_id: n.broadcastId,
      is_persistent_broadcast: n.broadcastId !== null,
      data: n.data,
      image_key: n.imageKey,
      show_as_popup: n.showAsPopup,
      created_at: n.createdAt.toISOString()
    }))
  });
});

partnerPortalRoutes.post('/notifications/read', requirePartnerSession, async (req, res) => {
  const body = z.object({ ids: z.array(z.string()).optional() }).parse(req.body ?? {});

  await prisma.partnerNotification.updateMany({
    where: {
      partnerId: req.partner!.id,
      // Same reasoning as notification.routes.ts's '/read': an admin
      // broadcast's "current" status is decided purely by recency on the
      // client (see PartnerNotificationPopup), not by isRead, so dismissing
      // one never marks it read here.
      broadcastId: null,
      ...(body.ids && body.ids.length > 0 ? { id: { in: body.ids } } : {})
    },
    data: { isRead: true, readAt: new Date() }
  });

  res.json({ status: true, message: 'Notifications marked as read' });
});

// GET /transactions below (in the "Dashboard" section further down) is a
// superset of what this used to do - search + more columns - so the
// dashboard UI calls that instead of a separate "recent" endpoint.

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

partnerPortalRoutes.post('/api-keys/:id/rotate', requirePartnerSession, async (req, res) => {
  const keyId = String(req.params.id);
  const body = z.object({ name: z.string().trim().min(1).max(80).optional() }).parse(req.body ?? {});
  const partner = await prisma.partner.findUniqueOrThrow({ where: { id: req.partner!.id } });
  if (partner.status !== 'ACTIVE') {
    throw new ApiError(403, 'Your account is not active yet.', 'PARTNER_NOT_ACTIVE');
  }
  const current = await prisma.partnerApiKey.findUnique({ where: { id: keyId } });
  if (!current || current.partnerId !== partner.id) {
    throw new ApiError(404, 'API key not found', 'API_KEY_NOT_FOUND');
  }
  if (current.revokedAt) {
    throw new ApiError(409, 'This API key has already been revoked.', 'API_KEY_ALREADY_REVOKED');
  }

  const replacement = createPartnerApiKey();
  await prisma.$transaction([
    prisma.partnerApiKey.update({ where: { id: current.id }, data: { revokedAt: new Date() } }),
    prisma.partnerApiKey.create({
      data: {
        partnerId: partner.id,
        name: body.name ?? `${current.name} (rotated)`,
        keyPrefix: replacement.keyPrefix,
        secretHash: replacement.secretHash
      }
    })
  ]);

  res.status(201).json({
    status: true,
    message: 'API key rotated. The previous key is now revoked.',
    data: { key: replacement.plaintext, key_prefix: replacement.keyPrefix }
  });
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
  const partner = await provisionPartnerVirtualAccount(req.partner!.id, partnerBvnFromBody(req.body));
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

partnerPortalRoutes.post('/webhook/retry-failed', requirePartnerSession, async (req, res) => {
  const result = await retryFailedPartnerTransactionWebhooks(req.partner!.id);
  res.json({ status: true, data: result });
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

partnerPortalRoutes.get('/webhook/health', requirePartnerSession, async (req, res) => {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const where = { partnerId: req.partner!.id, createdAt: { gte: since } };
  const [configuration, total, delivered, failed, pending, processing, lastDelivery, lastFailure, responseCodes] = await Promise.all([
    webhookConfiguration(req.partner!.id),
    prisma.partnerWebhookDelivery.count({ where }),
    prisma.partnerWebhookDelivery.count({ where: { ...where, status: PartnerWebhookDeliveryStatus.DELIVERED } }),
    prisma.partnerWebhookDelivery.count({ where: { ...where, status: PartnerWebhookDeliveryStatus.FAILED } }),
    prisma.partnerWebhookDelivery.count({ where: { ...where, status: PartnerWebhookDeliveryStatus.PENDING } }),
    prisma.partnerWebhookDelivery.count({ where: { ...where, status: PartnerWebhookDeliveryStatus.PROCESSING } }),
    prisma.partnerWebhookDelivery.findFirst({ where: { partnerId: req.partner!.id }, orderBy: { createdAt: 'desc' }, select: { event: true, status: true, attemptCount: true, lastResponseStatus: true, createdAt: true, deliveredAt: true } }),
    prisma.partnerWebhookDelivery.findFirst({ where: { partnerId: req.partner!.id, status: PartnerWebhookDeliveryStatus.FAILED }, orderBy: { createdAt: 'desc' }, select: { event: true, attemptCount: true, lastResponseStatus: true, lastError: true, createdAt: true } }),
    prisma.partnerWebhookDelivery.groupBy({ by: ['lastResponseStatus'], where, _count: { _all: true } })
  ]);
  const rate = total === 0 ? null : Math.round((delivered / total) * 1000) / 10;
  res.json({
    status: true,
    data: {
      configured: configuration.configured,
      window_days: 30,
      total,
      delivered,
      failed,
      pending,
      processing,
      delivery_rate: rate,
      response_codes: responseCodes.map((row) => ({ status: row.lastResponseStatus, count: row._count._all })),
      last_delivery: lastDelivery ? { event: lastDelivery.event, status: lastDelivery.status.toLowerCase(), attempts: lastDelivery.attemptCount, response_status: lastDelivery.lastResponseStatus, created_at: lastDelivery.createdAt.toISOString(), delivered_at: lastDelivery.deliveredAt?.toISOString() ?? null } : null,
      last_failure: lastFailure ? { event: lastFailure.event, attempts: lastFailure.attemptCount, response_status: lastFailure.lastResponseStatus, error: lastFailure.lastError, created_at: lastFailure.createdAt.toISOString() } : null
    }
  });
});

partnerPortalRoutes.post('/webhook/deliveries/:eventId/retry', requirePartnerSession, async (req, res) => {
  const eventId = z.string().uuid().parse(req.params.eventId);
  const delivery = await retryPartnerWebhookDelivery(req.partner!.id, eventId);
  res.json({ status: true, data: { event_id: delivery.eventId, status: delivery.status.toLowerCase(), attempts: delivery.attemptCount } });
});

// ── Dashboard: metrics, calls-over-time, pricing, searchable history ───
// Everything below is read-only and purely for the portal's own dashboard
// UI - none of this is part of the commercial /api/v1 surface partners
// integrate against programmatically.

partnerPortalRoutes.get('/summary', requirePartnerSession, async (req, res) => {
  const summary = await getPartnerActivitySummary(req.partner!.id);
  res.json({
    status: true,
    data: {
      today_calls: summary.todayCalls,
      total_calls: summary.totalCalls,
      total_spend: summary.totalSpend,
      successful_calls: summary.successfulCalls,
      failed_calls: summary.failedCalls
    }
  });
});

partnerPortalRoutes.get('/calls-overview', requirePartnerSession, async (req, res) => {
  const days = 30;
  const since = new Date();
  since.setDate(since.getDate() - (days - 1));
  since.setHours(0, 0, 0, 0);

  const rows = await prisma.partnerTransaction.findMany({
    where: { partnerId: req.partner!.id, createdAt: { gte: since } },
    select: { createdAt: true }
  });

  // Bucketed in JS rather than a DB date_trunc, since PartnerTransaction
  // rows for a single partner over 30 days is a small enough set that this
  // never needs its own SQL - keeps this endpoint DB-flavor-agnostic.
  const counts = new Map<string, number>();
  for (let i = 0; i < days; i++) {
    const d = new Date(since);
    d.setDate(d.getDate() + i);
    counts.set(d.toISOString().slice(0, 10), 0);
  }
  for (const row of rows) {
    const key = row.createdAt.toISOString().slice(0, 10);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  res.json({ status: true, data: Array.from(counts, ([date, calls]) => ({ date, calls })) });
});

partnerPortalRoutes.get('/pricing', requirePartnerSession, async (_req, res) => {
  // Fixed-rate services use each partner's negotiated enterprise override.
  // Data/airtime plan prices remain provider/catalog-specific.
  const prices = await listPartnerEnterprisePrices(_req.partner!.id);
  res.json({
    status: true,
    data: prices.filter((p) => p.isActive).map((p) => ({ service: p.service, label: p.label, unit_price: p.unitPrice }))
  });
});

const partnerTransactionQuery = z.object({
  search: z.string().trim().max(120).optional(),
  status: z.preprocess((value) => typeof value === 'string' ? value.toUpperCase() : value, z.nativeEnum(TransactionStatus)).optional(),
  type: z.preprocess((value) => typeof value === 'string' ? value.toUpperCase() : value, z.nativeEnum(TransactionType)).optional(),
  from: z.string().date().optional(),
  to: z.string().date().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  offset: z.coerce.number().int().min(0).max(100_000).default(0)
});

function transactionWhere(partnerId: string, query: z.infer<typeof partnerTransactionQuery>): Prisma.PartnerTransactionWhereInput {
  const from = query.from ? new Date(`${query.from}T00:00:00.000Z`) : undefined;
  const to = query.to ? new Date(`${query.to}T23:59:59.999Z`) : undefined;
  const createdAt = from || to ? { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } : undefined;
  const search = query.search;
  return {
    partnerId,
    ...(query.status ? { status: query.status } : {}),
    ...(query.type ? { type: query.type } : {}),
    ...(createdAt ? { createdAt } : {}),
    ...(search ? {
      OR: [
        { reference: { contains: search, mode: 'insensitive' } },
        { providerRef: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } }
      ]
    } : {})
  };
}

/**
 * Keep internal adapter/provider identifiers out of the partner-facing ledger.
 * The portal should show the product name that the partner integrated with,
 * while the raw provider remains available to admins in the internal ledger.
 */
function partnerProviderLabel(provider: string | null): string | null {
  if (!provider) return null;
  const key = provider.toLowerCase().replace(/[\s_-]/g, '');
  if (key === 'techhub') return 'K-Tech Solutions / Musa Verification V1';
  if (key === 'franceverified') return 'Verification V2';
  return provider;
}

function transactionResponse(t: {
  id: string;
  reference: string;
  type: TransactionType;
  status: TransactionStatus;
  amountKobo: bigint;
  costKobo: bigint | null;
  balanceBeforeKobo: bigint;
  balanceAfterKobo: bigint;
  provider: string | null;
  providerRef: string | null;
  idempotencyKey: string;
  description: string;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: t.id,
    reference: t.reference,
    type: t.type.toLowerCase(),
    status: t.status.toLowerCase(),
    amount: koboToNaira(t.amountKobo),
    cost: t.costKobo === null ? null : koboToNaira(t.costKobo),
    balance_before: koboToNaira(t.balanceBeforeKobo),
    balance_after: koboToNaira(t.balanceAfterKobo),
    provider: partnerProviderLabel(t.provider),
    provider_ref: t.providerRef,
    idempotency_key: t.idempotencyKey,
    description: t.description,
    created_at: t.createdAt.toISOString(),
    updated_at: t.updatedAt.toISOString()
  };
}

partnerPortalRoutes.get('/transactions', requirePartnerSession, async (req, res) => {
  const query = partnerTransactionQuery.parse(req.query);
  const where = transactionWhere(req.partner!.id, query);
  const [transactions, total] = await Promise.all([
    prisma.partnerTransaction.findMany({ where, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], skip: query.offset, take: query.limit }),
    prisma.partnerTransaction.count({ where })
  ]);

  res.json({ status: true, data: transactions.map(transactionResponse), meta: { total, limit: query.limit, offset: query.offset, has_more: query.offset + transactions.length < total } });
});

partnerPortalRoutes.get('/transactions.csv', requirePartnerSession, async (req, res) => {
  const query = partnerTransactionQuery.extend({ limit: z.coerce.number().int().min(1).max(10_000).default(10_000) }).parse(req.query);
  const transactions = await prisma.partnerTransaction.findMany({
    where: transactionWhere(req.partner!.id, query),
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: query.limit,
    select: { reference: true, type: true, status: true, amountKobo: true, balanceBeforeKobo: true, balanceAfterKobo: true, provider: true, providerRef: true, description: true, createdAt: true }
  });
  const csvCell = (value: string | number | null) => `"${String(value ?? '').replaceAll('"', '""')}"`;
  const lines = [
    ['Reference', 'Type', 'Status', 'Amount (NGN)', 'Balance Before (NGN)', 'Balance After (NGN)', 'Provider', 'Provider Reference', 'Description', 'Created At'].map(csvCell).join(','),
    ...transactions.map((t) => [t.reference, t.type, t.status, koboToNaira(t.amountKobo), koboToNaira(t.balanceBeforeKobo), koboToNaira(t.balanceAfterKobo), partnerProviderLabel(t.provider), t.providerRef, t.description, t.createdAt.toISOString()].map(csvCell).join(','))
  ];
  res.type('text/csv').set('Content-Disposition', `attachment; filename="partner-transactions-${new Date().toISOString().slice(0, 10)}.csv"`).send(lines.join('\n'));
});

partnerPortalRoutes.get('/transactions/:reference', requirePartnerSession, async (req, res) => {
  const reference = Array.isArray(req.params.reference) ? req.params.reference[0] : req.params.reference;
  type PartnerTransactionWithUpdates = Prisma.PartnerTransactionGetPayload<{
    include: { requestUpdates: { orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], select: { id: true, message: true, createdAt: true } } }
  }>;
  const transaction: PartnerTransactionWithUpdates | null = await prisma.partnerTransaction.findFirst({
    where: { partnerId: req.partner!.id, reference },
    include: { requestUpdates: { orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], select: { id: true, message: true, createdAt: true } } }
  });
  if (!transaction) throw new ApiError(404, 'Transaction not found', 'PARTNER_TRANSACTION_NOT_FOUND');
  res.json({
    status: true,
    data: {
      ...transactionResponse(transaction),
      request_updates: transaction.requestUpdates.map((update) => ({ id: update.id, message: update.message, created_at: update.createdAt.toISOString() }))
    }
  });
});
