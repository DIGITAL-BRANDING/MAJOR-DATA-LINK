import type { Request, Router } from 'express';
import type { AdminSessionUser } from './auth.js';
import { findWalletDrift } from '../services/wallet-drift.service.js';

const esc = (v: unknown) =>
  String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const naira = (kobo: bigint) => {
  const negative = kobo < 0n;
  const abs = negative ? -kobo : kobo;
  const whole = (abs / 100n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${negative ? '-' : ''}\u20A6${whole}.${(abs % 100n).toString().padStart(2, '0')}`;
};
const csvCell = (v: unknown) => {
  let s = String(v ?? '');
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`; // stop spreadsheet formula injection from a user's name
  return `"${s.replace(/"/g, '""')}"`;
};

function financeOrSuper(req: Request): AdminSessionUser | null {
  const admin = req.session?.adminUser;
  return admin && (admin.role === 'SUPER_ADMIN' || admin.role === 'FINANCE') ? admin : null;
}

/**
 * Lists every wallet whose stored balance differs from its own ledger, with the
 * total money at risk, so affected users can be found and repaired in one
 * pass instead of discovering them one customer complaint at a time.
 */
export function registerWalletDriftRoutes(router: Router) {
  router.get('/wallet-drift', async (req, res) => {
    const admin = financeOrSuper(req);
    if (!admin) return res.redirect('/admin/login');
    try {
      const report = await findWalletDrift();

      if (req.query.format === 'csv') {
        const lines = [
          ['email', 'full_name', 'stored_naira', 'ledger_naira', 'difference_naira'].join(','),
          ...report.drifted.map((d) =>
            [d.email, d.fullName, Number(d.storedKobo) / 100, Number(d.ledgerKobo) / 100, Number(d.differenceKobo) / 100]
              .map(csvCell)
              .join(',')
          )
        ];
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename="wallet-drift.csv"');
        return res.send(lines.join('\n'));
      }

      const rows = report.drifted
        .map(
          (d) => `<tr>
<td>${esc(d.fullName)}<div class="sub">${esc(d.email)}</div></td>
<td class="num">${naira(d.storedKobo)}</td><td class="num">${naira(d.ledgerKobo)}</td>
<td class="num ${d.differenceKobo > 0n ? 'bad' : 'warn'}">${d.differenceKobo > 0n ? '+' : ''}${naira(d.differenceKobo)}</td>
<td><a href="/admin/user-wallet?q=${encodeURIComponent(d.email)}">Review</a></td></tr>`
        )
        .join('');

      res.type('html').send(`<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"><title>Wallets out of balance</title>
<style>
body{font:15px/1.5 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;background:#faf6e8;color:#2b2615;margin:0;padding:18px 14px}
.wrap{max-width:980px;margin:0 auto}h1{font-size:22px;margin:0 0 4px}.hint{color:#6b6444;margin:4px 0 14px}
.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:10px;margin:14px 0}
.card{background:#fff;border:1px solid #e7dfc4;border-radius:12px;padding:12px 14px}.card b{display:block;font-size:20px}
.card span{font-size:12px;color:#7b7457;text-transform:uppercase;letter-spacing:.04em}
.box{background:#fff;border:1px solid #e7dfc4;border-radius:12px;overflow-x:auto}
table{border-collapse:collapse;width:100%;min-width:560px}th,td{padding:10px 12px;border-bottom:1px solid #f0e9d2;text-align:left}
th{font-size:12px;color:#7b7457;text-transform:uppercase}.num{text-align:right;white-space:nowrap}.sub{font-size:12px;color:#7b7457}
.bad{color:#b3261e;font-weight:700}.warn{color:#8a5a00;font-weight:700}a{color:#7a6418;font-weight:600}
.ok{padding:18px;color:#2e6b2e;font-weight:600}.btn{display:inline-block;margin-top:6px}
</style></head><body><div class="wrap">
<h1>Wallets out of balance</h1>
<p class="hint">Each wallet's stored balance compared with what its own transaction history says it should hold. Scanned ${report.scannedUsers} wallets.
 <a class="btn" href="/admin/wallet-drift?format=csv">Download CSV</a> &middot; <a href="/admin">Admin home</a></p>
<div class="cards">
<div class="card"><span>Wallets affected</span><b>${report.drifted.length}</b></div>
<div class="card"><span>Money with no payment behind it</span><b class="bad">${naira(report.exposureKobo)}</b></div>
<div class="card"><span>Wallets holding too little</span><b>${naira(report.underpaidKobo)}</b></div></div>
<div class="box">${
        report.drifted.length === 0
          ? '<div class="ok">Every wallet matches its ledger.</div>'
          : `<table><thead><tr><th>User</th><th class="num">Stored</th><th class="num">Ledger</th><th class="num">Difference</th><th></th></tr></thead><tbody>${rows}</tbody></table>`
      }</div>
<p class="hint">Red (+) = the wallet holds more than was ever paid in: the company is exposed. Amber = the wallet holds less than it should. Open a user to reconcile from the ledger.</p>
</div></body></html>`);
    } catch (error) {
      console.error('[wallet-drift] report failed', error);
      res.status(500).type('html').send('<p style="font-family:system-ui;padding:20px">Could not build the report. Check the server logs.</p>');
    }
  });
}
