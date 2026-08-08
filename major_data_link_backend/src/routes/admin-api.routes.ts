import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { dataPlanPricingService } from '../services/data-plan-pricing.service.js';
import { providerService } from '../services/provider.service.js';
import { sendAdminBroadcast } from '../services/notification.service.js';
import { listServicePricesForAdmin, updateServicePrice } from '../services/result-pin.service.js';
import { logAdminAction } from '../admin/audit.js';
import { requireAppAdmin, requireFinanceAdmin } from '../middleware/admin-auth.js';

export const adminApiRoutes = Router();

adminApiRoutes.use(requireAppAdmin);

function routeParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value ?? '';
}

adminApiRoutes.get('/me', (req, res) => {
  res.json({ status: true, data: { admin: req.admin } });
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

adminApiRoutes.post('/provider-balance/refresh', requireFinanceAdmin, async (_req, res) => {
  await providerService.refreshBalance();
  const rows = await prisma.providerBalanceStatus.findMany({ orderBy: { provider: 'asc' } });
  const payload = providerBalancePayload(rows);
  res.json({ status: true, message: 'Alrahuz balance refreshed', data: payload.balances, funding_account: payload.funding_account });
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
  const rows = await listServicePricesForAdmin();
  res.json({ status: true, data: rows });
});

adminApiRoutes.patch('/service-prices/:service', requireFinanceAdmin, async (req, res) => {
  const body = z.object({
    selling_price: z.number().positive().nullable().optional(),
    provider_cost: z.number().positive().optional(),
    is_active: z.boolean().optional()
  }).parse(req.body);

  const row = await updateServicePrice(routeParam(req.params.service).toUpperCase(), {
    sellingPrice: body.selling_price,
    providerCost: body.provider_cost,
    isActive: body.is_active
  });

  res.json({
    status: true,
    data: {
      service: row.service,
      label: row.label,
      provider_cost: Number(row.providerCostKobo) / 100,
      selling_price: row.sellingPriceKobo ? Number(row.sellingPriceKobo) / 100 : null,
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
    type: z.enum(['TRANSACTION', 'WALLET', 'KYC', 'PROMO', 'ADMIN_BROADCAST', 'SYSTEM']).optional()
  }).parse(req.body);

  const broadcast = await sendAdminBroadcast({
    adminId: req.admin!.id,
    title: body.title,
    body: body.body,
    audience: body.audience,
    userIds: body.user_ids,
    type: body.type
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


