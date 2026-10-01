import { Router } from 'express';
import { z } from 'zod';
import { TransactionStatus, TransactionType } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { dataPlanPricingService } from '../services/data-plan-pricing.service.js';
import { providerService } from '../services/provider.service.js';
import * as bilalsadasub from '../services/bilalsadasub.service.js';
import { PROMO_ILLUSTRATIONS, sendAdminBroadcast } from '../services/notification.service.js';
import { listServicePricesForAdmin, updateServicePrice } from '../services/result-pin.service.js';
import { listVerificationPricesForAdmin } from '../services/verification.service.js';
import { listCacPricesForAdmin } from '../services/cac.service.js';
import { listBvnModificationPricesForAdmin } from '../services/bvn-modification.service.js';
import { listModificationPricesForAdmin } from '../services/nin-modification.service.js';
import { listNewspaperPublicationPriceForAdmin } from '../services/newspaper-publication.service.js';
import { listBirthAttestationPriceForAdmin } from '../services/birth-attestation.service.js';
import { listBvnCrmPriceForAdmin } from '../services/bvn-crm.service.js';
import { listJambPricesForAdmin } from '../services/jamb-pricing.service.js';
import { listBvnLicensePriceForAdmin } from '../services/bvn-license-onboarding.service.js';
import { partnerLookupPayload } from '../admin/partner-lookup.js';
import { logAdminAction } from '../admin/audit.js';
import { requireAppAdmin, requireFinanceAdmin } from '../middleware/admin-auth.js';
import { createUserDelivery } from '../services/user-delivery.service.js';
import { notifyUser } from '../services/notification.service.js';
import { sendAdminEmail } from '../lib/email.js';

export const adminApiRoutes = Router();

adminApiRoutes.use(requireAppAdmin);

adminApiRoutes.post('/emails/send', requireFinanceAdmin, async (req, res) => {
  const body = z.object({ audience: z.enum(['CUSTOMERS', 'PARTNERS']), recipient_mode: z.enum(['ALL', 'ONE']), recipient_id: z.string().trim().min(1).optional(), subject: z.string().trim().min(3).max(200), message: z.string().trim().min(2).max(10000) }).parse(req.body);
  if (body.recipient_mode === 'ONE' && !body.recipient_id) return res.status(400).json({ status: false, message: 'Recipient ID is required' });
  const whereUser = { accountStatus: 'ACTIVE' as const, ...(body.recipient_mode === 'ONE' ? { id: body.recipient_id! } : {}) };
  const wherePartner = body.recipient_mode === 'ONE' ? { id: body.recipient_id! } : {};
  const recipients = body.audience === 'CUSTOMERS'
    ? (await prisma.user.findMany({ where: whereUser, select: { email: true }, take: body.recipient_mode === 'ONE' ? 1 : 10000 })).map((row) => row.email)
    : (await prisma.partner.findMany({ where: wherePartner, select: { email: true }, take: body.recipient_mode === 'ONE' ? 1 : 10000 })).map((row) => row.email);
  if (body.recipient_mode === 'ONE' && !recipients.length) return res.status(404).json({ status: false, message: 'Recipient not found' });
  if (!recipients.length) return res.status(422).json({ status: false, message: 'No recipients found' });
  if (recipients.length > 100) return res.status(422).json({ status: false, message: 'Please use the admin email composer for audiences larger than 100 recipients' });
  const result = await sendAdminEmail({ recipients, subject: body.subject, message: body.message });
  await logAdminAction({ adminId: req.admin!.id, action: 'SEND_ADMIN_EMAIL', targetType: body.audience, metadata: { audience: body.audience, recipientMode: body.recipient_mode, recipientCount: recipients.length, subject: body.subject, sent: result.sent } });
  if (!result.sent) return res.status(502).json({ status: false, message: result.error ?? 'Email delivery failed' });
  res.json({ status: true, data: { recipient_count: recipients.length } });
});

adminApiRoutes.post('/user-deliveries', requireFinanceAdmin, async (req, res) => {
  const body = z.object({ user_id: z.string().min(1), title: z.string().trim().min(1).max(120), description: z.string().max(500).optional(), file_name: z.string().min(1).max(180), mime_type: z.enum(['application/pdf', 'image/png', 'image/jpeg', 'text/plain']), file_base64: z.string().min(1), reference: z.string().max(120).optional() }).parse(req.body);
  const delivery = await createUserDelivery({ userId: body.user_id, adminId: req.admin!.id, title: body.title, description: body.description, fileName: body.file_name, mimeType: body.mime_type, base64: body.file_base64, reference: body.reference });
  await notifyUser({ userId: body.user_id, type: 'SYSTEM', title: body.title, body: 'A file has been delivered to your dashboard. Open Deliveries to download it.', data: { delivery_id: delivery.id } });
  await logAdminAction({ adminId: req.admin!.id, action: 'CREATE_USER_DELIVERY', targetType: 'UserDelivery', targetId: delivery.id, metadata: { userId: delivery.userId, fileName: delivery.fileName, reference: delivery.reference } });
  res.status(201).json({ status: true, data: { id: delivery.id, user_id: delivery.userId, title: delivery.title, file_name: delivery.fileName, created_at: delivery.createdAt.toISOString() } });
});

function routeParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value ?? '';
}

adminApiRoutes.get('/me', (req, res) => {
  res.json({ status: true, data: { admin: req.admin } });
});

adminApiRoutes.get('/assistant-audit', async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 100, 500);
  const rows = await prisma.assistantAuditEvent.findMany({
    take: limit,
    orderBy: { createdAt: 'desc' },
    select: { id: true, userId: true, intent: true, stage: true, outcome: true, errorCode: true, transactionRef: true, metadata: true, createdAt: true }
  });
  res.json({ status: true, data: rows.map((row) => ({ ...row, created_at: row.createdAt.toISOString() })) });
});

function providerBalancePayload(rows: Awaited<ReturnType<typeof prisma.providerBalanceStatus.findMany>>) {
  const fundingAccount = providerService.getFundingAccount();
  return {
    funding_account: {
      provider: 'alrahuz',
      account_number: fundingAccount.accountNumber,
      account_name: fundingAccount.accountName,
      bank_name: fundingAccount.bankName
    },
    balances: rows.map((r) => ({
      provider: r.provider,
      balance: r.lastKnownBalance,
      last_checked_at: r.lastCheckedAt.toISOString(),
      low_balance_alert_sent_at: r.lowBalanceAlertSentAt?.toISOString() ?? null
    }))
  };
}

adminApiRoutes.get('/provider-balance', requireFinanceAdmin, async (_req, res) => {
  const rows = await prisma.providerBalanceStatus.findMany({ orderBy: { provider: 'asc' } });
  const payload = providerBalancePayload(rows);
  res.json({ status: true, data: payload.balances, funding_account: payload.funding_account });
});

// Only fulfilled services count toward rewards: funding, refunds, transfers
// and manual wallet adjustments must never inflate a customer's usage rank.
const usageTransactionTypes = [
  TransactionType.DATA_PURCHASE,
  TransactionType.AIRTIME_PURCHASE,
  TransactionType.ELECTRICITY_PURCHASE,
  TransactionType.CABLE_PURCHASE,
  TransactionType.RESULT_PIN,
  TransactionType.SMS,
  TransactionType.NIN_VERIFICATION,
  TransactionType.BVN_VERIFICATION,
  TransactionType.IDENTITY_SERVICE_REQUEST,
  TransactionType.NIN_MODIFICATION,
  TransactionType.BVN_LICENSE_ONBOARDING,
  TransactionType.CAC_SERVICE_REQUEST,
  TransactionType.BVN_MODIFICATION,
  TransactionType.BIRTH_ATTESTATION,
  TransactionType.NEWSPAPER_PUBLICATION,
  TransactionType.BVN_CRM,
  TransactionType.JAMB_SERVICE_REQUEST
] as const;

adminApiRoutes.get('/customer-activity', requireFinanceAdmin, async (req, res) => {
  const query = z.object({
    days: z.coerce.number().int().min(1).max(3650).default(30),
    limit: z.coerce.number().int().min(1).max(100).default(20)
  }).parse(req.query);
  const since = new Date(Date.now() - query.days * 24 * 60 * 60 * 1000);
  const activityWhere = {
    createdAt: { gte: since }
  };
  const successfulServicesWhere = {
    ...activityWhere,
    status: TransactionStatus.SUCCESS,
    type: { in: [...usageTransactionTypes] }
  };
  const [grouped, recent, statusGroups] = await Promise.all([
    prisma.transaction.groupBy({ by: ['userId'], where: successfulServicesWhere, _count: { _all: true }, _sum: { amountKobo: true }, _max: { createdAt: true } }),
    prisma.transaction.findMany({
      where: activityWhere, take: query.limit, orderBy: { createdAt: 'desc' },
      select: { id: true, userId: true, type: true, status: true, amountKobo: true, description: true, createdAt: true, user: { select: { fullName: true, email: true } } }
    }),
    prisma.transaction.groupBy({ by: ['status'], where: activityWhere, _count: { _all: true } })
  ]);
  const ranked = [...grouped]
    .sort((a, b) => Number(b._sum.amountKobo ?? 0n) - Number(a._sum.amountKobo ?? 0n))
    .slice(0, query.limit);
  const users = await prisma.user.findMany({
    where: { id: { in: ranked.map((row) => row.userId) } },
    select: { id: true, fullName: true, email: true }
  });
  const usersById = new Map(users.map((user) => [user.id, user]));
  const totalUsageKobo = grouped.reduce((total, row) => total + (row._sum.amountKobo ?? 0n), 0n);
  const totalPurchases = grouped.reduce((total, row) => total + row._count._all, 0);
  const statusCounts = Object.fromEntries(statusGroups.map((row) => [row.status.toLowerCase(), row._count._all]));
  const totalActivities = statusGroups.reduce((total, row) => total + row._count._all, 0);

  res.json({ status: true, data: {
    period_days: query.days,
    summary: { total_activities: totalActivities, activity_statuses: statusCounts, active_customers: grouped.length, successful_service_purchases: totalPurchases, successful_service_spend: Number(totalUsageKobo) / 100 },
    top_customers: ranked.map((row) => {
      const user = usersById.get(row.userId);
      return { user_id: row.userId, full_name: user?.fullName ?? 'Unknown user', email: user?.email ?? '', purchases: row._count._all, total_usage: Number(row._sum.amountKobo ?? 0n) / 100, last_purchase_at: row._max.createdAt?.toISOString() ?? null };
    }),
    recent_activities: recent.map((transaction) => ({
      id: transaction.id, user_id: transaction.userId, full_name: transaction.user.fullName, email: transaction.user.email,
      type: transaction.type, status: transaction.status, description: transaction.description, amount: Number(transaction.amountKobo) / 100, created_at: transaction.createdAt.toISOString()
    }))
  } });
});

adminApiRoutes.post('/provider-balance/refresh', requireFinanceAdmin, async (_req, res) => {
  await providerService.refreshBalance();
  if (bilalsadasub.isConfigured()) await bilalsadasub.refreshBalance();
  const rows = await prisma.providerBalanceStatus.findMany({ orderBy: { provider: 'asc' } });
  const payload = providerBalancePayload(rows);
  res.json({ status: true, message: 'Provider balances refreshed', data: payload.balances, funding_account: payload.funding_account });
});
adminApiRoutes.get('/data-prices', requireFinanceAdmin, async (req, res) => {
  const network = typeof req.query.network === 'string' ? req.query.network : undefined;
  const rows = await dataPlanPricingService.getPricingRows(network);
  res.json({ status: true, data: rows });
});

adminApiRoutes.post('/data-prices/sync/:network', requireFinanceAdmin, async (req, res) => {
  const network = routeParam(req.params.network);
  await providerService.refreshDataPlans(network);
  const rows = await dataPlanPricingService.getPricingRows(network);
  res.json({ status: true, data: rows });
});

adminApiRoutes.patch('/data-prices/:id', requireFinanceAdmin, async (req, res) => {
  const body = z.object({
    selling_price: z.number().positive().nullable().optional(),
    is_active: z.boolean().optional()
  }).parse(req.body);

  const row = await dataPlanPricingService.updatePricing(routeParam(req.params.id), {
    sellingPrice: body.selling_price,
    isActive: body.is_active
  });
  providerService.clearDataPlanCache(row.network);

  res.json({ status: true, data: row });
});


adminApiRoutes.get('/service-prices', requireFinanceAdmin, async (_req, res) => {
  // One list with EVERY ServicePricing-backed service the app sells, so the
  // Flutter admin can retail-price AND partner-price all of them (the same
  // set the web Bulk Pricing / Partner Pricing pages now show). PATCH below
  // is generic (keyed by `service`), so it works unchanged for every row.
  // `group` only exists so the app can section a long list.
  const [resultPinRows, verificationRows, cac, bvnMod, ninMod, newspaper, birth, bvnCrm, jamb, bvnLicense] = await Promise.all([
    listServicePricesForAdmin(),
    listVerificationPricesForAdmin(),
    listCacPricesForAdmin(),
    listBvnModificationPricesForAdmin(),
    listModificationPricesForAdmin(),
    listNewspaperPublicationPriceForAdmin(),
    listBirthAttestationPriceForAdmin(),
    listBvnCrmPriceForAdmin(),
    listJambPricesForAdmin(),
    listBvnLicensePriceForAdmin()
  ]);
  const tag = <T extends object>(rows: T[], group: string) => rows.map((row) => ({ ...row, group }));
  res.json({
    status: true,
    data: [
      ...tag(resultPinRows, 'Result Pin'),
      ...tag(verificationRows, 'NIN/BVN'),
      ...tag(cac, 'CAC'),
      ...tag(bvnMod, 'BVN Modification'),
      ...tag(ninMod, 'NIN Modification'),
      ...tag(newspaper, 'Newspaper'),
      ...tag(birth, 'Birth Attestation'),
      ...tag(bvnCrm, 'BVN CRM'),
      ...tag(jamb, 'JAMB'),
      ...tag(bvnLicense, 'BVN')
    ]
  });
});

// Set one selling price across any selected ServicePricing rows. The list
// endpoint above materialises every supported service first, so this cannot
// accidentally create an arbitrary pricing key supplied by a client.
adminApiRoutes.post('/service-prices/bulk', requireFinanceAdmin, async (req, res) => {
  const body = z.object({
    services: z.array(z.string().trim().min(1)).min(1).max(500),
    selling_price: z.number().positive(),
  }).parse(req.body);
  const uniqueServices = [...new Set(body.services.map((service) => service.toUpperCase()))];
  const result = await prisma.servicePricing.updateMany({
    where: { service: { in: uniqueServices } },
    data: { sellingPriceKobo: BigInt(Math.round(body.selling_price * 100)) },
  });
  if (result.count !== uniqueServices.length) {
    return res.status(422).json({ status: false, message: 'One or more selected services are not price-managed.', code: 'UNKNOWN_SERVICE' });
  }
  await logAdminAction({
    adminId: req.admin!.id,
    action: 'BULK_SET_SERVICE_PRICE',
    targetType: 'ServicePricing',
    metadata: { services: uniqueServices, sellingPrice: body.selling_price },
  });
  res.json({ status: true, data: { updated: result.count, selling_price: body.selling_price } });
});

// V1 and V2 are customer-facing provider variants, each made up of five
// independently-priced tiers. The admin needs one switch per variant rather
// than having to toggle every tier by hand.
adminApiRoutes.patch('/service-prices/families/:family/availability', requireFinanceAdmin, async (req, res) => {
  const family = z.enum(['NIN_VERIFICATION_V1', 'NIN_VERIFICATION_V2']).parse(routeParam(req.params.family).toUpperCase());
  const body = z.object({ is_active: z.boolean() }).parse(req.body);
  const result = await prisma.servicePricing.updateMany({
    where: { service: { startsWith: `${family}_` } },
    data: { isActive: body.is_active }
  });
  await logAdminAction({
    adminId: req.admin!.id,
    action: 'SET_NIN_VERIFICATION_VARIANT_AVAILABILITY',
    targetType: 'ServicePricing',
    metadata: { family, isActive: body.is_active, updated: result.count }
  });
  res.json({ status: true, data: { family, is_active: body.is_active, updated: result.count } });
});

// Partner lookup for the Flutter admin app - JSON twin of /admin/partner-lookup.
// Read-only and open to any admin role (support staff field partner questions
// with this), exactly like the web page's search; wallet credit/debit stays on
// the web panel behind its finance-only guard.
adminApiRoutes.get('/partner-lookup', async (req, res) => {
  const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  if (q.length < 2) {
    return res.status(422).json({ status: false, message: 'Enter at least 2 characters to search', code: 'VALIDATION_ERROR' });
  }
  const data = await partnerLookupPayload(q);
  if (!data) return res.status(404).json({ status: false, message: 'No partner matched that search', code: 'NOT_FOUND' });
  res.json({ status: true, data });
});

adminApiRoutes.patch('/service-prices/:service', requireFinanceAdmin, async (req, res) => {
  const body = z.object({
    selling_price: z.number().positive().nullable().optional(),
    partner_selling_price: z.number().positive().nullable().optional(),
    provider_cost: z.number().positive().optional(),
    is_active: z.boolean().optional(),
    // Which upstream API fulfils this service - see the `provider` property
    // description on the ServicePricing AdminJS resource for the exact
    // recognized values per service family. Not validated against an enum
    // here (ServicePricing.provider is a free-text column so new providers
    // never need a migration) - an unrecognized value simply fails the next
    // purchase loudly (PROVIDER_NOT_IMPLEMENTED) instead of mischarging.
    provider: z.string().trim().toLowerCase().min(1).optional()
  }).parse(req.body);

  const row = await updateServicePrice(routeParam(req.params.service).toUpperCase(), {
    sellingPrice: body.selling_price,
    partnerSellingPrice: body.partner_selling_price,
    providerCost: body.provider_cost,
    isActive: body.is_active,
    provider: body.provider
  });

  res.json({
    status: true,
    data: {
      service: row.service,
      label: row.label,
      provider: row.provider,
      provider_cost: Number(row.providerCostKobo) / 100,
      selling_price: row.sellingPriceKobo ? Number(row.sellingPriceKobo) / 100 : null,
      partner_selling_price: row.partnerSellingPriceKobo ? Number(row.partnerSellingPriceKobo) / 100 : null,
      is_active: row.isActive
    }
  });
});
adminApiRoutes.post('/notifications/broadcast', requireFinanceAdmin, async (req, res) => {
  const body = z.object({
    title: z.string().trim().min(1).max(120),
    body: z.string().trim().min(1).max(1000),
    audience: z.enum(['ALL_USERS', 'SPECIFIC_USERS', 'KYC_VERIFIED_ONLY']).default('ALL_USERS'),
    user_ids: z.array(z.string()).optional(),
    type: z.enum(['TRANSACTION', 'WALLET', 'KYC', 'PROMO', 'ADMIN_BROADCAST', 'SYSTEM']).optional(),
    image_key: z.enum(PROMO_ILLUSTRATIONS.map((i) => i.value) as [string, ...string[]]).optional(),
    show_as_popup: z.boolean().optional()
  }).parse(req.body);

  const broadcast = await sendAdminBroadcast({
    adminId: req.admin!.id,
    title: body.title,
    body: body.body,
    audience: body.audience,
    userIds: body.user_ids,
    type: body.type,
    imageKey: body.image_key,
    showAsPopup: body.show_as_popup
  });

  await logAdminAction({
    adminId: req.admin!.id,
    action: 'SEND_NOTIFICATION_BROADCAST',
    targetType: 'NotificationBroadcast',
    targetId: broadcast.id,
    metadata: { title: body.title, audience: body.audience, recipientCount: broadcast.recipientCount }
  });

  res.json({
    status: true,
    message: `Sent to ${broadcast.recipientCount} user(s)`,
    data: {
      id: broadcast.id,
      title: broadcast.title,
      body: broadcast.body,
      audience: broadcast.audience,
      recipient_count: broadcast.recipientCount,
      created_at: broadcast.createdAt.toISOString()
    }
  });
});

adminApiRoutes.get('/notifications/broadcast', requireFinanceAdmin, async (req, res) => {
  const broadcasts = await prisma.notificationBroadcast.findMany({
    orderBy: { createdAt: 'desc' },
    take: 50,
    include: {
      createdByAdmin: { select: { fullName: true, email: true } },
      _count: { select: { notifications: { where: { isRead: true } } } }
    }
  });

  res.json({
    status: true,
    data: broadcasts.map((b) => ({
      id: b.id,
      title: b.title,
      body: b.body,
      audience: b.audience,
      recipient_count: b.recipientCount,
      read_count: b._count.notifications,
      sent_by: b.createdByAdmin.fullName,
      created_at: b.createdAt.toISOString()
    }))
  });
});


