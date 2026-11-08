import PDFDocument from 'pdfkit';
import { prisma } from '../lib/prisma.js';
import { koboToNaira } from '../lib/money.js';
import { sendWalletFundingReceiptEmail } from '../lib/email.js';

type ReceiptParams = {
  email: string;
  name: string;
  accountType: 'User' | 'Partner';
  amountKobo: bigint;
  balanceBeforeKobo: bigint;
  balanceAfterKobo: bigint;
  reference: string;
  provider?: string | null;
  feeKobo?: bigint;
  createdAt: Date;
};

function money(kobo: bigint) {
  return `NGN ${koboToNaira(kobo).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function paymentProviderLabel(provider?: string | null) {
  const value = provider?.trim();
  if (!value) return 'Bank transfer';
  return ({ katpay: 'KatPay', paystack: 'Paystack', zenithpay: 'ZenithPay' } as Record<string, string>)[value.toLowerCase()] ?? value;
}

async function createReceiptPdf(params: ReceiptParams) {
  const doc = new PDFDocument({ size: 'A4', margin: 52, info: { Title: `Wallet funding receipt ${params.reference}`, Author: 'K-Tech Solutions' } });
  const chunks: Buffer[] = [];
  const output = new Promise<Buffer>((resolve, reject) => {
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });

  doc.rect(0, 0, 595.28, 112).fill('#0b2f73');
  doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(21).text('K-TECH SOLUTIONS', 52, 36);
  doc.fillColor('#f6d36b').font('Helvetica-Bold').fontSize(10).text('OFFICIAL WALLET FUNDING RECEIPT', 52, 68, { characterSpacing: 1.2 });
  doc.fillColor('#0b2f73').font('Helvetica-Bold').fontSize(19).text('Funding receipt', 52, 145);
  doc.fillColor('#64748b').font('Helvetica').fontSize(10).text(`Receipt reference: ${params.reference}`, 52, 174);
  doc.moveTo(52, 202).lineTo(543, 202).strokeColor('#d8e0eb').stroke();

  const rows: Array<[string, string]> = [
    ['Account holder', params.name || params.accountType],
    ['Account type', params.accountType],
    ['Funding amount', money(params.amountKobo)],
    ['Transaction fee', money(params.feeKobo ?? 0n)],
    ['Balance before', money(params.balanceBeforeKobo)],
    ['Balance after', money(params.balanceAfterKobo)],
    ['Payment provider', paymentProviderLabel(params.provider)],
    ['Status', 'Successful'],
    ['Date and time', params.createdAt.toLocaleString('en-NG', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Africa/Lagos' })]
  ];
  let y = 225;
  for (const [label, value] of rows) {
    doc.fillColor('#64748b').font('Helvetica').fontSize(10).text(label, 52, y, { width: 175 });
    doc.fillColor('#172033').font('Helvetica-Bold').fontSize(10).text(value, 227, y, { width: 316 });
    doc.moveTo(52, y + 25).lineTo(543, y + 25).strokeColor('#edf1f6').stroke();
    y += 43;
  }
  doc.fillColor('#64748b').font('Helvetica').fontSize(9).text('This receipt confirms that the funding above was credited to the wallet shown.', 52, y + 18, { width: 490, lineGap: 4 });
  doc.fillColor('#0b2f73').font('Times-Italic').fontSize(22).text('K-Tech Solutions', 52, y + 61);
  doc.fillColor('#334155').font('Helvetica-Bold').fontSize(9).text('Administration', 52, y + 88);
  doc.fillColor('#64748b').font('Helvetica').fontSize(8).text('Official Admin Office', 52, y + 102);
  const sealX = 490;
  const sealY = y + 101;
  doc.save().lineWidth(2).strokeColor('#0b2f73').circle(sealX, sealY, 38).stroke();
  doc.lineWidth(1).circle(sealX, sealY, 33).stroke();
  doc.fillColor('#0b2f73').font('Helvetica-Bold').fontSize(7).text('K-TECH', sealX - 25, sealY - 16, { width: 50, align: 'center' });
  doc.fontSize(8).text('OFFICIAL', sealX - 28, sealY - 4, { width: 56, align: 'center' });
  doc.fontSize(5.5).text('ADMIN OFFICE', sealX - 30, sealY + 9, { width: 60, align: 'center' }).restore();
  doc.end();
  return output;
}

async function sendReceipt(params: ReceiptParams) {
  try {
    const pdf = await createReceiptPdf(params);
    const result = await sendWalletFundingReceiptEmail({
      email: params.email,
      name: params.name,
      amountKobo: params.amountKobo,
      balanceAfterKobo: params.balanceAfterKobo,
      reference: params.reference,
      accountType: params.accountType,
      provider: params.provider,
      attachment: { filename: `wallet-funding-${params.reference}.pdf`, content: pdf, contentType: 'application/pdf' }
    });
    if (!result.sent) console.warn('[wallet-funding-email] receipt email was not accepted', JSON.stringify({ reference: params.reference, error: result.error }));
  } catch (error) {
    console.error('[wallet-funding-email] could not create or send receipt', params.reference, error);
  }
}

export async function emailUserFundingReceipt(params: {
  userId: string; amountKobo: bigint; balanceBeforeKobo: bigint; balanceAfterKobo: bigint; reference: string; provider?: string | null; feeKobo?: bigint; createdAt: Date;
}) {
  try {
    const user = await prisma.user.findUnique({ where: { id: params.userId }, select: { email: true, fullName: true } });
    if (!user?.email) return;
    await sendReceipt({ ...params, email: user.email, name: user.fullName, accountType: 'User' });
  } catch (error) {
    console.error('[wallet-funding-email] could not load user for receipt', params.reference, error);
  }
}

export async function emailPartnerFundingReceipt(params: {
  partnerId: string; amountKobo: bigint; balanceBeforeKobo: bigint; balanceAfterKobo: bigint; reference: string; provider?: string | null; createdAt: Date;
}) {
  try {
    const partner = await prisma.partner.findUnique({ where: { id: params.partnerId }, select: { email: true, businessName: true } });
    if (!partner?.email) return;
    await sendReceipt({ ...params, email: partner.email, name: partner.businessName, accountType: 'Partner' });
  } catch (error) {
    console.error('[wallet-funding-email] could not load partner for receipt', params.reference, error);
  }
}
