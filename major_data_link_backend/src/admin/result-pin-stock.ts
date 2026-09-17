import type { Request, Router } from 'express';
import type { AdminSessionUser } from './auth.js';
import { logAdminAction } from './audit.js';
import { addResultPinStock, getResultPinStockSummary, type ExamPinType } from '../services/result-pin.service.js';

declare module 'express-session' { interface SessionData { adminUser?: AdminSessionUser; } }
type Fields = Record<string, string | string[] | undefined>;
function value(req: Request, name: string) { const v = ((req as unknown as { fields?: Fields }).fields ?? {})[name]; return typeof v === 'string' ? v.trim() : ''; }
function esc(value: string) { return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function admin(req: Request) { const user = req.session.adminUser; return user?.role === 'SUPER_ADMIN' || user?.role === 'FINANCE' ? user : null; }

function parseLines(text: string) {
  const entries: { pin: string; serial?: string }[] = [];
  const seen = new Set<string>();
  for (const line of text.split(/\r?\n/)) {
    const [pinRaw, serialRaw] = line.split(/[|,]/, 2).map((part) => part.trim());
    if (!pinRaw) continue;
    if (pinRaw.length > 300) throw new Error('A PIN is too long.');
    if (seen.has(pinRaw)) throw new Error('The same PIN appears more than once in this batch.');
    seen.add(pinRaw); entries.push({ pin: pinRaw, ...(serialRaw ? { serial: serialRaw } : {}) });
  }
  return entries;
}

export function registerResultPinStockRoutes(router: Router) {
  router.get('/result-pin-stock', async (req, res) => {
    const current = admin(req); if (!current) return res.redirect('/admin/login');
    const rows = await getResultPinStockSummary();
    const table = rows.length ? rows.map((row) => `<tr><td>${esc(row.examType)}</td><td>${esc(row.status)}</td><td>${row.count}</td><td>₦${row.totalCost.toLocaleString()}</td></tr>`).join('') : '<tr><td colspan="4">No PIN stock has been added yet.</td></tr>';
    const message = typeof req.query.message === 'string' ? `<p class="message">${esc(req.query.message)}</p>` : '';
    res.type('html').send(`<!doctype html><html><head><meta charset="utf-8"><title>Result PIN Stock</title><style>body{font:15px system-ui;margin:32px;background:#faf7ef;color:#1a1508}.wrap{max-width:850px;margin:auto}.card{background:white;border:1px solid #e9e1c8;border-radius:12px;padding:24px;margin:18px 0}textarea,input,select{width:100%;box-sizing:border-box;margin:6px 0 14px;padding:10px;border:1px solid #cfc5a5;border-radius:7px}textarea{min-height:210px;font-family:ui-monospace,monospace}button{background:#d4af37;border:0;padding:11px 18px;border-radius:7px;font-weight:700;cursor:pointer}table{width:100%;border-collapse:collapse}td,th{padding:10px;text-align:left;border-bottom:1px solid #eee}.message{padding:12px;background:#eaf7ee;color:#176b32;border-radius:7px}small{color:#6b6248}</style></head><body><main class="wrap"><p><a href="/admin">← Back to admin panel</a></p><h1>Result PIN Stock</h1>${message}<section class="card"><h2>Add PINs bought in advance</h2><p>Each line is one card: <code>PIN</code> or <code>PIN | SERIAL</code>. PIN values are encrypted before storage and are never shown again in this admin page.</p><form method="post" action="/admin/result-pin-stock"><label>Exam<select name="examType"><option>WAEC</option><option>NECO</option><option>NABTEB</option></select></label><label>Cost paid per PIN (₦)<input name="purchaseCost" type="number" min="0" step="0.01" required></label><label>Purchase reference (optional)<input name="sourceReference" maxlength="120" placeholder="Invoice or supplier reference"></label><label>PINs<textarea name="pins" required placeholder="1234-5678-9012 | SERIAL-001&#10;2345-6789-0123 | SERIAL-002"></textarea></label><button type="submit">Securely add stock</button></form></section><section class="card"><h2>Stock summary</h2><table><thead><tr><th>Exam</th><th>Status</th><th>Quantity</th><th>Purchase cost</th></tr></thead><tbody>${table}</tbody></table></section></main></body></html>`);
  });
  router.post('/result-pin-stock', async (req, res) => {
    const current = admin(req); if (!current) return res.redirect('/admin/login');
    try {
      const examType = value(req, 'examType').toUpperCase();
      if (!['WAEC', 'NECO', 'NABTEB'].includes(examType)) throw new Error('Choose a valid exam.');
      const purchaseCost = Number(value(req, 'purchaseCost'));
      if (!Number.isFinite(purchaseCost) || purchaseCost < 0) throw new Error('Enter a valid purchase cost.');
      const entries = parseLines(value(req, 'pins'));
      const result = await addResultPinStock({ examType: examType as ExamPinType, entries, purchaseCostNaira: purchaseCost, sourceReference: value(req, 'sourceReference') || undefined, adminId: current.id });
      await logAdminAction({ adminId: current.id, action: 'ADD_RESULT_PIN_STOCK', targetType: 'ResultPinInventory', metadata: { examType, count: result.added, purchaseCost } });
      res.redirect(`/admin/result-pin-stock?message=${encodeURIComponent(`${result.added} ${examType} PIN(s) added to stock.`)}`);
    } catch (error) { res.status(422).send(`<p>${esc(error instanceof Error ? error.message : 'Unable to add stock.')}</p><p><a href="/admin/result-pin-stock">Go back</a></p>`); }
  });
}
