# MAJOR DATA-LINK — Web

Landing page + browser dashboard (login, wallet, buy airtime/data), built with
React + Vite + TypeScript + Tailwind CSS v4. Talks to the same backend API as
the Flutter app (`../major_data_link_backend`).

## Local development

```bash
npm install
npm run dev
```

By default, requests to `/api/*` are proxied to `http://localhost:8787`
(the backend's default port - see `major_data_link_backend/src/config/env.ts`).
If your backend runs elsewhere, set `VITE_API_PROXY_TARGET` before starting:

```bash
VITE_API_PROXY_TARGET=http://localhost:5000 npm run dev
```

## Production

The production web app is deployed to Cloudflare Pages. Keep
`VITE_API_BASE_URL` unset so API and Socket.IO requests use the same origin;
the Pages Functions in `functions/` proxy `/api/*`, `/socket.io/*`, and
`/admin/*` to the Railway backend. The backend origin defaults to
`https://k-tech.up.railway.app`; set the Cloudflare Pages variable
`KTECH_BACKEND_ORIGIN` to another HTTPS origin if Railway's public domain
changes. Set Railway's `WEB_ALLOWED_ORIGINS` to include both
`https://www.k-tech.com.ng` and `https://k-tech.com.ng` so browser API requests
and Socket.IO handshakes pass the backend origin checks. Legal pages are also
proxied to Railway. Railway builds only the backend; Cloudflare builds and
serves the customer-facing frontend.

## What's here (current scope)

- `/` - marketing landing page
- `/login`, `/register` - auth (same accounts as the mobile app)
- `/dashboard` - wallet balance, virtual account number, recent transactions
- `/buy-airtime`, `/buy-data` - the two most common top-up flows
- `/privacy-policy`, `/terms` - redirect to the backend-hosted legal pages
  (single source of truth, shared with the in-app legal screen)

Not yet built here (still mobile-only for now): cable TV, electricity,
verification services (NIN/BVN), result checkers, referrals, KYC. Same
pattern as the pages above - add a route + page under `src/pages`, call the
matching `/api/...` endpoint.
