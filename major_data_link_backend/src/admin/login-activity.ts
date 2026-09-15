import type { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import type { AdminSessionUser } from './auth.js';

declare module 'express-session' {
  interface SessionData {
    adminUser?: AdminSessionUser;
  }
}

const escapeHtml = (value: unknown) =>
  String(value ?? '').replace(/[&<>'"]/g, (char) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char] ?? char,
  );

function displayChannel(channel: string | null) {
  if (channel === 'MOBILE_APP') return 'Mobile app';
  if (channel === 'WEB') return 'Web';
  return 'Unknown / older session';
}

/**
 * A compact, privacy-minimised operational view. It deliberately shows only
 * the latest successful sign-in, never a browser fingerprint, device ID, IP
 * address, password event or failed-attempt detail.
 */
export function registerLoginActivityRoutes(router: Router) {
  router.get('/login-activity', async (req, res) => {
    const admin = req.session?.adminUser;
    if (!admin) return res.redirect('/admin/login');

    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    const pageRaw = Number(req.query.page);
    const page = Number.isInteger(pageRaw) && pageRaw > 0 ? Math.min(pageRaw, 10_000) : 1;
    const pageSize = 50;
    const where = q
      ? {
          OR: [
            { fullName: { contains: q, mode: 'insensitive' as const } },
            { email: { contains: q, mode: 'insensitive' as const } },
            { phone: { contains: q, mode: 'insensitive' as const } }
          ]
        }
      : {};
    const [users, total, partners] = await Promise.all([
      prisma.user.findMany({
        where,
        orderBy: [{ lastLoginAt: 'desc' }, { createdAt: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: { fullName: true, email: true, phone: true, lastLoginAt: true, lastLoginChannel: true, createdAt: true }
      }),
      prisma.user.count({ where }),
      // Partner accounts are browser-only and intentionally separate from
      // customer rows, but are included so admins can see portal activity.
      prisma.partner.findMany({
        orderBy: [{ lastPortalLoginAt: 'desc' }, { createdAt: 'desc' }],
        take: 20,
        select: { businessName: true, email: true, lastPortalLoginAt: true }
      })
    ]);

    const userRows = users
      .map(
        (user) => `<tr><td><b>${escapeHtml(user.fullName)}</b><br><small>${escapeHtml(user.email)} · ${escapeHtml(user.phone)}</small></td><td>${escapeHtml(displayChannel(user.lastLoginChannel))}</td><td>${user.lastLoginAt?.toLocaleString() ?? 'Not recorded yet'}</td><td>${user.createdAt.toLocaleString()}</td></tr>`,
      )
      .join('');
    const partnerRows = partners
      .map(
        (partner) => `<tr><td><b>${escapeHtml(partner.businessName)}</b><br><small>${escapeHtml(partner.email)}</small></td><td>Partner Portal (web)</td><td>${partner.lastPortalLoginAt?.toLocaleString() ?? 'Not recorded yet'}</td></tr>`,
      )
      .join('');
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const base = `/admin/login-activity?q=${encodeURIComponent(q)}`;
    const pagination = `<div class="pages">${page > 1 ? `<a href="${base}&page=${page - 1}">← Previous</a>` : ''}<span>Page ${page} of ${totalPages} · ${total} customers</span>${page < totalPages ? `<a href="${base}&page=${page + 1}">Next →</a>` : ''}</div>`;

    res.type('html').send(`<!doctype html><html><head><meta charset="utf-8"><title>Login Activity</title><style>body{font-family:Arial,sans-serif;background:#f5f6f8;color:#18212f;margin:0;padding:28px}a{color:#0756b8;font-weight:600;text-decoration:none}.top{display:flex;justify-content:space-between;gap:16px;align-items:center}.card,table{background:#fff;border-radius:12px;box-shadow:0 1px 4px #0001}.card{padding:18px;margin:20px 0}table{border-collapse:collapse;width:100%;margin:12px 0 28px}th,td{text-align:left;padding:12px;border-bottom:1px solid #eee;vertical-align:top}th{background:#0756b8;color:#fff}small{color:#64748b}input,button{padding:10px;border:1px solid #cbd5e1;border-radius:7px}button{background:#0b65c2;color:#fff;font-weight:bold;cursor:pointer}.pages{display:flex;justify-content:space-between;gap:12px;align-items:center;margin:14px 0}</style></head><body><div class="top"><div><h1>Login Activity</h1><p>Latest successful customer sign-in and reported channel. No device fingerprints or IP addresses are stored.</p></div><a href="/admin">← Back to Admin Dashboard</a></div><form class="card" method="get"><input name="q" value="${escapeHtml(q)}" placeholder="Search name, email or phone" autofocus><button type="submit">Search</button></form>${pagination}<table><thead><tr><th>Customer</th><th>Last channel</th><th>Last successful login</th><th>Joined</th></tr></thead><tbody>${userRows || '<tr><td colspan="4">No customers found.</td></tr>'}</tbody></table><h2>Partner Portal logins</h2><table><thead><tr><th>Partner</th><th>Channel</th><th>Last successful login</th></tr></thead><tbody>${partnerRows || '<tr><td colspan="3">No partner accounts found.</td></tr>'}</tbody></table></body></html>`);
  });
}
