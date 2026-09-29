import PDFDocument from 'pdfkit';
import { TransactionType, Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { sealPII, openPII } from '../lib/pii.js';
import { debitWallet } from './wallet.service.js';
import { koboToNaira } from '../lib/money.js';
import { ApiError } from '../middleware/error.js';
export const GEO_POLITICAL_ZONES = ['North Central','North East','North West','South East','South South','South West'] as const;
export type BvnLicenseInput = Record<string, string | boolean> & { geo_political_zone: typeof GEO_POLITICAL_ZONES[number]; consent: boolean };
export function createBvnLicenseTrackingId() { return `MDL-BVN-${new Date().toISOString().slice(0,10).replace(/-/g,'')}-${Math.random().toString(36).slice(2,8).toUpperCase()}`; }
const SERVICE_KEY = 'BVN_LICENSE_ONBOARDING';
const DEFAULT_PRICE = 10000;
const priceToKobo = (amount: number) => BigInt(Math.round(amount * 100));
async function getOrCreatePrice() {
  const existing = await prisma.servicePricing.findUnique({ where: { service: SERVICE_KEY } });
  if (existing) return existing;
  try { return await prisma.servicePricing.create({ data: { service: SERVICE_KEY, label: 'BVN License Onboarding', provider: 'manual', providerCostKobo: priceToKobo(DEFAULT_PRICE) } }); }
  catch (error) { if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') return prisma.servicePricing.findUniqueOrThrow({ where: { service: SERVICE_KEY } }); throw error; }
}
export async function getBvnLicensePrice(options: { forPartner?: boolean } = {}) {
  const row = await getOrCreatePrice();
  if (!row.isActive) throw new ApiError(422, `${row.label} is currently unavailable`, 'SERVICE_INACTIVE');
  const amount = options.forPartner ? row.partnerSellingPriceKobo ?? row.sellingPriceKobo ?? row.providerCostKobo : row.sellingPriceKobo ?? row.providerCostKobo;
  return { unitPrice: koboToNaira(amount), providerCostKobo: row.providerCostKobo };
}
export async function listBvnLicensePriceForAdmin() {
  const row = await getOrCreatePrice();
  return [{ service: row.service, label: row.label, provider: row.provider, provider_cost: koboToNaira(row.providerCostKobo), selling_price: row.sellingPriceKobo ? koboToNaira(row.sellingPriceKobo) : null, partner_selling_price: row.partnerSellingPriceKobo ? koboToNaira(row.partnerSellingPriceKobo) : null, is_active: row.isActive }];
}
async function renderPdf(values:BvnLicenseInput, trackingId:string) {
  const doc = new PDFDocument({ size: 'A4', margin: 48 }); const chunks:Buffer[]=[];
  doc.on('data',(c:Buffer)=>chunks.push(c));
  const done = new Promise<string>((resolve,reject)=>{ doc.on('end',()=>resolve(Buffer.concat(chunks).toString('base64'))); doc.on('error',reject); });
  doc.fontSize(20).fillColor('#111827').text('MAJOR DATA-LINK', {align:'center'}); doc.moveDown(.4);
  doc.fontSize(15).text('BVN License Onboarding Request', {align:'center'}); doc.moveDown();
  doc.fontSize(10).text(`Tracking ID: ${trackingId}`); doc.text(`Submitted: ${new Date().toISOString()}`); doc.moveDown();
  for (const [key,value] of Object.entries(values)) { if (key==='consent') continue; doc.fontSize(10).fillColor('#374151').text(`${key.replaceAll('_',' ').toUpperCase()}: ${String(value)}`); doc.moveDown(.25); }
  doc.moveDown(); doc.fontSize(9).fillColor('#6b7280').text('Submission record for manual processing.'); doc.end(); return done;
}
export async function submitBvnLicense(params:{userId:string;values:BvnLicenseInput;idempotencyKey?:string}) {
  const price = await getBvnLicensePrice();
  const trackingId=createBvnLicenseTrackingId();
  const debit=await debitWallet({userId:params.userId,amount:price.unitPrice,type:TransactionType.BVN_LICENSE_ONBOARDING,description:'BVN License Onboarding',metadata:{service:SERVICE_KEY,tracking_id:trackingId,unit_price:price.unitPrice,pii:sealPII(params.values)} as Prisma.InputJsonValue,idempotencyKey:params.idempotencyKey,costKobo:price.providerCostKobo});
  if (!debit.reused) { const pdf_base64=await renderPdf(params.values,trackingId); const tx=await prisma.transaction.findUnique({where:{id:debit.transaction.id}}); if(tx) await prisma.transaction.update({where:{id:tx.id},data:{metadata:{service:'BVN_LICENSE_ONBOARDING',tracking_id:trackingId,pdf_base64,pii:sealPII(params.values)} as Prisma.InputJsonValue}}); }
  const existing=(debit.transaction?.metadata as Record<string,unknown>|null)?.tracking_id;
  return {trackingId: (existing as string|undefined) ?? trackingId,reference:debit.reference,balanceAfter:debit.balanceAfter};
}
export function decryptBvnLicensePII(t:{metadata:unknown}) { return openPII<Record<string,unknown>>((t.metadata as Record<string,unknown>|null)?.pii); }
