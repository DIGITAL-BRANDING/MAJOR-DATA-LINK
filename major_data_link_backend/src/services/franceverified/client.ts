import { env } from '../../config/env.js';

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
    return { ok: false, message: 'FranceVerified API key is not configured', raw: null };
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
      signal: AbortSignal.timeout(30_000)
    });
  } catch (error) {
    console.error(`[franceverified] network error calling ${path}:`, error);
    return { ok: false, message: 'Could not reach the verification provider - please try again shortly', raw: null };
  }

  const raw: unknown = await response.json().catch(() => ({}));
  const envelope = asRecord(raw) ?? {};
  const status = typeof envelope.status === 'string' ? envelope.status.toLowerCase() : envelope.status;
  const successful = response.ok && (envelope.success === true || envelope.ok === true || status === 'success' || status === 'successful' || status === 'pending' || (!('success' in envelope) && !('ok' in envelope) && !('status' in envelope)));
  const data = asRecord(envelope.data) ?? asRecord(envelope.response) ?? (successful ? envelope : undefined);

  if (!successful || !data) {
    return { ok: false, message: typeof envelope.message === 'string' ? envelope.message : `Verification provider returned HTTP ${response.status}`, raw };
  }

  return { ok: true, message: typeof envelope.message === 'string' ? envelope.message : 'Verification completed successfully', data, raw };
}
