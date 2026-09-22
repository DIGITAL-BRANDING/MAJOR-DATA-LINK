import crypto from 'node:crypto';
import { prisma } from '../lib/prisma.js';
import { env } from '../config/env.js';
import { openPII, sealPII } from '../lib/pii.js';

const allowed = new Set([
  'application/pdf', 'image/png', 'image/jpeg', 'text/plain',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
]);
const maxBytes = 10 * 1024 * 1024;
const downloadLifetimeSeconds = 300;
type StoredDelivery = { base64?: string };

function safeName(name: string) { return name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 180) || 'delivery'; }
function signature(userId: string, id: string, expires: number) {
  return crypto.createHmac('sha256', env.AUTH_TOKEN_SECRET).update(`delivery:${userId}:${id}:${expires}`).digest('base64url');
}

export async function createUserDelivery(input: { userId: string; adminId: string; title: string; description?: string; fileName: string; mimeType: string; base64: string; reference?: string }) {
  if (!allowed.has(input.mimeType)) throw new Error('Unsupported delivery file type');
  const bytes = Buffer.from(input.base64.replace(/^data:[^;]+;base64,/, ''), 'base64');
  if (!bytes.length || bytes.length > maxBytes) throw new Error('File must be between 1 byte and 10MB');
  const fileName = safeName(input.fileName);
  // Files are AES-GCM sealed in our Postgres database. No Supabase Storage
  // bucket or public object URL is used for new deliveries.
  return prisma.userDelivery.create({ data: {
    userId: input.userId, createdByAdminId: input.adminId, title: input.title,
    description: input.description, fileName, mimeType: input.mimeType,
    filePath: `internal:${crypto.randomUUID()}`,
    inlineData: sealPII({ base64: bytes.toString('base64') }),
    fileSize: bytes.length, reference: input.reference
  } });
}

export async function listUserDeliveries(userId: string) {
  return prisma.userDelivery.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 100 });
}

export async function signedDeliveryUrl(userId: string, id: string) {
  const row = await prisma.userDelivery.findFirst({ where: { id, userId } });
  if (!row) return null;
  // Do not silently fall back to old Supabase objects. Re-upload legacy files
  // through Admin so every active delivery uses the protected in-system store.
  if (!row.inlineData) throw new Error('This legacy delivery must be re-uploaded securely by an administrator');
  const expires = Math.floor(Date.now() / 1000) + downloadLifetimeSeconds;
  return { row, path: `/api/deliveries/${row.id}/content?expires=${expires}&signature=${signature(userId, row.id, expires)}`, expires };
}

export function isValidDeliverySignature(userId: string, id: string, expiresRaw: string | undefined, provided: string | undefined) {
  const expires = Number(expiresRaw);
  if (!Number.isSafeInteger(expires) || expires < Math.floor(Date.now() / 1000) || !provided) return false;
  const expected = signature(userId, id, expires);
  try { return crypto.timingSafeEqual(Buffer.from(provided), Buffer.from(expected)); } catch { return false; }
}

export async function readUserDeliveryContent(userId: string, id: string) {
  const row = await prisma.userDelivery.findFirst({ where: { id, userId } });
  if (!row || !row.inlineData) return null;
  const stored = openPII<StoredDelivery>(row.inlineData);
  if (!stored?.base64) return null;
  const bytes = Buffer.from(stored.base64, 'base64');
  if (!bytes.length || bytes.length > maxBytes) return null;
  return { row, bytes };
}
