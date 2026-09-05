/**
 * Creates a commercial API partner and prints its plaintext key ONCE.
 * Usage: npx tsx src/scripts/create-partner.ts "Business Name" email@example.com [opening-balance-naira] [phone]
 */
import 'dotenv/config';
import { createHash, randomBytes } from 'node:crypto';
import { nairaToKobo } from '../lib/money.js';
import { prisma } from '../lib/prisma.js';

const [businessName, emailArg, openingBalanceArg, phoneArg] = process.argv.slice(2);
if (!businessName || !emailArg) {
  console.error('Usage: npx tsx src/scripts/create-partner.ts "Business Name" email@example.com [opening-balance-naira] [phone]');
  process.exit(1);
}
const email = emailArg.trim().toLowerCase();
const openingBalance = openingBalanceArg === undefined ? 0 : Number(openingBalanceArg);
if (!Number.isFinite(openingBalance) || openingBalance < 0) {
  console.error('Opening balance must be a non-negative Naira amount.');
  process.exit(1);
}

const key = `mdl_live_${randomBytes(32).toString('hex')}`;
const secretHash = createHash('sha256').update(key, 'utf8').digest('hex');

try {
  const partner = await prisma.partner.create({
    data: {
      businessName: businessName.trim(),
      email,
      phone: phoneArg?.trim() || null,
      walletBalanceKobo: openingBalance > 0 ? nairaToKobo(openingBalance) : 0n,
      apiKeys: { create: { name: 'Initial production key', keyPrefix: key.slice(0, 16), secretHash } }
    }
  });
  console.log(`Partner created: ${partner.businessName} (${partner.id})`);
  console.log(`API key (show once; store safely): ${key}`);
} finally {
  await prisma.$disconnect();
}
