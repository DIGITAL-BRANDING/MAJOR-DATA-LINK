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
import { env } from './config/env.js';
import { errorHandler } from './middleware/error.js';
import { adminApiRoutes } from './routes/admin-api.routes.js';
import { authRoutes } from './routes/auth.routes.js';
import { assistantRoutes } from './routes/assistant.routes.js';
import { passwordRoutes } from './routes/password.routes.js';
import { kycRoutes } from './routes/kyc.routes.js';
import { legalRoutes } from './routes/legal.routes.js';
import { notificationRoutes } from './routes/notification.routes.js';
import { referralRoutes } from './routes/referral.routes.js';
import { supportRoutes } from './routes/support.routes.js';
import { referralLinkRoutes } from './routes/referral-link.routes.js';
import { resultRoutes } from './routes/result.routes.js';
import { publicRoutes } from './routes/public.routes.js';
import { transactionRoutes } from './routes/transaction.routes.js';
import { userRoutes } from './routes/user.routes.js';
import { verificationRoutes } from './routes/verification.routes.js';
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
    res.json({ status: true, service: 'major-data-link-backend' });
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
            'script-src': ["'self'", "'unsafe-inline'", "'unsafe-eval'", 'https://embed.tawk.to'],
            'style-src': ["'self'", "'unsafe-inline'"],
            'img-src': ["'self'", 'data:', 'https:'],
            'font-src': ["'self'", 'data:'],
            'connect-src': ["'self'", 'https://*.tawk.to', 'wss://*.tawk.to'],
            'frame-src': ["'self'", 'https://*.tawk.to']
          }
        }
      })(req, res, next);
    }
    // The web app's build (web/vite.config.ts) uses @vitejs/plugin-legacy so
    // old browsers get a working fallback bundle instead of a permanent blank
    // page. That plugin injects 4 tiny inline <script> tags into index.html
    // (modern-browser detection, the Safari 10.1 nomodule fix, and the
    // SystemJS bootstrap for the legacy chunk) - see legacy-browser-support.patch.
    // Helmet's default CSP is `script-src 'self'` with NO 'unsafe-inline', so
    // without this, EVERY ONE of those 4 inline scripts is silently blocked by
    // the browser (console-only CSP violation, no visible error) and the app
    // never mounts to <div id="root"> - i.e. exactly the blank-page regression
    // this CSP entry fixes. We allow-list them by exact sha256 hash (the
    // secure alternative to 'unsafe-inline') rather than by content, so a
    // future plugin-legacy upgrade that changes the inline script text will
    // fail loud (CSP blocks it again) instead of silently trusting new inline
    // code. Regenerate via `require('@vitejs/plugin-legacy').cspHashes` in
    // web/ if @vitejs/plugin-legacy is ever upgraded and this breaks again.
    return helmet({
      contentSecurityPolicy: {
        directives: {
          ...helmet.contentSecurityPolicy.getDefaultDirectives(),
          'script-src': [
            "'self'",
            "'sha256-MS6/3FCg4WjP9gwgaBGwLpRCY6fZBgwmhVCdrPrNf3E='",
            "'sha256-tQjf8gvb2ROOMapIxFvFAYBeUJ0v1HCbOcSmDNXGtDo='",
            "'sha256-w36slEqa9euNKxfvkw+LLGsDIr++3rsZXpZxtmRh8Aw='",
            "'sha256-+5XkZFazzJo8n0iOP4ti/cLCMUudTf//Mzkb7xNPXIc='",
            'https://embed.tawk.to'
          ],
          'connect-src': ["'self'", 'https://*.tawk.to', 'wss://*.tawk.to'],
          'frame-src': ["'self'", 'https://*.tawk.to']
        }
      }
    })(req, res, next);
  });
  const allowedOrigins = new Set(
    env.WEB_ALLOWED_ORIGINS.split(',').map((origin) => origin.trim()).filter(Boolean)
  );
  // The browser dashboard is served by this same Express application. Its
  // Origin header must always be accepted even when no separate web domain
  // is configured, while callers from any other domain stay allow-listed.
  app.use((req, res, next) => {
    // The AdminJS panel is server-rendered and hosted on this same Express
    // origin. It does not make cross-origin API calls, so applying API CORS
    // validation here can only reject an otherwise valid admin login request
    // (as happened on Railway when its forwarded origin differed from Host).
    if (req.path.startsWith(ADMIN_ROOT_PATH)) return next();
    // Same idea, one level more forgiving: compare HOSTNAME only, not the
    // full "scheme://host" string. Railway terminates TLS at its edge and
    // forwards internally - `trust proxy` (above) makes req.protocol trust
    // X-Forwarded-Proto for exactly one hop, but on Railway that header has
    // been observed to occasionally disagree with what the browser actually
    // saw (this is the exact "forwarded origin differed from Host" quirk
    // noted for /admin above, just hitting the scheme instead of the host).
    // A same-site request landing here with `origin: https://` while
    // req.protocol briefly reports `http` is our own frontend, not a cross-
    // site attacker - and this API authenticates with a Bearer token, not a
    // cookie, so there's no CSRF-style exposure in being lenient about the
    // scheme specifically. The hostname still has to match exactly.
    const requestHost = req.get('host');
    return cors({
      origin(origin, callback) {
        if (!origin) return callback(null, true);
        if (allowedOrigins.has(origin)) return callback(null, true);
        if (requestHost) {
          try {
            if (new URL(origin).host === requestHost) return callback(null, true);
          } catch {
            // Malformed Origin header - fall through to reject below.
          }
        }
        return callback(new Error('Origin is not allowed by CORS policy'));
      }
    })(req, res, next);
  });

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

  app.use(rateLimit({
    windowMs: 60_000,
    limit: 120,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    skip: (req) => req.path.startsWith('/api/webhooks')
  }));

  // `skipSuccessfulRequests: true` - only requests that actually FAIL (wrong
  // password, expired token, validation errors, etc) count toward this
  // budget. A legitimate user's successful logins/registrations/refreshes in
  // the same 15-minute window (e.g. opening the app on two devices) no
  // longer eat into the same 30-request ceiling that's meant to catch
  // brute-forcing - only genuine failures do, which is what a brute-force
  // attempt actually looks like.
  const authLimiter = rateLimit({
    windowMs: 15 * 60_000,
    limit: 30,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    skipSuccessfulRequests: true
  });
  const userLimiter = rateLimit({ windowMs: 5 * 60_000, limit: 45, standardHeaders: 'draft-7', legacyHeaders: false });

  // Mounted with a raw body parser, and BEFORE express.json() below, because Paystack's
  // and KatPay's signatures are both computed over the exact raw bytes of the request
  // body. `type: '*/*'` (not the narrower 'application/json') is deliberate: if a
  // provider's webhook delivery omits Content-Type or sends something other than an
  // exact 'application/json' match, express.raw() would otherwise silently skip parsing
  // and leave req.body as `{}` - which the handlers below then coerce into the string
  // "[object Object]" via `(req.body as Buffer).toString()`, permanently failing HMAC
  // verification with zero error logged anywhere. Capturing raw bytes unconditionally
  // here removes that whole failure mode; each handler still does its own JSON.parse
  // and signature check exactly as before.
  app.use('/api/webhooks', express.raw({ type: '*/*' }), webhookRoutes);

  // CAC gets its own larger body-size limit, mounted before the global
  // express.json() below (whichever json() middleware runs first "claims"
  // the body - express-formidable-style middlewares check req._body and
  // skip re-parsing, so the global one downstream is a no-op for this
  // path). Up to 4 supporting documents at ~5.5MB base64 each (see
  // cac.routes.ts's MAX_DOCUMENT_BASE64_LENGTH) plus form fields comfortably
  // exceeds the 8mb every other route gets.
  app.use('/api/cac', express.json({ limit: '25mb' }), cacRoutes);

  // 1mb was too small for routes whose zod schemas accept up to a 7MB
  // base64 document/photo (nin-modification.routes.ts's
  // MAX_DOCUMENT_BASE64_LENGTH, and birth-attestation.routes.ts's image
  // field) - anything over 1MB was being rejected by this parser with a 413
  // before ever reaching that validation, silently defeating those larger
  // limits. Bumped to comfortably cover the largest documented field plus
  // JSON/other-fields overhead.
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
  app.use('/api/deliveries', deliveryRoutes);
  app.use('/api/referral', referralRoutes);
  app.use('/api/support', supportRoutes);
  app.use('/api/result', resultRoutes);
  app.use('/api/public', publicRoutes);
  app.use('/api/verification', verificationRoutes);
  app.use('/api/nin-modification', ninModificationRoutes);
  app.use('/api/bvn-crm', bvnCrmRoutes);
  app.use('/api/newspaper-publication', newspaperPublicationRoutes);
  app.use('/api/birth-attestation', birthAttestationRoutes);
  app.use('/api/bvn-modification', bvnModificationRoutes);
  app.use('/api/jamb', jambRoutes);
  // This MUST be mounted before the catch-all customer VTU router below.
  // `vtuRoutes` is mounted at /api and applies customer JWT auth to every
  // request it sees; mounting /api/v1 after it would make partner API-key
  // calls fail with "Missing auth token" before they reach partnerApiRoutes.
  // Same reasoning applies to /api/partner-portal - it needs its own path
  // segment ahead of the /api catch-all for the exact same reason.
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

