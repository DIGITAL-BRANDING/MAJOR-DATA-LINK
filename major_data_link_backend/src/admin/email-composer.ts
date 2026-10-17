import type { Request, Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { sendAdminEmail, type BulkSendResult, type DeliveryResult } from '../lib/email.js';
import { logAdminAction } from './audit.js';
import type { AdminSessionUser } from './auth.js';

declare module 'express-session' { interface SessionData { adminUser?: AdminSessionUser } }

function esc(v: string) {
  return v.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}

function field(req: Request, name: string) {
  const v = (req as unknown as { fields?: Record<string, string | string[] | undefined> }).fields?.[name];
  return typeof v === 'string' ? v.trim() : '';
}

/**
 * Statuses an admin needs to act on or chase. "sent" (accepted, still on its
 * way) and "delivery_delayed" are shown as waiting, not as problems.
 */
const PROBLEM_STATUSES = ['bounced', 'complained', 'failed', 'rejected', 'suppressed'];
const STATUS_LABELS: Record<string, string> = {
  sent: 'Accepted, awaiting delivery',
  delivery_delayed: 'Delayed',
  delivered: 'Delivered',
  bounced: 'Bounced',
  complained: 'Marked as spam',
  failed: 'Failed',
  suppressed: 'Blocked (bounced or complained before)',
  rejected: 'Rejected by Resend'
};

type RecentBroadcast = {
  id: string;
  subject: string;
  audience: string;
  recipientMode: string;
  recipientCount: number;
  createdAt: Date;
  adminEmail: string;
  counts: Record<string, number>;
  problemTotal: number;
  problems: Array<{ recipientEmail: string; status: string; errorMessage: string | null }>;
};

// Problem rows listed per send. Totals above it still count every recipient.
const PROBLEM_LIST_LIMIT = 50;

async function loadRecentBroadcasts(): Promise<RecentBroadcast[]> {
  const rows = await prisma.emailBroadcast.findMany({
    orderBy: { createdAt: 'desc' },
    take: 10,
    include: { createdByAdmin: { select: { email: true } } }
  });
  if (!rows.length) return [];

  const ids = rows.map((row) => row.id);
  const counts = await prisma.emailDelivery.groupBy({ by: ['broadcastId', 'status'], where: { broadcastId: { in: ids } }, _count: { _all: true } });

  return Promise.all(rows.map(async (row) => {
    const countMap: Record<string, number> = {};
    for (const c of counts) if (c.broadcastId === row.id) countMap[c.status] = c._count._all;
    const problemTotal = PROBLEM_STATUSES.reduce((sum, status) => sum + (countMap[status] ?? 0), 0);
    // Per broadcast, so one large send with many problems can't crowd out the others.
    const problems = problemTotal
      ? await prisma.emailDelivery.findMany({
          where: { broadcastId: row.id, status: { in: PROBLEM_STATUSES } },
          orderBy: { createdAt: 'desc' },
          take: PROBLEM_LIST_LIMIT,
          select: { recipientEmail: true, status: true, errorMessage: true }
        })
      : [];
    return {
      id: row.id,
      subject: row.subject,
      audience: row.audience,
      recipientMode: row.recipientMode,
      recipientCount: row.recipientCount,
      createdAt: row.createdAt,
      adminEmail: row.createdByAdmin.email,
      counts: countMap,
      problemTotal,
      problems
    };
  }));
}

/*
 * Send history. None of these throw: a history write problem must not hide the
 * send result from the admin. The broadcast row is created before sending and
 * recipient rows are written chunk by chunk, because Resend's delivery webhooks
 * can arrive while a large send is still running.
 */
async function startBroadcast(params: { adminId: string; audience: string; recipientMode: string; subject: string; recipientCount: number }): Promise<string | null> {
  try {
    const broadcast = await prisma.emailBroadcast.create({
      data: {
        createdByAdminId: params.adminId,
        audience: params.audience,
        recipientMode: params.recipientMode,
        subject: params.subject,
        recipientCount: params.recipientCount
      }
    });
    return broadcast.id;
  } catch (error) {
    console.error('[email-composer] could not record send history', error);
    return null;
  }
}

async function recordDeliveries(broadcastId: string | null, results: DeliveryResult[]) {
  if (!broadcastId || !results.length) return;
  try {
    const rows = results.map((r) => ({
      broadcastId,
      recipientEmail: r.email,
      resendEmailId: r.resendId ?? null,
      status: r.error ? 'rejected' : 'sent',
      errorMessage: r.error ?? null
    }));
    // Chunked: Postgres caps bind parameters per statement.
    for (let i = 0; i < rows.length; i += 1000) {
      await prisma.emailDelivery.createMany({ data: rows.slice(i, i + 1000) });
    }
  } catch (error) {
    console.error('[email-composer] could not record recipient deliveries', error);
  }
}

async function finishBroadcast(broadcastId: string | null, result: BulkSendResult) {
  if (!broadcastId) return;
  try {
    await prisma.emailBroadcast.update({
      where: { id: broadcastId },
      data: { acceptedCount: result.delivered ?? 0, failedCount: result.failed ?? 0 }
    });
  } catch (error) {
    console.error('[email-composer] could not update send history totals', error);
  }
}

function statusChips(counts: Record<string, number>, recipientCount: number) {
  const chips = [`<span class="chip">Recipients ${recipientCount}</span>`];
  for (const status of ['delivered', 'sent', 'delivery_delayed', 'bounced', 'complained', 'failed', 'suppressed', 'rejected']) {
    const n = counts[status];
    if (!n) continue;
    const cls = PROBLEM_STATUSES.includes(status) ? ' bad' : '';
    chips.push(`<span class="chip${cls}">${esc(STATUS_LABELS[status] ?? status)}: ${n}</span>`);
  }
  return chips.join('');
}

function broadcastsSection(broadcasts: RecentBroadcast[]) {
  if (!broadcasts.length) return '<h2>Recent sends</h2><p class="hint">No emails have been sent from here yet.</p>';
  const cards = broadcasts.map((b) => {
    const when = b.createdAt.toLocaleString('en-GB', { timeZone: 'Africa/Lagos' });
    const audienceLabel = b.audience === 'CUSTOMERS' ? 'Customers' : 'Partners';
    const modeLabel = b.recipientMode === 'ONE' ? 'one person' : 'everyone';
    const problemRows = b.problems
      .map((p) => `<tr><td>${esc(p.recipientEmail)}</td><td>${esc(STATUS_LABELS[p.status] ?? p.status)}</td><td>${esc(p.errorMessage ?? '')}</td></tr>`)
      .join('');
    const problemTable = b.problems.length
      ? `<table><tr><th>Recipient</th><th>Status</th><th>Reason</th></tr>${problemRows}</table>` +
        (b.problemTotal > b.problems.length ? `<p class="hint">Showing ${b.problems.length} of ${b.problemTotal} problem recipients.</p>` : '')
      : '';
    return `<div class="card"><h3>${esc(b.subject)}</h3><p class="hint">${esc(when)} · ${audienceLabel}, ${modeLabel} · sent by ${esc(b.adminEmail)}</p><div>${statusChips(b.counts, b.recipientCount)}</div>${problemTable}</div>`;
  }).join('');
  return `<h2>Recent sends</h2><p class="hint">Status updates automatically from Resend. "Accepted" means Resend has the message and it is still on its way. If nothing ever moves past "Accepted", check that the email.* events are enabled on the Resend webhook.</p>${cards}`;
}

function page(users: Array<{ id: string; fullName: string; email: string }>, partners: Array<{ id: string; businessName: string; email: string }>, broadcasts: RecentBroadcast[], flash = '') {
  const userOptions = users.map((x) => `<option value="${esc(x.id)}">${esc(x.fullName)} — ${esc(x.email)}</option>`).join('');
  const partnerOptions = partners.map((x) => `<option value="${esc(x.id)}">${esc(x.businessName)} — ${esc(x.email)}</option>`).join('');
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Send email</title><style>body{font:15px Arial,sans-serif;background:#f4f6fa;color:#18212f;max-width:850px;margin:30px auto;padding:0 18px}a{color:#0756b8;text-decoration:none}.card{background:#fff;border-radius:14px;padding:24px;box-shadow:0 2px 12px #0001;margin-top:20px}label{display:block;font-weight:bold;margin:16px 0 6px}input,select,textarea{box-sizing:border-box;width:100%;padding:11px;border:1px solid #cbd5e1;border-radius:8px;font:inherit}textarea{min-height:180px;resize:vertical}.row{display:grid;grid-template-columns:1fr 1fr;gap:16px}button{margin-top:18px;border:0;border-radius:8px;padding:12px 18px;background:#0b2f73;color:#fff;font-weight:bold;cursor:pointer}.flash{padding:12px;background:#e6f4ea;border-radius:8px;color:#155724}.hint{color:#64748b;font-size:13px}h2{margin-top:36px}h3{margin:0 0 6px;font-size:16px}table{width:100%;border-collapse:collapse;font-size:13px;margin-top:12px}td,th{text-align:left;padding:7px;border-bottom:1px solid #e2e8f0;word-break:break-all}.chip{display:inline-block;margin:6px 6px 0 0;padding:4px 10px;border-radius:999px;background:#eef2f8;font-size:12px}.chip.bad{background:#fde8e6;color:#b42318}@media(max-width:600px){.row{grid-template-columns:1fr}}</style></head><body><p><a href="/admin">← Admin dashboard</a></p><h1>Send an email</h1><p class="hint">Email one customer or partner, or send an announcement to the full selected audience. Messages are sent using Resend and recorded in the admin audit log.</p>${flash ? `<p class="flash">${esc(flash)}</p>` : ''}<form class="card" method="post" action="/admin/email-composer"><div class="row"><div><label>Audience</label><select id="audience" name="audience"><option value="CUSTOMERS">Customers</option><option value="PARTNERS">Partners</option></select></div><div><label>Recipients</label><select name="recipient_mode" id="mode"><option value="ALL">Everyone in this audience</option><option value="ONE">One person</option></select></div></div><label>Choose a recipient when sending to one person</label><select id="recipient" name="recipient_id"><option value="">Select a customer</option><optgroup label="Customers">${userOptions}</optgroup><optgroup label="Partners">${partnerOptions}</optgroup></select><label>Subject</label><input name="subject" required minlength="3" maxlength="200"><label>Message</label><textarea name="message" required minlength="2" maxlength="10000" placeholder="Write your message..."></textarea><button>Send email</button></form>${broadcastsSection(broadcasts)}<script>const a=document.querySelector('#audience'),m=document.querySelector('#mode'),r=document.querySelector('#recipient');function sync(){r.required=m.value==='ONE';for(const g of r.querySelectorAll('optgroup'))g.hidden=(a.value==='CUSTOMERS')!==(g.label==='Customers')}a.addEventListener('change',sync);m.addEventListener('change',sync);sync()</script></body></html>`;
}

export function registerEmailComposerRoutes(router: Router) {
  router.get('/email-composer', async (req, res) => {
    const admin = req.session?.adminUser;
    if (!admin) return res.redirect('/admin/login');
    if (admin.role === 'SUPPORT') return res.status(403).type('html').send('<p>Finance or Super Admin access required.</p>');

    const [users, partners, broadcasts] = await Promise.all([
      prisma.user.findMany({ where: { accountStatus: 'ACTIVE' }, select: { id: true, fullName: true, email: true }, orderBy: { fullName: 'asc' }, take: 2000 }),
      prisma.partner.findMany({ select: { id: true, businessName: true, email: true }, orderBy: { businessName: 'asc' }, take: 2000 }),
      loadRecentBroadcasts()
    ]);
    res.type('html').send(page(users, partners, broadcasts, typeof req.query.flash === 'string' ? req.query.flash : ''));
  });

  router.post('/email-composer', async (req, res) => {
    const admin = req.session?.adminUser;
    if (!admin) return res.redirect('/admin/login');
    if (admin.role === 'SUPPORT') return res.status(403).type('html').send('<p>Finance or Super Admin access required.</p>');

    try {
      const audience = field(req, 'audience');
      const mode = field(req, 'recipient_mode');
      const id = field(req, 'recipient_id');
      const subject = field(req, 'subject');
      const message = field(req, 'message');
      if (!['CUSTOMERS', 'PARTNERS'].includes(audience) || !['ALL', 'ONE'].includes(mode) || subject.length < 3 || subject.length > 200 || message.length < 2 || message.length > 10000 || (mode === 'ONE' && !id)) {
        throw new Error('Check the audience, recipient, subject and message.');
      }

      // Bulk announcements skip anyone who unsubscribed on Resend (see resend-contacts.ts and
      // the /api/webhooks/resend handler). A deliberate one-to-one send is still allowed.
      const bulk = mode === 'ALL' ? { emailSubscribed: true } : {};
      const rows = audience === 'CUSTOMERS'
        ? await prisma.user.findMany({ where: { accountStatus: 'ACTIVE', ...bulk, ...(mode === 'ONE' ? { id } : {}) }, select: { email: true }, take: mode === 'ONE' ? 1 : 10000 })
        : await prisma.partner.findMany({ where: { ...bulk, ...(mode === 'ONE' ? { id } : {}) }, select: { email: true }, take: mode === 'ONE' ? 1 : 10000 });
      if (!rows.length) throw new Error('No recipients were found.');

      const broadcastId = await startBroadcast({ adminId: admin.id, audience, recipientMode: mode, subject, recipientCount: rows.length });
      const result = await sendAdminEmail(
        { recipients: rows.map((x) => x.email), subject, message },
        { onChunk: (results) => recordDeliveries(broadcastId, results) }
      );
      await finishBroadcast(broadcastId, result);

      await logAdminAction({
        adminId: admin.id,
        action: 'SEND_ADMIN_EMAIL',
        targetType: audience,
        metadata: { audience, recipientMode: mode, recipientCount: rows.length, delivered: result.delivered, failed: result.failed, subject, sent: result.sent, broadcastId }
      });
      if (!result.sent) throw new Error(result.error ?? 'Email delivery failed.');

      const delivered = result.delivered ?? rows.length;
      const failed = result.failed ?? 0;
      res.redirect('/admin/email-composer?flash=' + encodeURIComponent(
        failed > 0
          ? `Email sent to ${delivered} of ${rows.length} recipients; ${failed} could not be delivered (see Recent sends below).`
          : `Email sent to ${delivered} recipient${delivered === 1 ? '' : 's'}. Delivery status appears under Recent sends.`
      ));
    } catch (e) {
      res.redirect('/admin/email-composer?flash=' + encodeURIComponent(e instanceof Error ? e.message : 'Could not send email.'));
    }
  });
}
