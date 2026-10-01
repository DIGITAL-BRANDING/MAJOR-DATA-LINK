import { createHash, randomBytes } from 'node:crypto';
import express, { type NextFunction, type Request, type RequestHandler, type Response, Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { decryptPII, encryptPII } from '../lib/pii-encryption.js';
import { generateTotpSecret, otpauthUri, verifyTotp } from '../lib/totp.js';
import { logAdminAction } from './audit.js';
import {
  adminRequiresMfa,
  completeAdminSignIn,
  lockedError,
  noteAdminFailure,
  reserveAdminAttempt
} from './auth.js';

declare module 'express-session' {
  interface SessionData {
    /** Id of the admin who has completed the second factor in THIS session. */
    mfaVerifiedFor?: string;
    /** Encrypted secret being enrolled, kept server-side until confirmed. */
    mfaEnrollSecret?: string;
  }
}

const ISSUER = 'K-Tech Admin';
const RECOVERY_CODE_COUNT = 8;
const RECOVERY_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // no 0/O/1/I/L

/** Emergency switch: set ADMIN_MFA_ENFORCED=false on the server to bypass the gate. */
const enforced = () => process.env.ADMIN_MFA_ENFORCED !== 'false';

const esc = (v: unknown) =>
  String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

export const hashRecoveryCode = (code: string) =>
  createHash('sha256').update(code.replace(/[\s-]/g, '').toUpperCase()).digest('hex');

function newRecoveryCodes(): string[] {
  return Array.from({ length: RECOVERY_CODE_COUNT }, () => {
    const bytes = randomBytes(10);
    const chars = Array.from(bytes, (b) => RECOVERY_ALPHABET[b % RECOVERY_ALPHABET.length]).join('');
    return `${chars.slice(0, 5)}-${chars.slice(5)}`;
  });
}

function page(title: string, body: string) {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(title)} - K-Tech Admin</title>
<style>
*{box-sizing:border-box}html,body{margin:0;min-height:100%}
body{font:15px/1.5 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;background:#faf6e8;color:#2b2615;display:flex;justify-content:center;padding:max(16px,env(safe-area-inset-top)) 16px max(16px,env(safe-area-inset-bottom))}
.card{background:#fff;border:1px solid #e7dfc4;border-radius:14px;padding:22px;width:100%;max-width:440px;align-self:flex-start;margin-top:4vh}
h1{font-size:20px;margin:0 0 6px}p{margin:8px 0;color:#5b5438}
input[type=text]{width:100%;font-size:22px;letter-spacing:.25em;text-align:center;padding:12px;border:1px solid #cfc49a;border-radius:10px;margin:10px 0}
button,.btn{display:block;width:100%;text-align:center;text-decoration:none;font:inherit;font-weight:700;background:#c9a52c;color:#fff;border:0;border-radius:10px;padding:13px;cursor:pointer;min-height:44px}
.link{background:none;color:#7a6418;font-weight:600;border:0;padding:10px 0;width:auto;display:inline}
.err{background:#fdecea;color:#a1271b;border-radius:8px;padding:10px 12px;margin:10px 0}
.key{font:600 16px/1.6 ui-monospace,Menlo,Consolas,monospace;background:#faf6e8;border:1px dashed #cfc49a;border-radius:10px;padding:10px;word-break:break-all;text-align:center;user-select:all}
.codes{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:12px 0;font:600 15px ui-monospace,Menlo,Consolas,monospace}
.codes span{background:#faf6e8;border-radius:8px;padding:8px;text-align:center}
.small{font-size:13px;color:#7b7457}
</style></head><body><main class="card">${body}</main></body></html>`;
}

const errBox = (m?: string) => (m ? `<div class="err" role="alert">${esc(m)}</div>` : '');
const logoutLink = (root: string) => `<p class="small" style="text-align:center"><a class="link" href="${root}/logout">Sign out</a></p>`;

function challengePage(root: string, error?: string) {
  return page(
    'Two-factor verification',
    `<h1>Two-factor verification</h1>
<p>Enter the 6-digit code from your authenticator app.</p>${errBox(error)}
<form method="post" action="${root}/mfa/verify" autocomplete="off">
<input type="text" name="code" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="000000" autofocus required>
<button type="submit">Verify</button></form>
<details style="margin-top:14px"><summary class="small">Lost your phone? Use a recovery code</summary>
<form method="post" action="${root}/mfa/verify" autocomplete="off">
<input type="text" name="code" placeholder="XXXXX-XXXXX" style="font-size:17px;letter-spacing:.08em" required>
<button type="submit">Use recovery code</button></form></details>${logoutLink(root)}`
  );
}

function enrollPage(root: string, account: string, secret: string, error?: string) {
  const uri = otpauthUri({ issuer: ISSUER, account, secret });
  const grouped = secret.replace(/(.{4})/g, '$1 ').trim();
  return page(
    'Set up two-factor authentication',
    `<h1>Set up two-factor authentication</h1>
<p>Your role requires a second step at sign-in. Takes a minute:</p>
<ol style="padding-left:18px;margin:8px 0;color:#5b5438">
<li>Install Google Authenticator, Microsoft Authenticator or Authy.</li>
<li>Add an account: tap <b>Open in authenticator app</b> (on your phone) or type this key:</li></ol>
<div class="key">${esc(grouped)}</div>
<p style="margin-top:10px"><a class="btn" href="${esc(uri)}">Open in authenticator app</a></p>
<p>3. Enter the 6-digit code it shows to finish.</p>${errBox(error)}
<form method="post" action="${root}/mfa/enroll" autocomplete="off">
<input type="text" name="code" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="000000" required>
<button type="submit">Turn on and continue</button></form>${logoutLink(root)}`
  );
}

function recoveryPage(root: string, codes: string[]) {
  return page(
    'Save your recovery codes',
    `<h1>Two-factor is on</h1>
<p><b>Save these recovery codes now.</b> Each works once if you lose your phone. They are shown only this one time.</p>
<div class="codes">${codes.map((c) => `<span>${esc(c)}</span>`).join('')}</div>
<p class="small">Store them in a password manager or print them. Anyone with a code plus your password can sign in.</p>
<a class="btn" href="${root}">I have saved them, continue</a>`
  );
}

export function createMfaRouter(opts: { rootPath: string; sessionMiddleware: RequestHandler }): Router {
  const root = opts.rootPath;
  const router = Router();
  // Load the session FIRST. AdminJS later mounts the same express-session
  // middleware; express-session skips itself when req.session already exists,
  // so both read the one session, and the gate below runs before any
  // AdminJS route or custom admin page can answer.
  router.use(opts.sessionMiddleware);

  // ---- gate -----------------------------------------------------------
  router.use(async (req: Request, res: Response, next: NextFunction) => {
    try {
      const admin = req.session?.adminUser;
      if (!admin || !enforced()) return next();
      if (req.session.mfaVerifiedFor === admin.id) return next();
      // Pages that must stay reachable while the second factor is pending.
      if (req.path === '/login' || req.path === '/logout' || req.path.startsWith('/mfa')) return next();

      const row = await prisma.adminUser.findUnique({
        where: { id: admin.id },
        select: { role: true, isActive: true, totpEnabledAt: true }
      });
      if (!row || !row.isActive) {
        return req.session.destroy(() => res.redirect(`${root}/login`));
      }
      if (!adminRequiresMfa(row.role, row.totpEnabledAt)) {
        req.session.mfaVerifiedFor = admin.id; // e.g. SUPPORT who never turned 2FA on
        return req.session.save(() => next());
      }
      if (req.path.startsWith('/api') || req.xhr || req.accepts(['html', 'json']) === 'json') {
        return res.status(401).json({
          message: 'Two-factor verification required',
          code: 'MFA_REQUIRED',
          redirectUrl: `${root}/mfa`
        });
      }
      return res.redirect(`${root}/mfa`);
    } catch (err) {
      return next(err);
    }
  });

  const form = express.urlencoded({ extended: false, limit: '2kb' });
  const ipOf = (req: Request) => req.ip;

  async function currentRow(req: Request) {
    const admin = req.session?.adminUser;
    if (!admin) return null;
    return prisma.adminUser.findUnique({ where: { id: admin.id } });
  }

  // ---- GET /mfa -------------------------------------------------------
  router.get('/mfa', async (req, res, next) => {
    try {
      const row = await currentRow(req);
      if (!row) return res.redirect(`${root}/login`);
      if (req.session.mfaVerifiedFor === row.id || !enforced()) return res.redirect(root);
      if (row.totpEnabledAt && row.totpSecretEnc) return res.type('html').send(challengePage(root));
      if (!req.session.mfaEnrollSecret) {
        req.session.mfaEnrollSecret = encryptPII(generateTotpSecret());
        await new Promise<void>((resolve) => req.session.save(() => resolve()));
      }
      return res.type('html').send(enrollPage(root, row.email, decryptPII(req.session.mfaEnrollSecret)));
    } catch (err) {
      return next(err);
    }
  });

  // ---- POST /mfa/verify (already enrolled) -----------------------------
  router.post('/mfa/verify', form, async (req, res, next) => {
    try {
      const row = await currentRow(req);
      if (!row) return res.redirect(`${root}/login`);
      if (!row.totpEnabledAt || !row.totpSecretEnc) return res.redirect(`${root}/mfa`);

      const attempt = await reserveAdminAttempt(row.id, ipOf(req));
      if (attempt.locked) {
        const message = lockedError(attempt.until).message;
        return req.session.destroy(() => res.status(429).type('html').send(challengePage(root, message)));
      }

      const input = String(req.body?.code ?? '').trim();
      let ok = false;
      let usedRecovery = false;

      if (/^\d{3}\s?\d{3}$/.test(input)) {
        const step = verifyTotp(decryptPII(row.totpSecretEnc), input, { lastStep: row.totpLastStep });
        if (step !== null) {
          // Claim the step atomically so the same code cannot pass twice.
          const claim = await prisma.adminUser.updateMany({
            where: { id: row.id, OR: [{ totpLastStep: null }, { totpLastStep: { lt: step } }] },
            data: { totpLastStep: step }
          });
          ok = claim.count === 1;
        }
      } else if (input.replace(/[\s-]/g, '').length >= 8) {
        const claim = await prisma.adminRecoveryCode.updateMany({
          where: { adminId: row.id, codeHash: hashRecoveryCode(input), usedAt: null },
          data: { usedAt: new Date() }
        });
        ok = claim.count === 1;
        usedRecovery = ok;
      }

      if (!ok) {
        await noteAdminFailure(row.id, attempt.count, ipOf(req));
        return res.status(400).type('html').send(challengePage(root, 'That code is not valid. Try the newest code.'));
      }

      await completeAdminSignIn(row.id);
      req.session.mfaVerifiedFor = row.id;
      delete req.session.mfaEnrollSecret;
      if (usedRecovery) {
        await logAdminAction({
          adminId: row.id,
          action: 'ADMIN_2FA_RECOVERY_CODE_USED',
          targetType: 'AdminUser',
          targetId: row.id,
          metadata: { ip: ipOf(req) ?? null }
        }).catch(() => undefined);
      }
      return req.session.save(() => res.redirect(root));
    } catch (err) {
      return next(err);
    }
  });

  // ---- POST /mfa/enroll (first-time setup) -----------------------------
  router.post('/mfa/enroll', form, async (req, res, next) => {
    try {
      const row = await currentRow(req);
      if (!row) return res.redirect(`${root}/login`);
      if (row.totpEnabledAt && row.totpSecretEnc) return res.redirect(`${root}/mfa`);
      if (!req.session.mfaEnrollSecret) return res.redirect(`${root}/mfa`);
      const secret = decryptPII(req.session.mfaEnrollSecret);

      const attempt = await reserveAdminAttempt(row.id, ipOf(req));
      if (attempt.locked) {
        const message = lockedError(attempt.until).message;
        return req.session.destroy(() => res.status(429).type('html').send(enrollPage(root, row.email, secret, message)));
      }

      const step = verifyTotp(secret, String(req.body?.code ?? ''));
      if (step === null) {
        await noteAdminFailure(row.id, attempt.count, ipOf(req));
        return res
          .status(400)
          .type('html')
          .send(enrollPage(root, row.email, secret, 'That code did not match. Check the key and your phone clock, then try again.'));
      }

      // Only the first successful enrolment wins (guards a double submit).
      const claim = await prisma.adminUser.updateMany({
        where: { id: row.id, totpSecretEnc: null },
        data: { totpSecretEnc: encryptPII(secret), totpEnabledAt: new Date(), totpLastStep: step }
      });
      if (claim.count !== 1) return res.redirect(`${root}/mfa`);

      const codes = newRecoveryCodes();
      await prisma.adminRecoveryCode.deleteMany({ where: { adminId: row.id } });
      await prisma.adminRecoveryCode.createMany({
        data: codes.map((c) => ({ adminId: row.id, codeHash: hashRecoveryCode(c) }))
      });
      await completeAdminSignIn(row.id);
      await logAdminAction({
        adminId: row.id,
        action: 'ADMIN_2FA_ENABLED',
        targetType: 'AdminUser',
        targetId: row.id,
        metadata: { ip: ipOf(req) ?? null }
      }).catch(() => undefined);

      req.session.mfaVerifiedFor = row.id;
      delete req.session.mfaEnrollSecret;
      return req.session.save(() => res.type('html').send(recoveryPage(root, codes)));
    } catch (err) {
      return next(err);
    }
  });

  return router;
}
