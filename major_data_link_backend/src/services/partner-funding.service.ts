import { nanoid } from 'nanoid';
import { Prisma, TransactionStatus, TransactionType } from '@prisma/client';
import { env } from '../config/env.js';
import { koboToNaira, nairaToKobo } from '../lib/money.js';
import { prisma } from '../lib/prisma.js';
import { ApiError } from '../middleware/error.js';
import { katpayService } from './katpay.service.js';
import { paystackService } from './paystack.service.js';
import { zenithpayService } from './zenithpay.service.js';
import { notifyPartnerSafely } from './notification.service.js';
import { createDynamicFundingAccount, verifyDynamicFunding } from './payment-provider.service.js';

function splitName(name: string) {
  const [firstName = 'Major', ...rest] = name.trim().split(/\s+/);
  return { firstName, lastName: rest.join(' ') || 'Partner' };
}

/**
 * Reads the business owner's BVN from a request body (snake_case, the same shape the
 * portal and the /api/v1 endpoint both accept). Returns undefined when none was sent.
 */
export function partnerBvnFromBody(body: unknown): string | undefined {
  const raw = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
  const bvn = typeof raw.bvn === 'string' ? raw.bvn.trim() : '';
  if (!bvn) return undefined;
  if (!/^\d{11}$/.test(bvn)) throw new ApiError(422, 'BVN must be exactly 11 digits', 'INVALID_BVN');
  return bvn;
}

/** Creates the partner's permanent virtual account when their gateway profile permits it. */
export async function provisionPartnerVirtualAccount(partnerId: string, bvn?: string) {
  const partner = await prisma.partner.findUniqueOrThrow({ where: { id: partnerId } });
  if (env.PAYMENT_PROVIDER === 'zenithpay') {
    // ZenithPay only issues accounts against a BVN, so this path never falls through to the
    // Paystack/KatPay branches below. A stale KatPay number is replaced once the owner verifies.
    if (partner.virtualAccountNumber && partner.virtualAccountProvider === 'zenithpay') return partner;
    if (!bvn) throw new ApiError(422, "Enter the business owner's BVN to activate your funding account.", 'PARTNER_BVN_REQUIRED');
    return assignPartnerZenithAccount(partner, bvn);
  }
  if (partner.virtualAccountNumber) return partner;
  if (!partner.phone || partner.phone.trim().length < 6) {
    throw new ApiError(422, 'A verified partner phone number is required before a funding account can be created.', 'PARTNER_PHONE_REQUIRED');
  }
  if (env.PAYMENT_PROVIDER === 'katpay') {
    const account = await katpayService.createVirtualAccount({ email: partner.email, name: partner.businessName, phoneNumber: partner.phone });
    return prisma.partner.update({ where: { id: partner.id }, data: { virtualAccountNumber: account.account_number, virtualAccountBank: account.bank_name, virtualAccountProvider: 'katpay' } });
  }
  if (!env.PAYSTACK_INSTANT_DVA_ENABLED) {
    throw new ApiError(422, 'Dedicated partner accounts are unavailable. Use Exact Transfer funding or contact support.', 'PARTNER_DVA_UNAVAILABLE');
  }
  const { firstName, lastName } = splitName(partner.businessName);
  let customerCode = partner.paystackCustomerCode;
  if (!customerCode) {
    const customer = await paystackService.createCustomer({ email: partner.email, firstName, lastName, phone: partner.phone });
    customerCode = customer.customer_code;
  }
  const account = await paystackService.createDedicatedVirtualAccount({ customerCode });
  return prisma.partner.update({ where: { id: partner.id }, data: { paystackCustomerCode: customerCode, virtualAccountNumber: account.account_number, virtualAccountBank: account.bank.name, virtualAccountProvider: 'paystack' } });
}

async function assignPartnerZenithAccount(partner: { id: string; email: string; businessName: string }, bvn: string) {
  // ZenithPay only needs the BVN. The names it also takes are derived from the business,
  // the same way the Paystack partner path does it.
  const { firstName, lastName } = splitName(partner.businessName);
  const account = await zenithpayService.assignDedicatedAccount({
    bvn,
    accountName: partner.businessName,
    firstName,
    lastName,
    email: partner.email
  });
  const updated = await prisma.partner.update({
    where: { id: partner.id },
    data: {
      virtualAccountNumber: account.accountNumber,
      virtualAccountBank: account.bankName,
      virtualAccountProvider: 'zenithpay',
      bvnLast4: bvn.slice(-4),
      bvnVerifiedAt: new Date()
    }
  });
  notifyPartnerSafely({
    partnerId: partner.id,
    type: 'WALLET',
    title: 'Funding account ready',
    body: `Your funding account is ${account.accountNumber} (${account.bankName}). Transfers to it credit your wallet automatically.`,
    data: { virtualAccountNumber: account.accountNumber }
  });
  return updated;
}

/** A gateway-verified, one-time funding account used when permanent DVA provisioning is unavailable. */
export async function createPartnerDynamicFunding(partnerId: string, amount: number) {
  const partner = await prisma.partner.findUniqueOrThrow({ where: { id: partnerId } });
  const funding = await createDynamicFundingAccount({ email: partner.email, fullName: partner.businessName, amount });
  await prisma.partnerTransaction.create({ data: {
    partnerId, type: TransactionType.WALLET_FUNDING, status: TransactionStatus.PENDING,
    amountKobo: nairaToKobo(amount), balanceBeforeKobo: partner.walletBalanceKobo, balanceAfterKobo: partner.walletBalanceKobo,
    provider: funding.provider, providerRef: funding.providerReference ?? null, reference: funding.reference,
    idempotencyKey: `fund:${funding.reference}`, description: `Partner wallet funding via ${funding.provider} (exact transfer)`,
    metadata: { account_number: funding.accountNumber, account_name: funding.accountName, bank_name: funding.bankName ?? null, expires_at: funding.expiresAt ?? null, provider_reference: funding.providerReference ?? null }
  }});
  return funding;
}

/** Credits a partner's wallet exactly once after the payment gateway is verified. */
export async function creditPartnerFundingByReference(reference: string) {
  const transaction = await prisma.$transaction(async (tx) => {
    const funding = await tx.partnerTransaction.findUnique({ where: { reference } });
    if (!funding || funding.type !== TransactionType.WALLET_FUNDING) throw new ApiError(404, 'Partner funding transaction not found', 'PARTNER_FUNDING_NOT_FOUND');
    if (funding.status === TransactionStatus.SUCCESS) return funding;
    if (funding.status !== TransactionStatus.PENDING) {
      throw new ApiError(409, 'Only a pending partner funding transaction can be credited', 'PARTNER_FUNDING_NOT_PENDING');
    }
    const partner = await tx.partner.update({ where: { id: funding.partnerId }, data: { walletBalanceKobo: { increment: funding.amountKobo } } });
    return tx.partnerTransaction.update({ where: { id: funding.id }, data: { status: TransactionStatus.SUCCESS, balanceAfterKobo: partner.walletBalanceKobo } });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  void import('./partner-webhook.service.js').then(({ enqueuePartnerTransactionWebhook, deliverDuePartnerWebhooks }) =>
    enqueuePartnerTransactionWebhook(transaction).then(() => deliverDuePartnerWebhooks(1)).catch((error) => console.error('[partner-webhooks] could not queue funding event', error))
  );
  return transaction;
}

/** Finance fallback for a partner funding webhook that did not arrive. */
export async function reconcilePartnerPendingFundingByAdmin(params: {
  transactionId: string;
  partnerId: string;
  resolution: 'success' | 'failed' | 'ignored' | 'declined';
  adminId: string;
  note?: string;
}) {
  const existing = await prisma.partnerTransaction.findFirst({
    where: { id: params.transactionId, partnerId: params.partnerId, type: TransactionType.WALLET_FUNDING }
  });
  if (!existing) throw new ApiError(404, 'Partner funding transaction not found', 'PARTNER_FUNDING_NOT_FOUND');
  if (existing.status !== TransactionStatus.PENDING) {
    throw new ApiError(409, 'This partner funding transaction has already been resolved', 'PARTNER_FUNDING_NOT_PENDING');
  }

  if (params.resolution === 'success') {
    const credited = await creditPartnerFundingByReference(existing.reference);
    const metadata = (credited.metadata as Record<string, unknown> | null) ?? {};
    return prisma.partnerTransaction.update({
      where: { id: credited.id },
      data: { metadata: { ...metadata, reconciliation: { resolution: params.resolution, adminId: params.adminId, note: params.note || null, resolvedAt: new Date().toISOString() } } }
    });
  }

  const metadata = (existing.metadata as Record<string, unknown> | null) ?? {};
  return prisma.partnerTransaction.update({
    where: { id: existing.id },
    data: {
      status: params.resolution === 'failed'
        ? TransactionStatus.FAILED
        : params.resolution === 'ignored'
          ? TransactionStatus.IGNORED
          : TransactionStatus.DECLINED,
      metadata: { ...metadata, reconciliation: { resolution: params.resolution, adminId: params.adminId, note: params.note || null, resolvedAt: new Date().toISOString() } }
    }
  });
}

export async function verifyPartnerFunding(reference: string) {
  const funding = await prisma.partnerTransaction.findUnique({ where: { reference } });
  if (!funding || funding.type !== TransactionType.WALLET_FUNDING) throw new ApiError(404, 'Partner funding transaction not found', 'PARTNER_FUNDING_NOT_FOUND');
  const status = await verifyDynamicFunding({ provider: funding.provider, reference: funding.reference, metadata: funding.metadata });
  if (status === 'success') return { status, transaction: await creditPartnerFundingByReference(reference) };
  return { status, transaction: funding };
}

/** Direct deposit into a permanent KatPay or Paystack virtual account. */
export async function creditPartnerDirectDeposit(params: { reference: string; amountKobo: bigint; partnerId: string; provider: 'paystack' | 'katpay' | 'zenithpay'; channel: string }) {
  const providerRef = `${params.provider}:virtual-account:${params.reference}`;
  const existing = await prisma.partnerTransaction.findFirst({ where: { partnerId: params.partnerId, provider: params.provider, providerRef, type: TransactionType.WALLET_FUNDING } });
  if (existing) return existing;
  const transaction = await prisma.$transaction(async (tx) => {
    const partner = await tx.partner.findUniqueOrThrow({ where: { id: params.partnerId } });
    const updated = await tx.partner.update({ where: { id: partner.id }, data: { walletBalanceKobo: { increment: params.amountKobo } } });
    return tx.partnerTransaction.create({ data: {
      partnerId: partner.id, type: TransactionType.WALLET_FUNDING, status: TransactionStatus.SUCCESS,
      amountKobo: params.amountKobo, balanceBeforeKobo: partner.walletBalanceKobo, balanceAfterKobo: updated.walletBalanceKobo,
      provider: params.provider, providerRef, reference: `PARTNER-FUND-${nanoid(12).toUpperCase()}`,
      idempotencyKey: `direct:${providerRef}`, description: `Partner wallet funded via direct bank transfer (${params.channel})`, metadata: { channel: params.channel }
    }});
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  void import('./partner-webhook.service.js').then(({ enqueuePartnerTransactionWebhook, deliverDuePartnerWebhooks }) =>
    enqueuePartnerTransactionWebhook(transaction).then(() => deliverDuePartnerWebhooks(1)).catch((error) => console.error('[partner-webhooks] could not queue direct-deposit event', error))
  );
  const amountNaira = (Number(params.amountKobo) / 100).toLocaleString('en-NG', { minimumFractionDigits: 2 });
  notifyPartnerSafely({
    partnerId: params.partnerId,
    type: 'WALLET',
    title: 'Wallet funded',
    body: `NGN${amountNaira} has been credited to your wallet.`,
    data: { reference: transaction.reference }
  });
  return transaction;
}

export function partnerFundingResponse(partner: { walletBalanceKobo: bigint; virtualAccountNumber: string | null; virtualAccountBank: string | null; virtualAccountProvider: string | null }) {
  return { balance: koboToNaira(partner.walletBalanceKobo), currency: 'NGN', virtual_account_number: partner.virtualAccountNumber, virtual_account_bank: partner.virtualAccountBank, virtual_account_provider: partner.virtualAccountProvider };
}
