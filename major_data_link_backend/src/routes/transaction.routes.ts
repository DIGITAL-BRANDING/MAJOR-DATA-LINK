import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { koboToNaira } from '../lib/money.js';
import { requireAuth } from '../middleware/auth.js';

export const transactionRoutes = Router();

transactionRoutes.use(requireAuth);

transactionRoutes.get('/', async (req, res) => {
  const transactions = await prisma.transaction.findMany({
    where: { userId: req.user!.id },
    orderBy: { createdAt: 'desc' },
    take: 50
  });

  res.json({
    status: true,
    data: transactions.map((tx) => ({
      id: tx.id,
      reference: tx.reference,
      type: tx.type.toLowerCase(),
      status: tx.status.toLowerCase(),
      amount: koboToNaira(tx.amountKobo),
      balance_after: koboToNaira(tx.balanceAfterKobo),
      description: tx.description,
      created_at: tx.createdAt.toISOString()
    }))
  });
});

// The generic activity feed above intentionally includes wallet movements.
// That is useful on the dashboard, but it made the Service History screen
// unreliable: after 50 newer funding/transfer rows, a customer's paid
// verification requests disappeared from that screen altogether.  Keep a
// separate, lean endpoint for actual services and never send the encrypted
// metadata/PDF blob in a list response (one old slip could otherwise make
// every page load several megabytes slower).
transactionRoutes.get('/services', async (req, res) => {
  const transactions = await prisma.transaction.findMany({
    where: {
      userId: req.user!.id,
      type: {
        notIn: [
          'WALLET_FUNDING',
          'WALLET_TRANSFER',
          'WITHDRAWAL',
          'REFERRAL_COMMISSION',
          'MANUAL_ADJUSTMENT',
          'COUPON_REDEMPTION'
        ]
      }
    },
    orderBy: { createdAt: 'desc' },
    take: 250
  });

  res.set('Cache-Control', 'no-store');
  res.json({
    status: true,
    data: transactions.map((tx) => ({
      id: tx.id,
      reference: tx.reference,
      type: tx.type.toLowerCase(),
      status: tx.status.toLowerCase(),
      amount: koboToNaira(tx.amountKobo),
      balance_after: koboToNaira(tx.balanceAfterKobo),
      description: tx.description,
      created_at: tx.createdAt.toISOString()
    }))
  });
});

transactionRoutes.get('/:id', async (req, res) => {
  const tx = await prisma.transaction.findFirstOrThrow({
    where: { id: req.params.id, userId: req.user!.id }
  });

  res.json({
    id: tx.id,
    reference: tx.reference,
    type: tx.type.toLowerCase(),
    status: tx.status.toLowerCase(),
    amount: koboToNaira(tx.amountKobo),
    balance_after: koboToNaira(tx.balanceAfterKobo),
    description: tx.description,
    created_at: tx.createdAt.toISOString(),
    metadata: tx.metadata
  });
});
