/**
 * One-off: pushes every existing User and Partner into the matching Resend
 * Audience (see lib/resend-contacts.ts). Safe to re-run - rows that already
 * have a resendContactId are updated in place, not duplicated.
 * Usage: npm run resend:backfill
 */
import 'dotenv/config';
import { prisma } from '../lib/prisma.js';
import { syncResendContact } from '../lib/resend-contacts.js';

const PAUSE_MS = 600; // Resend allows ~2 requests/second per team.
const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

try {
  const users = await prisma.user.findMany({ select: { id: true, email: true, fullName: true, resendContactId: true } });
  for (const user of users) {
    await syncResendContact('user', { id: user.id, email: user.email, name: user.fullName, resendContactId: user.resendContactId });
    await pause(PAUSE_MS);
  }
  console.log(`Synced ${users.length} customer(s).`);

  const partners = await prisma.partner.findMany({ select: { id: true, email: true, businessName: true, resendContactId: true } });
  for (const partner of partners) {
    await syncResendContact('partner', { id: partner.id, email: partner.email, name: partner.businessName, resendContactId: partner.resendContactId });
    await pause(PAUSE_MS);
  }
  console.log(`Synced ${partners.length} partner(s).`);
} finally {
  await prisma.$disconnect();
}
