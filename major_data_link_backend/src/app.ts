// MUST be the first import in this file. It monkey-patches Express's Router
// so that a rejected promise inside an `async (req, res) => {...}` handler is
// automatically forwarded to `next(error)` -> errorHandler, instead of
// escaping as an unhandled promise rejection at the process level.
//
// Without this, Express 4.x does NOT catch errors thrown/rejected inside
// async route handlers. Combined with the `process.on('unhandledRejection', ...)`
// handler in server.ts (which calls `process.exit(1)`), a single bad request
// (invalid input, duplicate email, a transient DB error, etc.) was crashing
// the ENTIRE server process - taking down every other request too - which is
// why Railway showed "Application failed to respond" after a failed signup.
import 'express-async-errors';

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { env } from './config/env.js';
import { errorHandler } from './middleware/error.js';
import { createAdminCsrfGuard } from './middleware/admin-csrf.js';
import { adminApiRoutes } from './routes/admin-api.routes.js';
import { authRoutes } from './routes/auth.routes.js';
import { assistantRoutes } from './routes/assistant.routes.js';
import { passwordRoutes } from './routes/password.routes.js';
import { kycRoutes } from './routes/kyc.routes.js';
import { legalRoutes } from './routes/legal.routes.js';
import { notificationRoutes } from './routes/notification.routes.js';
import { webPushRoutes } from './routes/web-push.routes.js';
import { referralRoutes } from './routes/referral.routes.js';
import { supportRoutes } from './routes/support.routes.js';
import { referralLinkRoutes } from './routes/referral-link.routes.js';
import { resultRoutes } from './routes/result.routes.js';
import { publicRoutes } from './routes/public.routes.js';
import { transactionRoutes } from './routes/transaction.routes.js';
import { userRoutes } from './routes/user.routes.js';
import { verificationRoutes } from './routes/verification.routes.js';
import { schoolWebsiteRoutes } from './routes/school-website.routes.js';
import { ninModificationRoutes } from './routes/nin-modification.routes.js';
import { bvnCrmRoutes } from './routes/bvn-crm.routes.js';
import { newspaperPublicationRoutes } from './routes/newspaper-publication.routes.js';
import { birthAttestationRoutes } from './routes/birth-attestation.routes.js';
import { cacRoutes } from './routes/cac.routes.js';
import { bvnModificationRoutes } from './routes/bvn-modification.routes.js';
import { jambRoutes } from './routes/jamb.routes.js';
import { vtuRoutes } from './routes/vtu.routes.js';
import { cableRoutes } from './routes/cable.routes.js';
import { electricityRoutes } from './routes/electricity.routes.js';
import { walletRoutes } from './routes/wallet.routes.js';
import { webhookRoutes } from './routes/webhook.routes.js';
import { deliveryRoutes } from './routes/delivery.routes.js';
import { partnerApiRoutes } from './routes/partner-api.routes.js';
import { partnerPortalRoutes } from './routes/partner-portal.routes.js';

const ADMIN_ROOT_PATH = '/admin';

/**
 * Vite's legacy plugin emits inline feature-detection/bootstrap scripts whose
 * contents change with the build. Derive CSP hashes from the exact HTML that
 * is served so a frontend rebuild cannot silently block the app at startup.
 */
function getAppInlineScriptHashes(): string[] {
  try {
    const html = readFileSync(path.resolve(process.cwd(), 'public/app/index.html'), 'utf8');
    return [...html.matchAll(/<script\b(?![^>]*\bsrc\s*=)[^>]*>([\s\S]*?)<\/script\s*>/gi)]
      .filter((match) => !/\btype\s*=\s*["']application\/ld\+json["']/i.test(match[0]))
      .map((match) => `'sha256-${createHash('sha256').update(match[1]).digest('base64')}'`);
  } catch {
    // The backend can run without a built customer app in local development.
    return [];
  }
}

export function createApp() {
  const app = express();
  const appInlineScriptHashes = getAppInlineScriptHashes();

  // Trust Railway's single proxy hop so secure cookies and IP rate limits use
  // forwarded request metadata without trusting client-supplied proxy chains.
  app.set('trust proxy', 1);

  app.get('/health', (_req, res) => {
    res.json({ status: true, service: 'major-data-link-backend' });
  });

  // AdminJS requires inline scripts/styles; keep its policy scoped to /admin.
  // The customer app uses a strict CSP with hashes for Vite's legacy bootstrap.
  app.use((req, res, next) => {
    if (req.path.startsWith(ADMIN_ROOT_PATH)) {
      return helmet({
        contentSecurityPolicy: {
          directives: {
            ...helmet.contentSecurityPolicy.getDefaultDirectives(),
            'script-src': ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
            'style-src': ["'self'", "'unsafe-inline'"],
            'img-src': ["'self'", 'data:', 'https:'],
            'font-src': ["'self'", 'data:'],
            'connect-src': ["'self'"]
          }
        }
      })(req, res, next);
    }
    // Vite's legacy plugin injects bootstrap scripts and uses a data: module
    // URL for its import.meta.resolve capability check. Permit that probe and
    // hash the exact inline scripts from the built HTML.
    return helmet({
      contentSecurityPolicy: {
        directives: {
          ...helmet.contentSecurityPolicy.getDefaultDirectives(),
          'script-src': [
            "'self'",
            'data:',
            ...appInlineScriptHashes
          ],
          'connect-src': ["'self'"],
          // PDFs are fetched with the user's Authorization header and shown
          // from a short-lived blob URL; allow that same-origin app frame.
          'frame-src': ["'self'", 'blob:']
        }
      }
    })(req, res, next);
  });
  const allowedOrigins = new Set(
    env.WEB_ALLOWED_ORIGINS.split(',').map((origin) => origin.trim()).filter(Boolean)
  );
  app.use((req, res, next) => {
    // AdminJS is same-origin and does not use the customer API's CORS policy.
    if (req.path.startsWith(ADMIN_ROOT_PATH)) return next();
    // Permit the current host across proxy-induced scheme differences; all
    // other origins must match the explicit allow-list.
    const requestHost = req.get('host');
    return cors({
      credentials: true,
      origin(origin, callback) {
        if (!origin) return callback(null, true);
        if (allowedOrigins.has(origin)) return callback(null, true);
        if (requestHost) {
          try {
            if (new URL(origin).host === requestHost) return callback(null, true);
          } catch { /* Reject malformed origins below. */ }
        }
        return callback(new Error('Origin is not allowed by CORS policy'));
      }
    })(req, res, next);
  });

  // Public legal pages remain outside API rate limits but retain security headers.
  app.use(legalRoutes);
  app.use('/ref', referralLinkRoutes);

  // Resolve branding from the package working directory; tsc does not copy assets.
  app.use(
    '/branding',
    express.static(path.join(process.cwd(), 'public', 'branding'), { maxAge: '1d' })
  );

  app.use(rateLimit({
    windowMs: 60_000,
    limit: 120,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    skip: (req) => req.path.startsWith('/api/webhooks')
  }));

  // Count failed attempts only; successful sessions should not consume the
  // brute-force protection budget.
  const authLimiter = rateLimit({
    windowMs: 15 * 60_000,
    limit: 30,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    skipSuccessfulRequests: true
  });
  const userLimiter = rateLimit({ windowMs: 5 * 60_000, limit: 45, standardHeaders: 'draft-7', legacyHeaders: false });

  // Webhook signatures cover raw bytes, so parse these before express.json().
  app.use('/api/webhooks', express.raw({ type: '*/*' }), webhookRoutes);

  // CAC submissions can include multiple base64 documents and need a larger limit.
  app.use('/api/cac', express.json({ limit: '25mb' }), cacRoutes);

  // Support the largest validated base64 document/photo payloads.
  app.use(express.json({ limit: '8mb' }));

  app.use('/api/auth', authLimiter, authRoutes);
  app.use('/api/assistant', assistantRoutes);
  // Password reset is public and therefore receives the same strict anti-brute-force limit as login.
  app.use('/api/password', authLimiter, passwordRoutes);
  app.use('/api/admin', adminApiRoutes);
  app.use('/api/user', userLimiter, userRoutes);
  app.use('/api/wallet', walletRoutes);
  app.use('/api/kyc', kycRoutes);
  app.use('/api/notifications', notificationRoutes);
  app.use('/api/web-push', userLimiter, webPushRoutes);
  app.use('/api/deliveries', deliveryRoutes);
  app.use('/api/referral', referralRoutes);
  app.use('/api/support', supportRoutes);
  app.use('/api/result', resultRoutes);
  app.use('/api/public', publicRoutes);
  app.use('/api/verification', verificationRoutes);
  app.use('/api/school-website', schoolWebsiteRoutes);
  app.use('/api/nin-modification', ninModificationRoutes);
  app.use('/api/bvn-crm', bvnCrmRoutes);
  app.use('/api/newspaper-publication', newspaperPublicationRoutes);
  app.use('/api/birth-attestation', birthAttestationRoutes);
  app.use('/api/bvn-modification', bvnModificationRoutes);
  app.use('/api/jamb', jambRoutes);
  // Mount partner routers before the /api customer-auth catch-all.
  app.use('/api/v1', partnerApiRoutes);
  app.use('/api/partner-portal', authLimiter, partnerPortalRoutes);
  app.use('/api', vtuRoutes);
  app.use('/api/cable', cableRoutes);
  app.use('/api/electricity', electricityRoutes);
  app.use('/api/transactions', transactionRoutes);

  let adminRouterPromise: Promise<express.Router> | null = null;
  const getAdminRouter = () => {
    adminRouterPromise ??= import('./admin/setup.js').then(async ({ buildAdminRouter }) => {
      console.log('[admin] Building AdminJS router');
      const { router } = await buildAdminRouter();
      return router;
    });
    return adminRouterPromise;
  };
  // Build the AdminJS router during startup to avoid delaying its first request.
  void getAdminRouter();

  // Add per-IP protection alongside the per-account admin lockout.
  const adminLoginLimiter = rateLimit({
    windowMs: 15 * 60_000,
    limit: 20,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    skipSuccessfulRequests: true,
    skip: (req) => req.method !== 'POST'
  });
  app.use(`${ADMIN_ROOT_PATH}/login`, adminLoginLimiter);

  // CSRF: every state-changing /admin request must originate from this site.
  const allowedAdminHosts = env.WEB_ALLOWED_ORIGINS.split(',')
    .map((origin) => {
      try {
        return new URL(origin.trim()).host;
      } catch {
        return '';
      }
    })
    .filter(Boolean);
  app.use(ADMIN_ROOT_PATH, createAdminCsrfGuard(allowedAdminHosts));

  app.use(ADMIN_ROOT_PATH, async (req, res, next) => {
    try {
      const adminRouter = await getAdminRouter();
      return adminRouter(req, res, next);
    } catch (error) {
      console.error('[admin] Failed to build AdminJS router', error);
      adminRouterPromise = null;
      return next(error);
    }
  });

  // The web app (landing page + browser dashboard, built from ../web via
  // Vite - see railway.json/nixpacks.toml, which copy `web/dist` here at
  // build time). Mounted LAST, after every API/admin/legal route above, so
  // none of those can ever be shadowed by it.
  //
  // Two-step static serve:
  //  1. express.static first - serves real files (JS/CSS bundles, images)
  //     directly, with long-lived caching since Vite fingerprints filenames.
  //  2. For anything NOT a real file (e.g. /dashboard, /buy-airtime - React
  //     Router client-side routes that don't exist as files on disk), fall
  //     back to index.html so the React app boots and its own router takes
  //     over. Without this, refreshing the browser on /dashboard would 404
  //     instead of reloading the app.
  const webAppDir = path.join(process.cwd(), 'public', 'app');
  const webStatic = express.static(webAppDir, {
    maxAge: '1y',
    immutable: true,
    index: false,
    // Crawlers should receive sitemap and robots changes promptly; Vite's
    // fingerprinted asset caching is unsuitable for these two public files.
    setHeaders: (res, filePath) => {
      if (filePath.endsWith('robots.txt') || filePath.endsWith('sitemap.xml')) {
        res.setHeader('Cache-Control', 'public, max-age=3600');
      }
      // The push service worker is NOT fingerprinted (browsers require a
      // fixed /sw.js URL), so the 1-year immutable default above would pin
      // every browser to its first version forever. Always revalidate it.
      if (filePath.endsWith('sw.js')) {
        res.setHeader('Cache-Control', 'no-cache');
      }
    },
  });
  // Older deployments emitted /app/assets/... paths. Keep this alias so a browser
  // holding that HTML cache still receives JavaScript/CSS rather than index.html.
  app.use('/app', webStatic);
  app.use(webStatic);
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith(ADMIN_ROOT_PATH)) return next();
    // Do not serve the HTML shell for missing JS/CSS/image files. A stale
    // mobile browser cache would otherwise receive index.html as a stylesheet
    // or script, producing the completely unstyled page users reported.
    if (path.extname(req.path)) return next();
    // Never cache the HTML shell: a stale index can reference a bundle removed by a newer deploy.
    res.setHeader('Cache-Control', 'no-store');
    res.sendFile(path.join(webAppDir, 'index.html'), (err) => {
      if (err) next(err);
    });
  });

  app.use(errorHandler);
  return app;
}

