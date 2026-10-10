import { createHash, randomBytes } from 'node:crypto';
import { prisma } from '../lib/prisma.js';

export const GUEST_TOKEN_PREFIX = 'gst_';

const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');

/** Creates an anonymous chat identity. The raw token is returned once and never stored. */
export async function createGuestSession(input: { displayName: string; contact: string }) {
  const token = GUEST_TOKEN_PREFIX + randomBytes(32).toString('base64url');
  const guest = await prisma.chatGuest.create({
    data: { displayName: input.displayName, contact: input.contact, tokenHash: sha256(token) },
  });
  return { token, guestId: guest.id, displayName: guest.displayName };
}

/** Resolves a guest socket token to its ChatGuest row, or null if unknown. */
export async function resolveGuestToken(token: string) {
  if (!token.startsWith(GUEST_TOKEN_PREFIX)) return null;
  const guest = await prisma.chatGuest.findUnique({ where: { tokenHash: sha256(token) } });
  if (!guest) return null;
  await prisma.chatGuest.update({ where: { id: guest.id }, data: { lastSeenAt: new Date() } });
  return guest;
}
