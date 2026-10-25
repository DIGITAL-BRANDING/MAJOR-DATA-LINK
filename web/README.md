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

The production web app is served from Railway at `k-tech.com.ng` and from
Cloudflare Pages at `www.k-tech.com.ng`. Both builds use
`https://k-tech.com.ng` for API and Socket.IO requests by default; override
that with `VITE_API_BASE_URL` only if the backend domain changes. The Pages
Functions proxy only `/admin/*` to Railway, using the
`KTECH_BACKEND_ORIGIN` variable or its `https://k-tech.com.ng` default. Set
Railway's `WEB_ALLOWED_ORIGINS` to include both
`https://www.k-tech.com.ng` and `https://k-tech.com.ng` so browser API requests
and Socket.IO handshakes pass the backend origin checks. Railway builds and
serves its frontend alongside the backend; Cloudflare serves the frontend on
the `www` host.

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
