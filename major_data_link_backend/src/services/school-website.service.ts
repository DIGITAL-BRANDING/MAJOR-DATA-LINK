import { Prisma, TransactionStatus, TransactionType } from '@prisma/client';
import { koboToNaira } from '../lib/money.js';
import { sealPII } from '../lib/pii.js';
import { prisma } from '../lib/prisma.js';
import { ApiError } from '../middleware/error.js';
import { debitWallet } from './wallet.service.js';

export const SCHOOL_WEBSITE_DEMO_URL = 'https://edutracng.netlify.app/';
export const SCHOOL_WEBSITE_PLANS = {
  MONTHLY: { label: 'Monthly', months: 1, service: 'SCHOOL_WEBSITE_MONTHLY', samplePrice: 15000 },
  TERMLY: { label: 'Termly (3 months)', months: 3, service: 'SCHOOL_WEBSITE_TERMLY', samplePrice: 40000 },
  ANNUAL: { label: 'Annual (12 months)', months: 12, service: 'SCHOOL_WEBSITE_ANNUAL', samplePrice: 150000 }
} as const;
export type SchoolWebsitePlan = keyof typeof SCHOOL_WEBSITE_PLANS;

const toKobo = (naira: number) => BigInt(Math.round(naira * 100));

async function getPricingRow(plan: SchoolWebsitePlan) {
  const config = SCHOOL_WEBSITE_PLANS[plan];
  const existing = await prisma.servicePricing.findUnique({ where: { service: config.service } });
  if (existing) return existing;
  try {
    return await prisma.servicePricing.create({ data: {
      service: config.service,
      provider: 'manual',
      label: `School Website — EduTrac ${config.label} subscription`,
      providerCostKobo: toKobo(config.samplePrice),
      sellingPriceKobo: toKobo(config.samplePrice),
      metadata: { product: 'SCHOOL_WEBSITE', plan, months: config.months } as Prisma.InputJsonValue
    } });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return prisma.servicePricing.findUniqueOrThrow({ where: { service: config.service } });
    }
    throw error;
  }
}

export async function listSchoolWebsitePlans() {
  return Promise.all((Object.keys(SCHOOL_WEBSITE_PLANS) as SchoolWebsitePlan[]).map(async (plan) => {
    const config = SCHOOL_WEBSITE_PLANS[plan];
    const row = await getPricingRow(plan);
    return { plan, label: config.label, months: config.months, unit_price: koboToNaira(row.sellingPriceKobo ?? row.providerCostKobo), is_active: row.isActive };
  }));
}

export async function listSchoolWebsitePricesForAdmin() {
  const plans = await listSchoolWebsitePlans();
  const rows = await Promise.all(plans.map((plan) => getPricingRow(plan.plan)));
  return rows.map((row) => ({ service: row.service, label: row.label, provider: row.provider, provider_cost: koboToNaira(row.providerCostKobo), selling_price: row.sellingPriceKobo === null ? null : koboToNaira(row.sellingPriceKobo), partner_selling_price: row.partnerSellingPriceKobo === null ? null : koboToNaira(row.partnerSellingPriceKobo), is_active: row.isActive }));
}

export async function purchaseSchoolWebsiteSubscription(params: {
  userId: string; plan: SchoolWebsitePlan; schoolName: string; contactPhone: string; idempotencyKey?: string;
}) {
  const config = SCHOOL_WEBSITE_PLANS[params.plan];
  const row = await getPricingRow(params.plan);
  if (!row.isActive) throw new ApiError(422, 'This School Website subscription plan is currently unavailable.', 'SERVICE_INACTIVE');
  const amountKobo = row.sellingPriceKobo ?? row.providerCostKobo;
  const amount = koboToNaira(amountKobo);
  const result = await debitWallet({
    userId: params.userId,
    amount,
    type: TransactionType.SCHOOL_WEBSITE_SUBSCRIPTION,
    description: `EduTrac School Website — ${config.label} subscription`,
    idempotencyKey: params.idempotencyKey,
    costKobo: row.providerCostKobo,
    metadata: {
      service: 'SCHOOL_WEBSITE', plan: params.plan, plan_label: config.label, duration_months: config.months,
      provider: 'manual', school_details: sealPII({ school_name: params.schoolName.trim(), contact_phone: params.contactPhone.trim() })
    } as Prisma.InputJsonValue
  });
  if (result.transaction.type !== TransactionType.SCHOOL_WEBSITE_SUBSCRIPTION) {
    throw new ApiError(409, 'This request key was already used for a different purchase. Please submit again.', 'IDEMPOTENCY_KEY_REUSED');
  }
  if (!result.reused) {
    await prisma.transaction.update({ where: { id: result.transaction.id }, data: { provider: 'manual' } });
  }
  return { reference: result.reference, status: result.transaction.status.toLowerCase(), unit_price: amount, balance_after: result.balanceAfter, reused: result.reused };
}

export async function listSchoolWebsiteSubscriptions(userId: string) {
  const rows = await prisma.transaction.findMany({
    where: { userId, type: TransactionType.SCHOOL_WEBSITE_SUBSCRIPTION },
    orderBy: { createdAt: 'desc' }, take: 50,
    select: { id: true, reference: true, status: true, amountKobo: true, description: true, createdAt: true, updatedAt: true, metadata: true }
  });
  return rows.map((row) => {
    const metadata = (row.metadata as Record<string, unknown> | null) ?? {};
    const starts = typeof metadata.subscription_starts_at === 'string' ? metadata.subscription_starts_at : null;
    const expires = typeof metadata.subscription_expires_at === 'string' ? metadata.subscription_expires_at : null;
    const expired = row.status === TransactionStatus.SUCCESS && expires !== null && Date.parse(expires) <= Date.now();
    return { id: row.id, reference: row.reference, plan: metadata.plan_label ?? metadata.plan ?? 'School Website', status: expired ? 'expired' : row.status.toLowerCase(), amount: koboToNaira(row.amountKobo), created_at: row.createdAt.toISOString(), starts_at: starts, expires_at: expires };
  });
}

export async function activateSchoolWebsiteSubscription(transactionId: string) {
  const transaction = await prisma.transaction.findUnique({ where: { id: transactionId } });
  if (!transaction || transaction.type !== TransactionType.SCHOOL_WEBSITE_SUBSCRIPTION) throw new ApiError(404, 'School Website subscription not found.', 'TRANSACTION_NOT_FOUND');
  if (transaction.status !== TransactionStatus.PENDING) throw new ApiError(409, 'Only a pending subscription can be activated.', 'INVALID_STATUS');
  const metadata = (transaction.metadata as Record<string, unknown> | null) ?? {};
  const months = Number(metadata.duration_months);
  if (!Number.isInteger(months) || months < 1 || months > 12) throw new ApiError(422, 'Subscription duration is invalid.', 'INVALID_SUBSCRIPTION_PLAN');

  const now = new Date();
  const prior = await prisma.transaction.findMany({ where: { userId: transaction.userId, type: TransactionType.SCHOOL_WEBSITE_SUBSCRIPTION, status: TransactionStatus.SUCCESS }, select: { metadata: true } });
  let startsAt = now;
  for (const row of prior) {
    const expiry = (row.metadata as Record<string, unknown> | null)?.subscription_expires_at;
    if (typeof expiry === 'string' && Number.isFinite(Date.parse(expiry)) && Date.parse(expiry) > startsAt.getTime()) startsAt = new Date(expiry);
  }
  const expiresAt = new Date(startsAt);
  expiresAt.setMonth(expiresAt.getMonth() + months);
  return prisma.transaction.update({ where: { id: transaction.id }, data: {
    status: TransactionStatus.SUCCESS,
    metadata: { ...metadata, subscription_starts_at: startsAt.toISOString(), subscription_expires_at: expiresAt.toISOString() } as Prisma.InputJsonValue
  } });
}
