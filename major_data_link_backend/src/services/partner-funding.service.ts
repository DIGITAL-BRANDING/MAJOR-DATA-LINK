import { nanoid } from 'nanoid';
import { Prisma, TransactionStatus, TransactionType } from '@prisma/client';
import { env } from '../config/env.js';
import { koboToNaira, nairaToKobo } from '../lib/money.js';
import { prisma } from '../lib/prisma.js';
import { ApiError } from '../middleware/error.js';
import { katpayService } from './katpay.service.js';
import { paystackService } from './paystack.service.js';
import { createDynamicFundingAccount, verifyDynamicFunding } from './payment-provider.service.js';

function splitName(name: string) {
  const [firstName = 'Major', ...rest] = name.trim().split(/\s+/);
  return { firstName, lastName: rest.join(' ') || 'Partner' };
}

/** Creates the partner's permanent virtual account when their gateway profile permits it. */
export async function provisionPartnerVirtualAccount(partnerId: string) {
  const partner = await prisma.partner.findUniqueOrThrow({ where: { id: partnerId } });
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
  return prisma.$transaction(async (tx) => {
    const funding = await tx.partnerTransaction.findUnique({ where: { reference } });
    if (!funding || funding.type !== TransactionType.WALLET_FUNDING) throw new ApiError(404, 'Partner funding transaction not found', 'PARTNER_FUNDING_NOT_FOUND');
    if (funding.status === TransactionStatus.SUCCESS) return funding;
    const partner = await tx.partner.update({ where: { id: funding.partnerId }, data: { walletBalanceKobo: { increment: funding.amountKobo } } });
    return tx.partnerTransaction.update({ where: { id: funding.id }, data: { status: TransactionStatus.SUCCESS, balanceAfterKobo: partner.walletBalanceKobo } });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function verifyPartnerFunding(reference: string) {
  const funding = await prisma.partnerTransaction.findUnique({ where: { reference } });
  if (!funding || funding.type !== TransactionType.WALLET_FUNDING) throw new ApiError(404, 'Partner funding transaction not found', 'PARTNER_FUNDING_NOT_FOUND');
  const status = await verifyDynamicFunding({ provider: funding.provider, reference: funding.reference, metadata: funding.metadata });
  if (status === 'success') return { status, transaction: await creditPartnerFundingByReference(reference) };
  return { status, transaction: funding };
}

/** Direct deposit into a permanent KatPay or Paystack virtual account. */
export async function creditPartnerDirectDeposit(params: { reference: string; amountKobo: bigint; partnerId: string; provider: 'paystack' | 'katpay'; channel: string }) {
  const providerRef = `${params.provider}:virtual-account:${params.reference}`;
  const existing = await prisma.partnerTransaction.findFirst({ where: { partnerId: params.partnerId, provider: params.provider, providerRef, type: TransactionType.WALLET_FUNDING } });
  if (existing) return existing;
  return prisma.$transaction(async (tx) => {
    const partner = await tx.partner.findUniqueOrThrow({ where: { id: params.partnerId } });
    const updated = await tx.partner.update({ where: { id: partner.id }, data: { walletBalanceKobo: { increment: params.amountKobo } } });
    return tx.partnerTransaction.create({ data: {
      partnerId: partner.id, type: TransactionType.WALLET_FUNDING, status: TransactionStatus.SUCCESS,
      amountKobo: params.amountKobo, balanceBeforeKobo: partner.walletBalanceKobo, balanceAfterKobo: updated.walletBalanceKobo,
      provider: params.provider, providerRef, reference: `PARTNER-FUND-${nanoid(12).toUpperCase()}`,
      idempotencyKey: `direct:${providerRef}`, description: `Partner wallet funded via direct bank transfer (${params.channel})`, metadata: { channel: params.channel }
    }});
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export function partnerFundingResponse(partner: { walletBalanceKobo: bigint; virtualAccountNumber: string | null; virtualAccountBank: string | null; virtualAccountProvider: string | null }) {
  return { balance: koboToNaira(partner.walletBalanceKobo), currency: 'NGN', virtual_account_number: partner.virtualAccountNumber, virtual_account_bank: partner.virtualAccountBank, virtual_account_provider: partner.virtualAccountProvider };
}
