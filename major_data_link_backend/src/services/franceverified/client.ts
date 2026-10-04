import { env } from '../../config/env.js';
import { publicVerificationMessage } from '../../lib/public-verification-message.js';

// Return a clear provider error instead of leaving customers on a loading
// state when an upstream request stalls.
const PROVIDER_TIMEOUT_MS = 20_000;

export type FranceVerifiedResult = {
  ok: boolean;
  message: string;
  data?: Record<string, unknown>;
  raw: unknown;
};

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

/** Shared transport for FranceVerified's JSON verification endpoints. */
export async function franceVerifiedPost(path: string, body: Record<string, unknown>): Promise<FranceVerifiedResult> {
  return franceVerifiedRequest(path, { method: 'POST', body: JSON.stringify(body) });
}

/** GET counterpart - needed for polling/status/balance endpoints (e.g.
 *  /nin/check, /jamb/status, /user/balance) that take no request body. */
export async function franceVerifiedGet(path: string, query?: Record<string, string | undefined>): Promise<FranceVerifiedResult> {
  const url = new URL(`${env.FRANCEVERIFIED_BASE_URL.replace(/\/$/, '')}${path}`);
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined) url.searchParams.set(key, value);
  }
  return franceVerifiedRequest(url.pathname + url.search, { method: 'GET' });
}

async function franceVerifiedRequest(path: string, init: { method: 'GET' | 'POST'; body?: string }): Promise<FranceVerifiedResult> {
  if (!env.FRANCEVERIFIED_API_KEY) {
    return { ok: false, message: 'Verification service is temporarily unavailable. Please try again later.', raw: null };
  }

  let response: Response;
  try {
    response = await fetch(`${env.FRANCEVERIFIED_BASE_URL.replace(/\/$/, '')}${path}`, {
      method: init.method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.FRANCEVERIFIED_API_KEY}`,
        'x-api-key': env.FRANCEVERIFIED_API_KEY
      },
      body: init.body,
      signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS)
    });
  } catch (error) {
    console.error(`[franceverified] network error calling ${path}:`, error);
    return { ok: false, message: 'Could not reach the verification provider - please try again shortly', raw: null };
  }

  const raw: unknown = await response.json().catch(() => ({}));
  const envelope = asRecord(raw) ?? {};
  const status = typeof envelope.status === 'string' ? envelope.status.toLowerCase() : envelope.status;
  // FranceVerified normally documents `status: "success"`, but some
  // responses use a boolean `status: true` alongside the same `data` object.
  // HTTP 200 alone is not enough to accept a lookup: explicit false/error
  // envelopes must still fail and be refunded by purchaseSlip().
  const successful = response.ok && (envelope.success === true || envelope.ok === true || status === true || status === 'success' || status === 'successful' || status === 'pending' || (!('success' in envelope) && !('ok' in envelope) && !('status' in envelope)));
  const data = asRecord(envelope.data) ?? asRecord(envelope.response) ?? (successful ? envelope : undefined);

  console.info('[franceverified] response', JSON.stringify({ endpoint: path, http_status: response.status, outcome: successful && Boolean(data) ? 'success' : 'failed' }));

  if (!successful || !data) {
    return { ok: false, message: publicVerificationMessage(envelope.message, 'Your request could not be completed. Please check the details and try again.'), raw };
  }

  return { ok: true, message: publicVerificationMessage(envelope.message, 'Verification completed successfully'), data, raw };
}
