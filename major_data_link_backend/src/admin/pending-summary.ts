import type { Request, Router } from 'express';
import { TransactionStatus } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { QUEUE_GROUPS, groupFor, isManualWorkItem } from './manual-requests.js';

export function registerPendingSummaryRoutes(router: Router) {
  router.get('/pending-summary', async (req: Request, res) => {
    if (!req.session?.adminUser) return res.status(401).json({ status: false, message: 'Not signed in' });
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const [customerRows, partnerRows] = await Promise.all([
      prisma.transaction.findMany({ where: { status: TransactionStatus.PENDING }, select: { type: true, provider: true, metadata: true, createdAt: true } }),
      prisma.partnerTransaction.findMany({ where: { status: TransactionStatus.PENDING }, select: { type: true, provider: true, metadata: true, createdAt: true } })
    ]);
    const pending = [...customerRows, ...partnerRows].filter(isManualWorkItem).map((row) => ({ ...row, group: groupFor(row.type, row.metadata) }));
    const by_type = QUEUE_GROUPS.map(({ id, label }) => {
      const rows = pending.filter((row) => row.group === id);
      const oldest = rows.reduce<Date | null>((value, row) => !value || row.createdAt < value ? row.createdAt : value, null);
      return { type: id, label, href: `/admin/manual-requests?group=${id}`, pending: rows.length, new_last_24h: rows.filter((row) => row.createdAt >= since).length, oldest_pending_at: oldest?.toISOString() ?? null };
    });
    res.json({ status: true, data: { total_pending: by_type.reduce((sum, row) => sum + row.pending, 0), total_new_last_24h: by_type.reduce((sum, row) => sum + row.new_last_24h, 0), by_type } });
  });
}
