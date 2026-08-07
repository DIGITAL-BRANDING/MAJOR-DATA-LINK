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

import path from 'node:path';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { errorHandler } from './middleware/error.js';
import { adminApiRoutes } from './routes/admin-api.routes.js';
import { authRoutes } from './routes/auth.routes.js';
import { kycRoutes } from './routes/kyc.routes.js';
import { legalRoutes } from './routes/legal.routes.js';
import { notificationRoutes } from './routes/notification.routes.js';
import { referralRoutes } from './routes/referral.routes.js';
import { supportRoutes } from './routes/support.routes.js';
import { referralLinkRoutes } from './routes/referral-link.routes.js';
import { resultRoutes } from './routes/result.routes.js';
import { transactionRoutes } from './routes/transaction.routes.js';
import { userRoutes } from './routes/user.routes.js';
import { vtuRoutes } from './routes/vtu.routes.js';
import { walletRoutes } from './routes/wallet.routes.js';
import { webhookRoutes } from './routes/webhook.routes.js';

const ADMIN_ROOT_PATH = '/admin';

export function createApp() {
  const app = express();

  // Railway terminates TLS at its edge and forwards requests over plain HTTP
  // with X-Forwarded-* headers set. Without this, Express treats every request
  // as insecure (req.secure === false) since it only looks at the raw socket -
  // that breaks two things: express-rate-limit refuses to trust X-Forwarded-For
  // for per-IP limiting (the ValidationError seen in deploy logs), and more
  // importantly, express-session's admin cookie (which defaults to secure:
  // 'auto', i.e. "secure only if req.secure") never gets marked secure, so
  // browsers over HTTPS silently drop it - login succeeds server-side but the
  // very next request has no session, bouncing straight back to /admin/login.
  // `1` = trust exactly one hop (Railway's own proxy), not an open trust of
  // arbitrary forwarded headers from the internet.
  app.set('trust proxy', 1);

  app.get('/health', (_req, res) => {
    res.json({ status: true, service: 'imam-datasub-backend' });
  });

  // Helmet's default Content-Security-Policy blocks inline <script>/<style> tags
  // (script-src 'self' etc). That's the right default for our JSON API, but
  // AdminJS's frontend bundle boots itself via inline scripts/styles - under the
  // strict default CSP the browser silently refuses to execute that bundle,
  // producing a blank page at /admin/login with no visible error (only a CSP
  // violation in the browser console). So: strict CSP everywhere except /admin,
  // and a relaxed-but-still-scoped CSP for /admin that AdminJS actually needs.
  app.use((req, res, next) => {
    if (req.path.startsWith(ADMIN_ROOT_PATH)) {
      return helmet({
        contentSecurityPolicy: {
          directives: {
            ...helmet.contentSecurityPolicy.getDefaultDirectives(),
            'script-src': ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
            'style-src': ["'self'", "'unsafe-inline'"],
            'img-src': ["'self'", 'data:', 'https:'],
            'font-src': ["'self'", 'data:']
          }
        }
      })(req, res, next);
    }
    return helmet()(req, res, next);
  });
  app.use(cors());

  // Public web pages (no auth, no rate limit) - these are what Play Store's
  // Data Safety / Privacy Policy fields, and the in-app "Read more" links,
  // point at. Mounted after helmet/cors (so they still get proper security
  // headers) but before the rate limiter below, so a burst of App/Play Store
  // reviewers or crawlers hitting these plain HTML pages can never get 429'd.
  app.use(legalRoutes);
  app.use('/ref', referralLinkRoutes);

  // Static branding assets (logo/favicon) used by the AdminJS dashboard.
  // Served from `public/branding` at the process's working directory
  // (Railway/npm run this from the backend package root, both in `tsx`
  // dev mode and against the compiled `dist/` build) rather than resolved
  // relative to this file, since tsc doesn't copy non-.ts assets into
  // `dist/` alongside the compiled JS. Unauthenticated and cheap to serve,
  // so - like the legal pages above - it's mounted before the rate limiter.
  app.use(
    '/branding',
    express.static(path.join(process.cwd(), 'public', 'branding'), { maxAge: '1d' })
  );

  app.use(rateLimit({ windowMs: 60_000, limit: 120 }));

  // Mounted with a raw body parser, and BEFORE express.json() below, because Paystack's
  // signature is computed over the exact raw bytes of the request body.
  app.use('/api/webhooks', express.raw({ type: 'application/json' }), webhookRoutes);

  app.use(express.json({ limit: '1mb' }));

  app.use('/api/auth', authRoutes);
  app.use('/api/admin', adminApiRoutes);
  app.use('/api/user', userRoutes);
  app.use('/api/wallet', walletRoutes);
  app.use('/api/kyc', kycRoutes);
  app.use('/api/notifications', notificationRoutes);
  app.use('/api/referral', referralRoutes);
  app.use('/api/support', supportRoutes);
  app.use('/api/result', resultRoutes);
  app.use('/api', vtuRoutes);
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
  // Kick this off now, at server startup, instead of waiting for the first
  // person to visit /admin. admin.initialize() (the actual bundle build) can
  // take a few seconds - starting it here gives it a head start so a real
  // visitor is far less likely to land in the middle of it. Every request
  // still awaits the same promise below, so correctness doesn't depend on
  // this head start - it's purely to reduce how often anyone notices the wait.
  void getAdminRouter();

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

  app.use(errorHandler);
  return app;
}

