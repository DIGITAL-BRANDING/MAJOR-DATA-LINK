# Hostless deployment with Supabase

The backend and web dashboard deploy together as one Hostless app. Supabase remains the production PostgreSQL database; do not create or migrate to a Hostless database for this cutover.

## Hostless app settings

1. Connect the GitHub repository and choose the branch containing `hostless.yaml`.
2. Use the repository root as the configuration-file location. The file sets the backend working directory and uses the repository root as the build context so it can build the sibling `web` app.
3. Keep the app at one replica. The backend runs in-process webhook and reconciliation workers, so multiple replicas could process the same work more than once.
4. The free-tier resource ceiling is intentionally set to 0.1 vCPU and 256 MB RAM. Watch memory and CPU metrics after first boot; if the service exceeds the free allowance, do not enable paid overage without approval.
5. No Hostless database is needed. The backend connects to the existing Supabase project.

## Environment variables

Copy the production values from the current backend host into Hostless secrets. Never commit them to Git or paste them into chat. At minimum, verify these values before the first deploy:

- `NODE_ENV=production`
- `DATABASE_URL`: Supabase transaction-pooler URL, normally port `6543`, with `pgbouncer=true`.
- `DIRECT_URL`: Supabase direct/session connection used for Prisma migrations; use the correct URL from Supabase's Connect settings.
- `AUTH_TOKEN_SECRET`, `ADMIN_SESSION_SECRET`, and `PII_ENCRYPTION_KEY`: preserve the existing production values so user tokens, admin sessions, and encrypted PII remain readable.
- All existing production provider, payment, Firebase, push, email, and webhook credentials required by enabled features.
- `MOCK_PROVIDER=false` and `MOCK_TECHHUB=false` only if the live upstream credentials are configured and verified.
- `WEB_ALLOWED_ORIGINS`: include the customer/partner web origin and the Hostless origin during testing. Keep the existing production domain in the list.
- `PUBLIC_WEB_URL` and payment callback/webhook URLs: retain the canonical domain if it will point to Hostless; otherwise update each provider callback only after the Hostless URL is known.

Do not set a fixed `PORT`; Hostless supplies it. The backend already binds to `0.0.0.0` and exposes `/health`.

## Safe release sequence

1. Deploy first on the Hostless-generated URL and leave the current DNS untouched.
2. Check deployment logs, `GET /health`, login, partner-specific pricing, dashboard/API calls, and the chat Socket.IO connection. Hostless's public docs describe long-running apps but do not explicitly document Socket.IO/WebSocket proxy support, so verify chat before cutover.
3. The start command runs `prisma migrate deploy` against Supabase before starting the API. Confirm a recent Supabase backup and review pending migrations before the first production deployment.
4. This backend serves the built web dashboard from the same origin. Existing mobile builds use `https://k-tech.com.ng/api` as their bootstrap URL, so keep that hostname working by attaching it to Hostless and changing DNS only after the generated URL passes checks. If Hostless does not allow the custom domain on this account, existing installed mobile apps will need a compatible bootstrap/API migration before they can use the new hostname.
5. After smoke tests pass, update DNS/custom-domain routing, verify HTTPS and webhooks, and monitor logs, resource usage, Supabase connections, and failed transactions.
6. Keep the prior service and DNS/credentials available as rollback until Hostless has served successfully for an agreed observation period.
