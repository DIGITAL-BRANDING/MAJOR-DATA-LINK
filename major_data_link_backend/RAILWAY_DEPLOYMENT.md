# Railway Deployment

If Railway fails with:

```text
P1001: Can't reach database server at db.<project>.supabase.co:5432
```

then `DATABASE_URL` is pointing to Supabase's direct database host. Use the
Supabase pooler host instead.

Set these Railway variables:

```text
NODE_ENV=production
DATABASE_URL=postgresql://postgres.<PROJECT_REF>:<PASSWORD>@aws-0-<REGION>.pooler.supabase.com:5432/postgres?sslmode=require
AUTH_TOKEN_SECRET=<random string with at least 32 characters>
ADMIN_SESSION_SECRET=<random string with at least 16 characters>
```

Do not set `DATABASE_URL` to:

```text
postgresql://postgres:<PASSWORD>@db.<PROJECT_REF>.supabase.co:5432/postgres
```

This project includes `railway.json`. Railway should build with:

```text
npm ci && npm run prisma:generate && npm run build
```

and start with:

```text
npm run start:prod
```

`start:prod` runs `prisma migrate deploy` and then starts `node dist/server.js`.
Railway serves the backend API, AdminJS, and frontend at `k-tech.com.ng`.
Cloudflare Pages serves the frontend at `www.k-tech.com.ng`; set
`WEB_ALLOWED_ORIGINS` to include both apex and `www` domains so its API and
Socket.IO requests are accepted.

## Dynamic wallet funding through KatPay

One-time, exact-amount Dynamic Account transfers for both users and partners
use `DYNAMIC_FUNDING_PROVIDER`, independently of the permanent virtual-account
provider in `PAYMENT_PROVIDER`. Dynamic funding defaults to KatPay. Set these
Railway variables for the KatPay transfer and callback flow:

```text
DYNAMIC_FUNDING_PROVIDER=katpay
KATPAY_SECRET_KEY=<KatPay secret key>
KATPAY_PUBLIC_KEY=<KatPay public key>
KATPAY_CALLBACK_URL=https://k-tech.com.ng/api/webhooks/katpay
```

The webhook signature uses `KATPAY_WEBHOOK_SECRET` when set, otherwise it uses
`KATPAY_SECRET_KEY`. The transfer flow does not require `KATPAY_MERCHANT_ID`;
that key is used when provisioning KatPay permanent virtual accounts. Card
wallet top-ups at `/api/wallet/fund` continue to use Paystack.
