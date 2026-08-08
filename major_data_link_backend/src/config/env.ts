import 'dotenv/config';
import { z } from 'zod';

const EnvSchema = z.object({
  NODE_ENV: z.string().default('development'),
  PORT: z.coerce.number().default(8787),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  DIRECT_URL: z.string().optional(),
  FIREBASE_SERVICE_ACCOUNT_BASE64: z.string().optional(),
  ALRAHUZ_BASE_URL: z.string().url().default('https://alrahuzdata.com.ng/api'),
  ALRAHUZ_API_TOKEN: z.string().optional(),
  ALRAHUZ_DATA_PLANS_PATH: z.string().default('/data/'),
  ALRAHUZ_BALANCE_PATH: z.string().default('/user/'),
  ALRAHUZ_FUNDING_ACCOUNT_NUMBER: z.string().default('6651219714'),
  ALRAHUZ_FUNDING_ACCOUNT_NAME: z.string().default('ALRAHUZDATA - IMAM-DATASUB'),
  ALRAHUZ_FUNDING_BANK_NAME: z.string().default('Palmpay Automated Bank Transfer'),
  ALRAHUZ_EXAM_PIN_PATH: z.string().default('/exam/'),
  ALRAHUZ_WAEC_EXAM_ID: z.string().default('1'),
  ALRAHUZ_NECO_EXAM_ID: z.string().default('2'),
  ALRAHUZ_NABTEB_EXAM_ID: z.string().default('3'),
  RESULT_PIN_WAEC_DEFAULT_PRICE_NAIRA: z.coerce.number().positive().default(5150),
  RESULT_PIN_NECO_DEFAULT_PRICE_NAIRA: z.coerce.number().positive().default(2150),
  RESULT_PIN_NABTEB_DEFAULT_PRICE_NAIRA: z.coerce.number().positive().default(900),
  ALRAHUZ_DATA_PLANS_CACHE_SECONDS: z.coerce.number().int().positive().default(900),
  // Alert threshold for YOUR OWN balance at Alrahuz (not any customer's wallet).
  // Below this, customer purchases will start failing even though their in-app
  // wallets are fine Ã¢â‚¬â€ see provider.service.ts's recordProviderBalance.
  ALRAHUZ_LOW_BALANCE_THRESHOLD: z.coerce.number().positive().default(2000),
  ALRAHUZ_LOW_BALANCE_ALERT_COOLDOWN_MINUTES: z.coerce.number().int().positive().default(60),
  DATA_PLAN_MARKUP_PERCENT: z.coerce.number().min(0).default(0),
  DATA_PLAN_MARKUP_NAIRA: z.coerce.number().min(0).default(0),
  AUTH_TOKEN_SECRET: z.string().min(32).default('dev-only-insecure-auth-token-secret-32'),
  ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().positive().default(86_400),
  REFRESH_TOKEN_TTL_SECONDS: z.coerce.number().int().positive().default(2_592_000),
  // NOTE: z.coerce.boolean() would parse the STRING "false" as true (JS's
  // Boolean("false") === true Ã¢â‚¬â€ any non-empty string is truthy). This explicit
  // string comparison is what actually respects MOCK_PROVIDER=false in .env.
  MOCK_PROVIDER: z
    .string()
    .default('true')
    .transform((value) => value.toLowerCase() !== 'false' && value !== '0'),
  PAYSTACK_SECRET_KEY: z.string().optional(),
  PAYSTACK_CALLBACK_URL: z.string().url().optional(),
  // Bank slug Paystack uses when creating a Dedicated Virtual Account for a
  // newly-validated customer. 'wema-bank' and 'titan-paystack' are the two
  // providers Paystack supports for DVAs as of this writing - check the
  // Fetch Providers endpoint (GET /dedicated_account/available_providers)
  // if this ever needs to change.
  PAYSTACK_DVA_PREFERRED_BANK: z.string().default('wema-bank'),
  // Whether to create a Dedicated Virtual Account for every user immediately at
  // signup, with no BVN. Paystack only requires BVN/customer validation for
  // businesses under the Financial Services / Betting / General Services
  // categories - if this account isn't one of those, leave this on and users get
  // a funding account the moment they log in. If Paystack rejects the call
  // (unvalidated customer), it fails silently and users fall back to the
  // BVN-based Static Account flow in kyc.service.ts. Set to 'false' if you'd
  // rather every user go through BVN verification first.
  PAYSTACK_INSTANT_DVA_ENABLED: z
    .string()
    .default('true')
    .transform((value) => value.toLowerCase() !== 'false' && value !== '0'),
  ADMIN_SESSION_SECRET: z.string().min(16).default('dev-only-insecure-admin-secret-change-me'),
  SUPABASE_JWT_SECRET: z.string().optional()
});

// Parse environment variables with enhanced error handling
let env: z.infer<typeof EnvSchema>;

try {
  env = EnvSchema.parse(process.env);
} catch (error) {
  if (error instanceof z.ZodError) {
    console.error('Ã¢Å“â€” Environment variable validation failed:');
    error.errors.forEach((err) => {
      const path = err.path.join('.');
      console.error(`  - ${path}: ${err.message}`);
    });
    console.error('\nÃ¢Å“â€” Please check your .env file or environment variables');
    process.exit(1);
  }
  throw error;
}

// Production security checks
if (env.NODE_ENV === 'production') {
  const securityIssues: string[] = [];

  if (env.ADMIN_SESSION_SECRET === 'dev-only-insecure-admin-secret-change-me') {
    securityIssues.push('ADMIN_SESSION_SECRET is still the default dev value');
  }

  if (env.AUTH_TOKEN_SECRET === 'dev-only-insecure-auth-token-secret-32') {
    securityIssues.push('AUTH_TOKEN_SECRET is still the default dev value');
  }

  if (securityIssues.length > 0) {
    console.error('Ã¢Å“â€” Production security violations detected:');
    securityIssues.forEach((issue) => {
      console.error(`  - ${issue}`);
    });
    console.error('\nÃ¢Å“â€” Set strong random secrets before running in production');
    process.exit(1);
  }

  console.log('Ã¢Å“â€œ All production security checks passed');
}

export { env };

