import type { Request, Router } from 'express';
import { PartnerStatus, NotificationType } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import type { AdminSessionUser } from './auth.js';
import { logAdminAction } from './audit.js';
import { notifyPartnerSafely } from '../services/notification.service.js';
import { ensurePartnerEnterpriseOfferCode } from '../services/partner-enterprise-profile.service.js';

type FormidableFields = Record<string, string | string[] | undefined>;

function fields(req: Request): FormidableFields {
  return ((req as unknown as { fields?: FormidableFields }).fields ?? {}) as FormidableFields;
}

function field(req: Request, name: string): string {
  const value = fields(req)[name];
  return typeof value === 'string' ? value : Array.isArray(value) ? value[0] ?? '' : '';
}

function reviewer(req: Request): AdminSessionUser | null {
  const admin = req.session?.adminUser;
  return admin && (admin.role === 'SUPER_ADMIN' || admin.role === 'FINANCE') ? admin : null;
}

function escape(value: unknown): string {
  return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function statusValue(value: unknown): PartnerStatus {
  return value === 'ACTIVE' || value === 'REJECTED' || value === 'SUSPENDED' ? value : 'PENDING_REVIEW';
}

function statusLabel(status: PartnerStatus): string {
  return status === PartnerStatus.PENDING_REVIEW ? 'Pending review' : status === PartnerStatus.ACTIVE ? 'Active' : status === PartnerStatus.REJECTED ? 'Rejected' : 'Suspended';
}

function requestedServices(value: unknown): string {
  if (!Array.isArray(value)) return 'Not specified';
  return value.map((item) => String(item)).filter(Boolean).join(', ') || 'Not specified';
}

export function registerPartnerApplicationRoutes(router: Router) {
  router.get('/partner-applications', async (req, res) => {
    const admin = reviewer(req);
    if (!admin) return res.redirect('/admin/login');

    const selectedStatus = statusValue(req.query.status);
    const search = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    const where = {
      status: selectedStatus,
      ...(search ? { OR: [{ businessName: { contains: search, mode: 'insensitive' as const } }, { email: { contains: search, mode: 'insensitive' as const } }, { companyRegistrationNumber: { contains: search, mode: 'insensitive' as const } }] } : {})
    };

    const [rows, pending, active, rejected, suspended] = await Promise.all([
      prisma.partner.findMany({ where, orderBy: { createdAt: 'desc' }, take: 100, select: { id: true, businessName: true, email: true, phone: true, contactName: true, companyRegistrationNumber: true, businessType: true, websiteUrl: true, useCase: true, expectedMonthlyVolume: true, requestedServices: true, integrationEnvironment: true, technicalContactEmail: true, technicalContactPhone: true, enterpriseOfferCode: true, status: true, createdAt: true } }),
      prisma.partner.count({ where: { status: PartnerStatus.PENDING_REVIEW } }),
      prisma.partner.count({ where: { status: PartnerStatus.ACTIVE } }),
      prisma.partner.count({ where: { status: PartnerStatus.REJECTED } }),
      prisma.partner.count({ where: { status: PartnerStatus.SUSPENDED } })
    ]);

    const notice = typeof req.query.flash === 'string' ? decodeURIComponent(req.query.flash) : '';
    return res.type('html').send(renderPage(admin, rows, selectedStatus, search, { pending_review: pending, active, rejected, suspended }, notice));
  });

  router.post('/partner-applications/:id/approve', async (req, res) => {
    const admin = reviewer(req);
    if (!admin) return res.redirect('/admin/login');
    const partner = await prisma.partner.findUnique({ where: { id: req.params.id }, select: { id: true, businessName: true, status: true } });
    if (!partner) return res.redirect('/admin/partner-applications?status=PENDING_REVIEW');
    if (partner.status !== PartnerStatus.PENDING_REVIEW) return res.redirect(`/admin/partner-applications?status=${partner.status}&flash=${encodeURIComponent('Only pending applications can be approved.')}`);

    const offerCode = await ensurePartnerEnterpriseOfferCode(partner.id);
    await prisma.partner.update({ where: { id: partner.id }, data: { status: PartnerStatus.ACTIVE } });
    await logAdminAction({ adminId: admin.id, action: 'APPROVE_PARTNER_APPLICATION', targetType: 'Partner', targetId: partner.id, metadata: { enterpriseOfferCode: offerCode } });
    notifyPartnerSafely({ partnerId: partner.id, type: NotificationType.SYSTEM, title: 'Enterprise API application approved', body: 'Your K-Tech Solutions API partner application has been approved. Sign in to configure your API key, webhook and private pricing offer.' });
    return res.redirect('/admin/partner-applications?status=PENDING_REVIEW&flash=' + encodeURIComponent(`${partner.businessName} is now active. Review pricing before onboarding is complete.`));
  });

  router.post('/partner-applications/:id/reject', async (req, res) => {
    const admin = reviewer(req);
    if (!admin) return res.redirect('/admin/login');
    const partner = await prisma.partner.findUnique({ where: { id: req.params.id }, select: { id: true, businessName: true, status: true } });
    if (!partner) return res.redirect('/admin/partner-applications?status=PENDING_REVIEW');
    if (partner.status !== PartnerStatus.PENDING_REVIEW) return res.redirect(`/admin/partner-applications?status=${partner.status}&flash=${encodeURIComponent('Only pending applications can be rejected.')}`);

    const note = field(req, 'note').trim().slice(0, 1000);
    await prisma.partner.update({ where: { id: partner.id }, data: { status: PartnerStatus.REJECTED } });
    await logAdminAction({ adminId: admin.id, action: 'REJECT_PARTNER_APPLICATION', targetType: 'Partner', targetId: partner.id, metadata: { note } });
    notifyPartnerSafely({ partnerId: partner.id, type: NotificationType.SYSTEM, title: 'Enterprise API application update', body: note ? `Your application needs further review. Note from K-Tech Solutions: ${note}` : 'Your enterprise API application was not approved at this time. Please contact K-Tech Solutions for next steps.' });
    return res.redirect('/admin/partner-applications?status=PENDING_REVIEW&flash=' + encodeURIComponent(`${partner.businessName} was marked rejected and the partner was notified.`));
  });

  router.post('/partner-applications/:id/reopen', async (req, res) => {
    const admin = reviewer(req);
    if (!admin) return res.redirect('/admin/login');
    const partner = await prisma.partner.findUnique({ where: { id: req.params.id }, select: { id: true, businessName: true, status: true } });
    if (!partner) return res.redirect('/admin/partner-applications?status=REJECTED');
    if (partner.status !== PartnerStatus.REJECTED) return res.redirect(`/admin/partner-applications?status=${partner.status}&flash=${encodeURIComponent('Only rejected applications can be reopened.')}`);
    await prisma.partner.update({ where: { id: partner.id }, data: { status: PartnerStatus.PENDING_REVIEW } });
    await logAdminAction({ adminId: admin.id, action: 'REOPEN_PARTNER_APPLICATION', targetType: 'Partner', targetId: partner.id });
    notifyPartnerSafely({ partnerId: partner.id, type: NotificationType.SYSTEM, title: 'Enterprise API application reopened', body: 'Your application has been reopened for review by K-Tech Solutions.' });
    return res.redirect('/admin/partner-applications?status=REJECTED&flash=' + encodeURIComponent(`${partner.businessName} is back in the pending review queue.`));
  });
}

function renderPage(admin: AdminSessionUser, rows: Array<{ id: string; businessName: string; email: string; phone: string | null; contactName: string | null; companyRegistrationNumber: string | null; businessType: string | null; websiteUrl: string | null; useCase: string | null; expectedMonthlyVolume: number | null; requestedServices: unknown; integrationEnvironment: string | null; technicalContactEmail: string | null; technicalContactPhone: string | null; enterpriseOfferCode: string | null; status: PartnerStatus; createdAt: Date }>, selectedStatus: PartnerStatus, search: string, counts: Record<string, number>, notice: string) {
  const statusTabs = (['PENDING_REVIEW', 'ACTIVE', 'REJECTED', 'SUSPENDED'] as PartnerStatus[]).map((status) => `<a class="tab ${selectedStatus === status ? 'selected' : ''}" href="/admin/partner-applications?status=${status}">${escape(statusLabel(status))}<b>${counts[status.toLowerCase()] ?? 0}</b></a>`).join('');
  const rowsHtml = rows.map((row) => {
    const services = requestedServices(row.requestedServices);
    const action = row.status === PartnerStatus.PENDING_REVIEW ? `<div class="actions"><form method="post" action="/admin/partner-applications/${encodeURIComponent(row.id)}/approve" onsubmit="return confirm('Approve this enterprise partner?')"><button class="approve" type="submit">Approve</button></form><form method="post" action="/admin/partner-applications/${encodeURIComponent(row.id)}/reject"><input name="note" maxlength="1000" placeholder="Optional review note"><button class="reject" type="submit">Reject</button></form></div>` : row.status === PartnerStatus.REJECTED ? `<div class="actions"><form method="post" action="/admin/partner-applications/${encodeURIComponent(row.id)}/reopen" onsubmit="return confirm('Move this application back to pending review?')"><button class="approve" type="submit">Reopen for review</button></form></div>` : '';
    return `<article class="application"><div class="application-head"><div><h2>${escape(row.businessName)}</h2><p>${escape(row.email)} · ${escape(row.contactName ?? 'No contact name')}</p></div><span class="status ${row.status.toLowerCase()}">${escape(statusLabel(row.status))}</span></div><div class="grid"><div><b>Company</b><span>${escape(row.businessType ?? 'Not specified')} · ${escape(row.companyRegistrationNumber ?? 'No RC/BN')}</span><span>${row.phone ? escape(row.phone) : 'No phone number'}${row.websiteUrl ? ` · <a href="${escape(row.websiteUrl)}" target="_blank" rel="noreferrer">Website</a>` : ''}</span></div><div><b>Integration</b><span>${escape(services)}</span><span>${escape(row.integrationEnvironment ?? 'sandbox')} · ${row.expectedMonthlyVolume ? `${row.expectedMonthlyVolume.toLocaleString()} requests/month` : 'Volume not specified'}</span></div><div><b>Technical contact</b><span>${escape(row.technicalContactEmail ?? 'Not specified')}</span><span>${escape(row.technicalContactPhone ?? 'No phone')}</span></div><div><b>Submitted</b><span>${escape(row.createdAt.toLocaleString())}</span><span>${row.enterpriseOfferCode ? `Offer: <code>${escape(row.enterpriseOfferCode)}</code>` : 'Offer code pending'}</span></div></div><details><summary>Use case and review details</summary><p>${escape(row.useCase ?? 'No use case supplied')}</p><p><a href="/admin/partner-pricing?partnerId=${encodeURIComponent(row.id)}">Set partner-specific pricing →</a> · <a href="/admin/resources/Partner/records/${encodeURIComponent(row.id)}/show">Open partner record →</a></p></details>${action}</article>`;
  }).join('');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Enterprise Partner Applications</title><style>:root{--navy:#0b2f73;--cyan:#0e7490;--bg:#f3f6fa;--card:#fff;--text:#172033;--muted:#64748b;--border:#dbe4ef}*{box-sizing:border-box}body{margin:0;padding:24px;background:var(--bg);color:var(--text);font:14px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.wrap{max-width:1180px;margin:auto}header{display:flex;justify-content:space-between;align-items:center;gap:16px;margin-bottom:20px}h1{margin:0;font-size:25px}h2{margin:0;font-size:18px}a{color:#0756b8;text-decoration:none}.sub{color:var(--muted);margin:6px 0 0}.toolbar{display:flex;gap:10px;flex-wrap:wrap;margin:18px 0}.toolbar input{min-width:260px;flex:1}.toolbar input,.toolbar button{padding:10px 12px;border:1px solid var(--border);border-radius:8px;background:#fff}.toolbar button{background:var(--navy);color:#fff;font-weight:700;cursor:pointer}.tabs{display:flex;flex-wrap:wrap;gap:9px;margin:18px 0}.tab{background:#fff;border:1px solid var(--border);border-radius:999px;padding:9px 13px;color:#334155}.tab.selected{background:var(--navy);color:#fff;border-color:var(--navy)}.tab b{margin-left:7px}.notice{padding:12px 15px;background:#e7f7ed;color:#146c35;border-radius:9px;margin:14px 0}.application{background:var(--card);border:1px solid var(--border);border-radius:14px;padding:18px;margin:14px 0;box-shadow:0 2px 7px #0b2f7310}.application-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}.application-head p{margin:5px 0;color:var(--muted)}.status{border-radius:999px;padding:5px 9px;font-size:12px;font-weight:800;white-space:nowrap}.status.pending_review{background:#fff5cc;color:#805c00}.status.active{background:#dcfce7;color:#166534}.status.rejected{background:#fee2e2;color:#991b1b}.status.suspended{background:#e2e8f0;color:#475569}.grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin-top:17px}.grid>div{background:#f8fafc;border-radius:10px;padding:11px}.grid b{display:block;font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:var(--muted);margin-bottom:6px}.grid span{display:block;margin-top:3px;overflow-wrap:anywhere}.actions{display:flex;gap:10px;align-items:center;border-top:1px solid var(--border);margin-top:15px;padding-top:14px}.actions form{display:flex;gap:7px;flex:1}.actions input{min-width:0;flex:1;border:1px solid var(--border);border-radius:7px;padding:9px}.actions button{border:0;border-radius:7px;padding:9px 14px;font-weight:700;cursor:pointer}.approve{background:#15803d;color:#fff}.reject{background:#b91c1c;color:#fff}details{margin-top:14px;color:var(--muted)}details p{line-height:1.55}code{font-weight:800;color:#0756b8}@media(max-width:800px){body{padding:14px}.grid{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:520px){.grid{grid-template-columns:1fr}.application-head{display:block}.status{display:inline-block;margin-top:10px}.actions{display:block}.actions form+form{margin-top:8px}}</style></head><body><div class="wrap"><header><div><h1>Enterprise Partner Applications</h1><p class="sub">Review company identity, integration needs and access pricing before activating live API access.</p></div><a href="/admin">← Back to admin</a></header>${notice ? `<div class="notice">${escape(notice)}</div>` : ''}<form class="toolbar" method="get" action="/admin/partner-applications"><input type="hidden" name="status" value="${escape(selectedStatus)}"><input name="q" value="${escape(search)}" placeholder="Search business, email or RC/BN"><button type="submit">Search applications</button></form><nav class="tabs">${statusTabs}</nav>${rowsHtml || '<div class="application"><p>No applications found for this filter.</p></div>'}<p class="sub">Signed in as ${escape(admin.fullName)} (${escape(admin.role)}). Showing up to 100 applications.</p></div></body></html>`;
}
