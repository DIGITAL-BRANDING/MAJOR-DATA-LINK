import type { Request, Router } from 'express';
import { logAdminAction } from './audit.js';
import type { AdminSessionUser } from './auth.js';
import { prisma } from '../lib/prisma.js';
import { koboToNaira } from '../lib/money.js';
import { ApiError } from '../middleware/error.js';
import { getPartnerActivitySummary, manualPartnerWalletAdjustment } from '../services/partner-wallet.service.js';

declare module 'express-session' {
  interface SessionData {
    adminUser?: AdminSessionUser;
  }
}

// Same req.fields/req.body caveat as admin/user-wallet.ts: AdminJSExpress's
// buildAuthenticatedRouter() already mounts express-formidable ahead of
// every route on this router, so POST bodies here arrive on req.fields, not
// req.body - and this file must not chain its own body parser.
type FormidableFields = Record<string, string | string[] | undefined>;
function fields(req: Request): FormidableFields {
  return ((req as unknown as { fields?: FormidableFields }).fields ?? {}) as FormidableFields;
}
function field(req: Request, name: string): string {
  const v = fields(req)[name];
  return typeof v === 'string' ? v : '';
}

/**
 * Answers "who is this partner, what have they actually called, and what's
 * in their wallet" in one place - the API Partner equivalent of
 * admin/user-wallet.ts. Search by business name, email, phone, or partner
 * id, then see call totals (today/all-time/success/fail), total spend, wallet
 * balance, and a recent activity list, without an admin needing the
 * partner's internal id up front to filter the PartnerTransaction resource
 * (that resource's own `partner` filter still works for the FULL ledger once
 * you're here; this page is the fast lookup + summary in front of it).
 *
 * Call/spend numbers come from getPartnerActivitySummary() (see
 * partner-wallet.service.ts), the exact same aggregation the partner's own
 * portal dashboard (/api/partner-portal/summary) uses - so this page and
 * what the partner sees when they log in always agree.
 *
 * The search + summary is visible to any logged-in admin role (including
 * SUPPORT) - it's the kind of account-activity lookup support staff field
 * partner questions with routinely. The Credit/Debit form is real money
 * movement, so that part is gated to FINANCE/SUPER_ADMIN, same as the User
 * Wallet and Bulk Pricing tools.
 *
 * Manual credits/debits go through manualPartnerWalletAdjustment(), which
 * records a MANUAL_ADJUSTMENT PartnerTransaction with its own generated
 * `MDL-ADJ-...` reference, separate from any commercial-API-driven or
 * webhook-driven transaction reference.
 */
export function registerPartnerLookupRoutes(router: Router) {
  router.get('/partner-lookup', async (req, res) => {
    const admin = req.session?.adminUser;
    if (!admin) return res.redirect('/admin/login');

    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    let partner: Awaited<ReturnType<typeof findPartner>> = null;
    let summary: Awaited<ReturnType<typeof getPartnerActivitySummary>> | null = null;
    let apiKeyCounts: { active: number; revoked: number } | null = null;
    let recentTransactions: Awaited<ReturnType<typeof recentTransactionsFor>> = [];
    let notFound = false;

    if (q) {
      partner = await findPartner(q);
      if (partner) {
        [summary, apiKeyCounts, recentTransactions] = await Promise.all([
          getPartnerActivitySummary(partner.id),
          apiKeyCountsFor(partner.id),
          recentTransactionsFor(partner.id)
        ]);
      } else {
        notFound = true;
      }
    }

    res.type('html').send(
      renderPage({ admin, q, partner, summary, apiKeyCounts, recentTransactions, notFound, flash: flashFromQuery(req.query) })
    );
  });

  router.post('/partner-lookup/:partnerId/adjust', async (req, res) => {
    const admin = requireFinanceOrSuper(req);
    const q = field(req, 'q');
    const backTo = (flash: string) => `/admin/partner-lookup?q=${encodeURIComponent(q)}&flash=${flash}`;

    if (!admin) return res.redirect('/admin/login');

    const { partnerId } = req.params;
    const directionRaw = field(req, 'direction');
    const direction = directionRaw === 'debit' ? 'debit' : directionRaw === 'credit' ? 'credit' : null;
    const amount = parsePositiveAmount(field(req, 'amount'));
    const reason = field(req, 'reason').trim();

    if (!direction || amount === null || reason.length < 4) {
      return res.redirect(backTo(encodeFlash('error', 'Enter a valid amount and a reason (min 4 characters) before submitting.')));
    }

    try {
      const { transaction, balanceAfter } = await manualPartnerWalletAdjustment({
        partnerId,
        direction,
        amount,
        reason,
        adminId: admin.id
      });

      await logAdminAction({
        adminId: admin.id,
        action: direction === 'credit' ? 'MANUAL_PARTNER_WALLET_CREDIT' : 'MANUAL_PARTNER_WALLET_DEBIT',
        targetType: 'Partner',
        targetId: partnerId,
        metadata: { transactionId: transaction.id, amount, reason, balanceAfterKobo: balanceAfter.toString() }
      });

      return res.redirect(
        backTo(
          encodeFlash(
            'success',
            `Partner wallet ${direction === 'credit' ? 'credited' : 'debited'} with NGN${amount.toLocaleString('en-NG', { minimumFractionDigits: 2 })}. New balance: NGN${koboToNaira(balanceAfter).toLocaleString('en-NG', { minimumFractionDigits: 2 })}.`
          )
        )
      );
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Something went wrong applying this adjustment. Check the server logs.';
      console.error('[partner-lookup] manual adjustment failed:', error);
      return res.redirect(backTo(encodeFlash('error', message)));
    }
  });
}

function requireFinanceOrSuper(req: Request): AdminSessionUser | null {
  const admin = req.session?.adminUser;
  if (!admin || admin.role === 'SUPPORT') return null;
  return admin;
}

function parsePositiveAmount(value: unknown): number | null {
  if (typeof value !== 'string' || value.trim() === '') return null;
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function encodeFlash(type: 'success' | 'error', message: string): string {
  return encodeURIComponent(`${type}:${message}`);
}

function flashFromQuery(query: Request['query']): { type: 'success' | 'error'; message: string } | null {
  const raw = query.flash;
  if (typeof raw !== 'string') return null;
  const [type, ...rest] = raw.split(':');
  if (type !== 'success' && type !== 'error') return null;
  return { type, message: rest.join(':') };
}

async function findPartner(q: string) {
  return prisma.partner.findFirst({
    where: {
      OR: [
        { id: q },
        { email: { equals: q, mode: 'insensitive' } },
        { phone: { contains: q } },
        { businessName: { contains: q, mode: 'insensitive' } },
        { virtualAccountNumber: { contains: q } }
      ]
    },
    select: {
      id: true,
      businessName: true,
      email: true,
      phone: true,
      walletBalanceKobo: true,
      status: true,
      virtualAccountNumber: true,
      virtualAccountBank: true,
      virtualAccountProvider: true,
      webhookUrl: true,
      lastPortalLoginAt: true,
      createdAt: true
    }
  });
}

async function apiKeyCountsFor(partnerId: string) {
  const [active, revoked] = await Promise.all([
    prisma.partnerApiKey.count({ where: { partnerId, revokedAt: null } }),
    prisma.partnerApiKey.count({ where: { partnerId, revokedAt: { not: null } } })
  ]);
  return { active, revoked };
}

async function recentTransactionsFor(partnerId: string) {
  return prisma.partnerTransaction.findMany({
    where: { partnerId },
    orderBy: { createdAt: 'desc' },
    take: 25,
    select: { id: true, type: true, status: true, amountKobo: true, description: true, createdAt: true, reference: true }
  });
}

function naira(amount: number): string {
  return `₦${amount.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function escape(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function canFinance(admin: AdminSessionUser): boolean {
  return admin.role === 'SUPER_ADMIN' || admin.role === 'FINANCE';
}

const STATUS_COLOR: Record<string, string> = {
  SUCCESS: '#1E7B34',
  PENDING: '#9C7A17',
  FAILED: '#B3261E',
  REVERSED: '#6B6248'
};

const PARTNER_STATUS_COLOR: Record<string, string> = {
  ACTIVE: '#1E7B34',
  PENDING_REVIEW: '#9C7A17',
  SUSPENDED: '#B3261E'
};

function renderPage(params: {
  admin: AdminSessionUser;
  q: string;
  partner: Awaited<ReturnType<typeof findPartner>>;
  summary: Awaited<ReturnType<typeof getPartnerActivitySummary>> | null;
  apiKeyCounts: { active: number; revoked: number } | null;
  recentTransactions: Awaited<ReturnType<typeof recentTransactionsFor>>;
  notFound: boolean;
  flash: { type: 'success' | 'error'; message: string } | null;
}) {
  const { admin, q, partner, summary, apiKeyCounts, recentTransactions, notFound, flash } = params;

  const flashHtml = flash
    ? `<div class="banner ${flash.type === 'success' ? 'banner-success' : ''}">${escape(flash.message)}</div>`
    : '';

  const adjustFormHtml =
    partner && canFinance(admin)
      ? `
    <div class="card">
      <h2>Credit / Debit wallet</h2>
      <p class="hint">For manual corrections - e.g. a bank transfer the partner made outside their virtual account, or a negotiated adjustment. Be specific in the reason; it's kept in the audit log and shown in this partner's transaction history.</p>
      <form method="POST" action="/admin/partner-lookup/${encodeURIComponent(partner.id)}/adjust" class="adjust-form">
        <input type="hidden" name="q" value="${escape(q)}">
        <label>Direction
          <select name="direction" required>
            <option value="credit">Credit (add money)</option>
            <option value="debit">Debit (remove money)</option>
          </select>
        </label>
        <label>Amount (₦)
          <input type="number" name="amount" min="0.01" step="0.01" required placeholder="e.g. 20000.00">
        </label>
        <label class="reason-label">Reason (kept in the audit log and the partner's transaction history)
          <textarea name="reason" required minlength="4" rows="2" placeholder="e.g. Bank transfer ref XXXX confirmed, virtual account funding delayed"></textarea>
        </label>
        <button type="submit">Apply adjustment</button>
      </form>
    </div>`
      : '';

  const resultHtml = notFound
    ? `<div class="banner">No partner found matching "${escape(q)}". Try their business name, email, phone number, virtual account number, or partner id.</div>`
    : partner && summary && apiKeyCounts
      ? `
    <div class="card">
      <h2>${escape(partner.businessName)} <span class="status" style="color:${PARTNER_STATUS_COLOR[partner.status] ?? '#1A1508'}">${escape(partner.status)}</span></h2>
      <p class="hint">${escape(partner.email)} &middot; ${escape(partner.phone ?? 'no phone on file')} &middot; joined ${partner.createdAt.toLocaleDateString('en-NG')}${partner.lastPortalLoginAt ? ` &middot; last portal login ${partner.lastPortalLoginAt.toLocaleString('en-NG')}` : ' &middot; has never logged into the portal'}</p>
      ${partner.virtualAccountNumber ? `<p class="hint">Virtual account: ${escape(partner.virtualAccountNumber)} (${escape(partner.virtualAccountBank ?? '')}, via ${escape(partner.virtualAccountProvider ?? 'paystack')})</p>` : '<p class="hint">No virtual account provisioned yet.</p>'}
      <p class="hint">API keys: ${apiKeyCounts.active} active, ${apiKeyCounts.revoked} revoked. ${partner.webhookUrl ? `Webhook configured: ${escape(partner.webhookUrl)}` : 'No webhook URL configured.'}</p>
      <a class="link" href="/admin/resources/Partner/records/${encodeURIComponent(partner.id)}/show">Open full Partner record (approve, suspend, generate/reset keys) &rarr;</a><br>
      <a class="link" href="/admin/resources/PartnerTransaction?filters.partner=${encodeURIComponent(partner.id)}">View full API call ledger for this partner &rarr;</a>
    </div>

    <div class="stats">
      <div class="stat"><div class="label">Current wallet balance</div><div class="value">${naira(koboToNaira(partner.walletBalanceKobo))}</div></div>
      <div class="stat"><div class="label">Total API calls (all-time)</div><div class="value">${summary.totalCalls}</div></div>
      <div class="stat"><div class="label">API calls today</div><div class="value">${summary.todayCalls}</div></div>
      <div class="stat"><div class="label">Successful calls</div><div class="value">${summary.successfulCalls}</div></div>
      <div class="stat"><div class="label">Failed calls</div><div class="value">${summary.failedCalls}</div></div>
      <div class="stat"><div class="label">Total spend (successful)</div><div class="value">${naira(summary.totalSpend)}</div></div>
    </div>

    ${adjustFormHtml}

    <div class="card">
      <h2>Recent activity</h2>
      <p class="hint">Last ${recentTransactions.length} transaction(s)/call(s). Full history via the link above.</p>
      <table>
        <thead><tr><th>When</th><th>Type</th><th>Description</th><th class="num">Amount</th><th>Status</th></tr></thead>
        <tbody>${recentTransactions
          .map(
            (t: (typeof recentTransactions)[number]) => `<tr>
          <td>${t.createdAt.toLocaleString('en-NG')}</td>
          <td>${escape(t.type)}</td>
          <td>${escape(t.description)}</td>
          <td class="num">${naira(koboToNaira(t.amountKobo))}</td>
          <td><span class="status" style="color:${STATUS_COLOR[t.status] ?? '#1A1508'}">${escape(t.status)}</span></td>
        </tr>`
          )
          .join('')}</tbody>
      </table>
    </div>`
      : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Partner Lookup — Admin</title>
<style>
  :root { --gold: #D4AF37; --gold-dark: #9C7A17; --bg: #FAF7EF; --card: #FFFFFF; --text: #1A1508; --muted: #6B6248; --border: #E9E1C8; --green: #1E7B34; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: var(--bg); color: var(--text); padding: 24px; }
  .wrap { max-width: 980px; margin: 0 auto; }
  header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; }
  header h1 { font-size: 20px; margin: 0; }
  header a.back { color: var(--gold-dark); text-decoration: none; font-size: 14px; }
  .search { display: flex; gap: 10px; margin-bottom: 20px; }
  .search input { flex: 1; padding: 12px 14px; border: 1px solid var(--border); border-radius: 8px; font-size: 14px; background: #FFFDF5; }
  .search button { background: var(--gold); color: #1A1508; border: none; padding: 0 22px; border-radius: 8px; font-weight: 700; font-size: 14px; cursor: pointer; }
  .search button:hover { background: var(--gold-dark); color: #fff; }
  .banner { background: #FDECEC; border: 1px solid #F3C6C4; color: #B3261E; padding: 12px 16px; border-radius: 10px; font-size: 13px; margin-bottom: 20px; }
  .banner-success { background: #EAF6EC; border-color: #B9E0BF; color: #1E7B34; }
  .adjust-form { display: grid; grid-template-columns: 1fr 1fr; gap: 12px 16px; }
  .adjust-form label { display: flex; flex-direction: column; gap: 6px; font-size: 12px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.03em; }
  .adjust-form select, .adjust-form input, .adjust-form textarea { font-size: 14px; padding: 10px 12px; border: 1px solid var(--border); border-radius: 8px; font-family: inherit; text-transform: none; color: var(--text); background: #FFFDF5; }
  .adjust-form .reason-label { grid-column: 1 / -1; }
  .adjust-form button { grid-column: 1 / -1; justify-self: start; background: var(--gold); color: #1A1508; border: none; padding: 10px 22px; border-radius: 8px; font-weight: 700; font-size: 14px; cursor: pointer; }
  .adjust-form button:hover { background: var(--gold-dark); color: #fff; }
  .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 14px; margin-bottom: 20px; }
  .stat { background: var(--card); border: 1px solid var(--border); border-radius: 12px; padding: 14px 16px; }
  .stat .label { font-size: 11px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 6px; }
  .stat .value { font-size: 19px; font-weight: 700; }
  .card { background: var(--card); border: 1px solid var(--border); border-radius: 12px; padding: 20px 24px; margin-bottom: 20px; }
  .card h2 { font-size: 16px; margin: 0 0 4px; }
  .card p.hint { color: var(--muted); font-size: 13px; margin: 0 0 8px; }
  .link { color: var(--gold-dark); text-decoration: none; font-size: 13px; font-weight: 600; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; margin-top: 12px; }
  th { text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 0.03em; color: var(--muted); padding: 8px 10px; border-bottom: 2px solid var(--border); }
  td { padding: 9px 10px; border-bottom: 1px solid var(--border); }
  td.num, th.num { text-align: right; font-variant-numeric: tabular-nums; }
  .status { font-weight: 700; font-size: 12px; }
  .current { font-size: 13px; color: var(--muted); margin-top: 4px; }
</style>
</head>
<body>
<div class="wrap">
  <header>
    <h1>Partner Lookup</h1>
    <a class="back" href="/admin">&larr; Back to admin panel</a>
  </header>

  <form class="search" method="GET" action="/admin/partner-lookup">
    <input type="text" name="q" placeholder="Search by business name, email, phone, virtual account number, or partner id..." value="${escape(q)}" autofocus>
    <button type="submit">Search</button>
  </form>

  ${flashHtml}

  ${resultHtml}

  <p class="current">Signed in as ${escape(admin.fullName)} (${escape(admin.role)})</p>
</div>
</body>
</html>`;
}
