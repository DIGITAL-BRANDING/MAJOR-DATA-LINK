import type { Request, Router } from 'express';
import { TransactionStatus, TransactionType } from '@prisma/client';
import { prisma } from '../lib/prisma.js';

const TYPES: { type: TransactionType; label: string }[] = [
  { type: TransactionType.CAC_SERVICE_REQUEST, label: 'CAC requests' },
  { type: TransactionType.BVN_LICENSE_ONBOARDING, label: 'BVN Licence requests' },
  { type: TransactionType.BVN_MODIFICATION, label: 'BVN Modification' },
  { type: TransactionType.BVN_CRM, label: 'BVN CRM follow-up' },
  { type: TransactionType.NIN_MODIFICATION, label: 'NIN Modification' },
  { type: TransactionType.BIRTH_ATTESTATION, label: 'Birth Attestation' },
  { type: TransactionType.NEWSPAPER_PUBLICATION, label: 'Newspaper Publication' }
];

export function registerPendingSummaryRoutes(router: Router) {
  router.get('/pending-summary', async (req: Request, res) => {
    if (!req.session?.adminUser) return res.status(401).json({ status: false, message: 'Not signed in' });
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const pending = await prisma.transaction.findMany({ where: { status: TransactionStatus.PENDING }, select: { type: true, createdAt: true } });
    const by_type = TYPES.map(({ type, label }) => {
      const rows = pending.filter((row) => String(row.type) === String(type));
      const oldest = rows.reduce<Date | null>((value, row) => !value || row.createdAt < value ? row.createdAt : value, null);
      return { type, label, pending: rows.length, new_last_24h: rows.filter((row) => row.createdAt >= since).length, oldest_pending_at: oldest?.toISOString() ?? null };
    });
    res.json({ status: true, data: { total_pending: by_type.reduce((sum, row) => sum + row.pending, 0), total_new_last_24h: by_type.reduce((sum, row) => sum + row.new_last_24h, 0), by_type } });
  });
}
