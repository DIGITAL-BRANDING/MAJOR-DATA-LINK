import type { Router } from 'express';
import { TransactionStatus, TransactionType } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import type { AdminSessionUser } from './auth.js';

declare module 'express-session' {
  interface SessionData { adminUser?: AdminSessionUser; }
}

const usageTypes = [
  TransactionType.DATA_PURCHASE, TransactionType.AIRTIME_PURCHASE,
  TransactionType.ELECTRICITY_PURCHASE, TransactionType.CABLE_PURCHASE,
  TransactionType.RESULT_PIN, TransactionType.SMS, TransactionType.NIN_VERIFICATION,
  TransactionType.BVN_VERIFICATION, TransactionType.IDENTITY_SERVICE_REQUEST,
  TransactionType.NIN_MODIFICATION, TransactionType.BVN_LICENSE_ONBOARDING,
  TransactionType.CAC_SERVICE_REQUEST, TransactionType.BVN_MODIFICATION,
  TransactionType.BIRTH_ATTESTATION, TransactionType.NEWSPAPER_PUBLICATION,
  TransactionType.BVN_CRM, TransactionType.JAMB_SERVICE_REQUEST
] as const;

const money = (kobo: bigint) => `₦${(Number(kobo) / 100).toLocaleString('en-NG', { minimumFractionDigits: 2 })}`;
const esc = (value: unknown) => String(value ?? '').replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char] ?? char);

/** AdminJS activity ledger and successful-service customer rankings. */
export function registerCustomerActivityRoutes(router: Router) {
  router.get('/customer-activity', async (req, res) => {
    const admin = req.session?.adminUser;
    if (!admin) return res.redirect('/admin/login');
    const requestedPeriod = String(req.query.period ?? req.query.days ?? '30');
    const period = ['7', '30', '90', '365', 'all'].includes(requestedPeriod) ? requestedPeriod : '30';
    const periodWhere = period === 'all'
      ? {}
      : { createdAt: { gte: new Date(Date.now() - Number(period) * 24 * 60 * 60 * 1000) } };
    const successfulServicesWhere = {
      ...periodWhere,
      status: TransactionStatus.SUCCESS,
      type: { in: [...usageTypes] }
    };
    const [grouped, recent, statusGroups] = await Promise.all([
      prisma.transaction.groupBy({ by: ['userId'], where: successfulServicesWhere, _count: { _all: true }, _sum: { amountKobo: true }, _max: { createdAt: true } }),
      prisma.transaction.findMany({
        where: periodWhere, take: 100, orderBy: { createdAt: 'desc' },
        select: { type: true, status: true, amountKobo: true, description: true, createdAt: true, user: { select: { fullName: true, email: true } } }
      }),
      prisma.transaction.groupBy({ by: ['status'], where: periodWhere, _count: { _all: true } })
    ]);
    const ranked = [...grouped].sort((a, b) => Number(b._sum.amountKobo ?? 0n) - Number(a._sum.amountKobo ?? 0n)).slice(0, 30);
    const users = await prisma.user.findMany({ where: { id: { in: ranked.map((row) => row.userId) } }, select: { id: true, fullName: true, email: true } });
    const usersById = new Map(users.map((user) => [user.id, user]));
    const totalKobo = grouped.reduce((total, row) => total + (row._sum.amountKobo ?? 0n), 0n);
    const totalPurchases = grouped.reduce((total, row) => total + row._count._all, 0);
    const statusCounts = new Map(statusGroups.map((row) => [row.status, row._count._all]));
    const totalActivities = statusGroups.reduce((sum, row) => sum + row._count._all, 0);
    const failedActivities = (statusCounts.get(TransactionStatus.FAILED) ?? 0)
      + (statusCounts.get(TransactionStatus.REVERSED) ?? 0)
      + (statusCounts.get(TransactionStatus.DECLINED) ?? 0)
      + (statusCounts.get(TransactionStatus.IGNORED) ?? 0);
    const periodOptions = [
      ...[7, 30, 90, 365].map((value) => `<option value="${value}" ${String(value) === period ? 'selected' : ''}>Last ${value} days</option>`),
      `<option value="all" ${period === 'all' ? 'selected' : ''}>All time</option>`
    ].join('');
    const rankings = ranked.map((row, index) => {
      const user = usersById.get(row.userId);
      return `<tr><td>${index + 1}</td><td><b>${esc(user?.fullName ?? 'Unknown user')}</b><br><small>${esc(user?.email ?? '')}</small></td><td>${row._count._all}</td><td><b>${money(row._sum.amountKobo ?? 0n)}</b></td><td>${row._max.createdAt?.toLocaleString() ?? '—'}</td></tr>`;
    }).join('');
    const activity = recent.map((tx) => `<tr><td><b>${esc(tx.user.fullName)}</b><br><small>${esc(tx.user.email)}</small></td><td>${esc(tx.description)}</td><td>${esc(tx.type.replaceAll('_', ' '))}</td><td class="status ${tx.status.toLowerCase()}">${esc(tx.status)}</td><td>${money(tx.amountKobo)}</td><td>${tx.createdAt.toLocaleString()}</td></tr>`).join('');
    res.type('html').send(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Customer Activity</title><style>body{font-family:Arial,sans-serif;background:#f5f6f8;color:#18212f;margin:0;padding:28px}a{color:#8b6c00}.top{display:flex;justify-content:space-between;align-items:center;gap:16px}.cards{display:flex;gap:14px;flex-wrap:wrap;margin:20px 0}.card{background:#fff;border-radius:10px;padding:18px;min-width:160px;box-shadow:0 1px 4px #0001}.value{font-size:25px;font-weight:bold;margin-top:7px}table{border-collapse:collapse;width:100%;background:#fff;margin:12px 0 28px;box-shadow:0 1px 4px #0001}th,td{text-align:left;padding:12px;border-bottom:1px solid #eee;vertical-align:top}th{background:#d4af37;color:#111}small{color:#64748b}.status{font-weight:bold}.success{color:#16803c}.pending{color:#a66b00}.failed,.reversed,.declined,.ignored{color:#bd2336}select,button{padding:9px;border-radius:6px;border:1px solid #ccc}button{background:#d4af37;font-weight:bold;cursor:pointer}@media(max-width:700px){body{padding:14px;overflow-x:auto}.top{align-items:flex-start;flex-direction:column}table{min-width:850px}}</style></head><body><div class="top"><div><h1>Customer Activity</h1><p>All customer ledger activity; reward rankings include successful service purchases only.</p></div><a href="/admin">← Back to Admin Dashboard</a></div><form method="get"><label>Period <select name="period">${periodOptions}</select></label> <button type="submit">Apply</button></form><div class="cards"><div class="card">Total activities<div class="value">${totalActivities}</div></div><div class="card">Successful<div class="value">${statusCounts.get(TransactionStatus.SUCCESS) ?? 0}</div></div><div class="card">Pending<div class="value">${statusCounts.get(TransactionStatus.PENDING) ?? 0}</div></div><div class="card">Failed / reversed<div class="value">${failedActivities}</div></div><div class="card">Successful service spend<div class="value">${money(totalKobo)}</div></div></div><h2>Top customers — successful service purchases</h2><table><thead><tr><th>#</th><th>Customer</th><th>Purchases</th><th>Total spend</th><th>Last purchase</th></tr></thead><tbody>${rankings || '<tr><td colspan="5">No successful service purchases in this period.</td></tr>'}</tbody></table><h2>Recent customer activities (all services and statuses)</h2><table><thead><tr><th>Customer</th><th>Activity</th><th>Type</th><th>Status</th><th>Amount</th><th>When</th></tr></thead><tbody>${activity || '<tr><td colspan="6">No activity in this period.</td></tr>'}</tbody></table></body></html>`);
  });
}
