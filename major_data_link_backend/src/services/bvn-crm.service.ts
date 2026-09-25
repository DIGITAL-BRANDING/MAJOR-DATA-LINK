import PDFDocument from 'pdfkit';
import { Prisma, TransactionStatus, TransactionType } from '@prisma/client';
import { koboToNaira } from '../lib/money.js';
import { openPII, sealPII } from '../lib/pii.js';
import { prisma } from '../lib/prisma.js';
import { ApiError } from '../middleware/error.js';
import { debitWallet } from './wallet.service.js';

const SERVICE_KEY = 'BVN_CRM';
const DEFAULT_PRICE = 2000;
export type BvnCrmField = { key: string; label: string; required: boolean; placeholder?: string };
export const BVN_CRM_FIELDS: BvnCrmField[] = [{ key: 'ticket_id', label: '8-digit Ticket ID', required: true, placeholder: 'e.g. 88248123' }];
const priceToKobo = (amount: number) => BigInt(Math.round(amount * 100));

async function pricingRow() {
  const existing = await prisma.servicePricing.findUnique({ where: { service: SERVICE_KEY } });
  if (existing) return existing;
  try {
    return await prisma.servicePricing.create({ data: { service: SERVICE_KEY, provider: 'manual', label: 'BVN CRM — Ticket follow-up', providerCostKobo: priceToKobo(DEFAULT_PRICE) } });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') return prisma.servicePricing.findUniqueOrThrow({ where: { service: SERVICE_KEY } });
    throw error;
  }
}

export async function getBvnCrmPrice() {
  const row = await pricingRow();
  if (!row.isActive) throw new ApiError(422, `${row.label} is currently unavailable`, 'SERVICE_INACTIVE');
  return { unitPrice: koboToNaira(row.sellingPriceKobo ?? row.providerCostKobo), providerCostKobo: row.providerCostKobo };
}

/** Shape matching listVerificationPricesForAdmin() - for the shared /admin/service-status page. */
export async function listBvnCrmPriceForAdmin() {
  const row = await pricingRow();
  return [{ service: row.service, label: row.label, provider: row.provider, is_active: row.isActive }];
}

function renderPdf(params: { reference: string; values: Record<string, unknown>; submittedAt: Date }): Promise<string> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50 }); const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk)); doc.on('end', () => resolve(Buffer.concat(chunks).toString('base64'))); doc.on('error', reject);
    doc.fontSize(16).font('Helvetica-Bold').text('MAJOR DATA-LINK — BVN CRM Request', { align: 'center' });
    doc.moveDown().fontSize(10).font('Helvetica').text(`Reference: ${params.reference}\nSubmitted: ${params.submittedAt.toISOString()}`);
    doc.moveDown().font('Helvetica-Bold').text('Ticket ID: ', { continued: true }).font('Helvetica').text(String(params.values.ticket_id ?? '—'));
    doc.moveDown(2).fontSize(8).fillColor('#888').text('This is a submission record only. Processing is manual.'); doc.end();
  });
}

export async function submitBvnCrmRequest(params: { userId: string; values: Record<string, unknown>; idempotencyKey?: string }) {
  const price = await getBvnCrmPrice();
  const debit = await debitWallet({ userId: params.userId, amount: price.unitPrice, type: TransactionType.BVN_CRM, description: 'BVN CRM — Ticket follow-up', metadata: { service: SERVICE_KEY, unit_price: price.unitPrice, pii: sealPII(params.values) } as Prisma.InputJsonValue, idempotencyKey: params.idempotencyKey, costKobo: price.providerCostKobo });
  if (debit.reused) return { reference: debit.reference, balanceAfter: debit.balanceAfter };
  const pdfBase64 = await renderPdf({ reference: debit.reference, values: params.values, submittedAt: debit.transaction.createdAt });
  await prisma.transaction.update({ where: { id: debit.transaction.id }, data: { metadata: { service: SERVICE_KEY, unit_price: price.unitPrice, pii: sealPII({ ...params.values, pdf_base64: pdfBase64 }) } as Prisma.InputJsonValue } });
  return { reference: debit.reference, balanceAfter: debit.balanceAfter };
}

export async function listBvnCrmHistory(params: { userId: string }) {
  const rows = await prisma.transaction.findMany({ where: { userId: params.userId, type: TransactionType.BVN_CRM }, orderBy: { createdAt: 'desc' }, take: 20 });
  return rows.map((row) => { const pii = openPII<{ pdf_base64?: string }>((row.metadata as Record<string, unknown> | null)?.pii); return { reference: row.reference, status: row.status.toLowerCase(), created_at: row.createdAt.toISOString(), pdf_base64: typeof pii?.pdf_base64 === 'string' ? pii.pdf_base64 : null }; });
}

export async function completeBvnCrm(params: { transactionId: string }) {
  const row = await prisma.transaction.findUnique({ where: { id: params.transactionId } });
  if (!row || row.type !== TransactionType.BVN_CRM) throw new ApiError(404, 'BVN CRM transaction not found', 'TRANSACTION_NOT_FOUND');
  if (row.status !== TransactionStatus.PENDING) throw new ApiError(422, 'Only a pending request can be marked complete', 'INVALID_STATUS');
  return prisma.transaction.update({ where: { id: row.id }, data: { status: TransactionStatus.SUCCESS } });
}

export function decryptBvnCrmPII(transaction: { metadata: unknown }) { return openPII<Record<string, unknown> & { pdf_base64?: string }>((transaction.metadata as Record<string, unknown> | null)?.pii); }
