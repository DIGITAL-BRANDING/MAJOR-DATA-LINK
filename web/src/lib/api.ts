// Thin fetch wrapper for the MAJOR DATA-LINK backend API.
// In dev, requests to /api/* are proxied to VITE_API_PROXY_TARGET (see vite.config.ts) -
// VITE_API_BASE_URL is also respected in dev, for pointing a local frontend at a
// non-default backend.
// In production this is always '' (same-origin relative paths) - this app's build/deploy
// process (see nixpacks.toml) always copies web/dist straight into the backend's own
// public/app, so production is never served from a different origin than its own API.
// A VITE_API_BASE_URL baked into a production build is therefore always a stale value
// left over from before a domain change, never a legitimate separate deployment - and a
// stale one silently sends every API call cross-origin, where CORS/CSP reject it and the
// user just sees "Could not connect to the server" with no clue why. Ignoring it
// unconditionally in production removes that whole failure mode, rather than trying to
// detect and correct a stale value at runtime.
// Exported so src/components/ChatWidget.tsx can point its Socket.IO
// connection at the same backend origin as every REST call here, instead
// of duplicating this env lookup.
export const API_BASE = import.meta.env.PROD ? '' : (import.meta.env.VITE_API_BASE_URL ?? '');
export const PARTNER_API_BASE = `${API_BASE}/api/v1`;

const TOKEN_KEY = 'mdl_access_token';
const REFRESH_KEY = 'mdl_refresh_token';
const REMEMBER_KEY = 'mdl_remember_me';
const REQUEST_TIMEOUT_MS = 25_000;
let accessToken: string | null = null;
let refreshInFlight: Promise<boolean> | null = null;

// AbortSignal.timeout() is missing in older Android browsers/WebViews. Calling
// it directly throws before fetch even starts, which the UI then misreports
// as a network outage. AbortController is supported by substantially older
// browsers, so use a timer-backed signal instead.
async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timer = globalThis.setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } catch (error) {
    if (controller.signal.aborted) {
      const timeoutError = new Error('The request timed out.');
      timeoutError.name = 'TimeoutError';
      throw timeoutError;
    }
    throw error;
  } finally {
    globalThis.clearTimeout(timer);
  }
}

function isTimeoutError(error: unknown): boolean {
  return error instanceof Error && error.name === 'TimeoutError';
}

export function getAccessToken() {
  return accessToken;
}

function clearLegacyStoredTokens() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_KEY);
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(REFRESH_KEY);
}

/** Access tokens remain in memory; only the non-secret preference is persisted. */
export function setTokens(token: string, _refreshToken?: string, remember = true) {
  accessToken = token;
  // Clear legacy browser-stored credentials once a fresh server session is
  // established. Only a non-secret remember preference remains in storage.
  clearLegacyStoredTokens();
  localStorage.removeItem(REMEMBER_KEY);
  sessionStorage.removeItem(REMEMBER_KEY);
  (remember ? localStorage : sessionStorage).setItem(REMEMBER_KEY, remember ? 'true' : 'false');
}

export function clearTokens() {
  accessToken = null;
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_KEY);
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(REFRESH_KEY);
  localStorage.removeItem(REMEMBER_KEY);
  sessionStorage.removeItem(REMEMBER_KEY);
}

function rememberPreference() {
  return (localStorage.getItem(REMEMBER_KEY) ?? sessionStorage.getItem(REMEMBER_KEY)) !== 'false';
}

async function refreshWebAccessToken(): Promise<boolean> {
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = (async () => {
    try {
      const response = await fetchWithTimeout(`${API_BASE}/api/auth/token/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Client-Channel': 'web',
          'X-Remember-Me': String(rememberPreference()),
        },
        credentials: 'include',
        body: '{}',
      }, REQUEST_TIMEOUT_MS);
      const payload = await response.json() as { data?: { access_token?: string } };
      if (!response.ok || !payload.data?.access_token) return false;
      accessToken = payload.data.access_token;
      return true;
    } catch {
      return false;
    }
  })().finally(() => { refreshInFlight = null; });
  return refreshInFlight;
}

export async function restoreWebSession() {
  if (await refreshWebAccessToken()) {
    clearLegacyStoredTokens();
    return true;
  }
  clearTokens();
  return false;
}

export class ApiError extends Error {
  status: number;
  code?: string;
  constructor(message: string, status: number, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

async function request<T>(
  path: string,
  options: {
    method?: string;
    body?: unknown;
    auth?: boolean;
    retryOnNetworkError?: boolean;
    // Slip-purchase calls (Techhub/FranceVerified) route through a slow
    // third-party lookup - up to 20s of provider time alone (see
    // TECHHUB_REQUEST_TIMEOUT_MS / PROVIDER_TIMEOUT_MS server-side) - and
    // the flat 25s default here left almost no margin for the surrounding
    // wallet debit/PDF/DB work, so a perfectly successful backend response
    // could still race past this timeout and surface as "taking too long"
    // even though the money had already moved. Callers on that path pass a
    // longer value.
    timeoutMs?: number;
    // Set on money-moving POSTs so a client-side timeout followed by a
    // user-initiated retry replays the *same* transaction server-side
    // (purchaseSlip's debit.reused branch) instead of creating and charging
    // for a second one. Left undefined elsewhere - unrelated GETs and
    // idempotent-by-nature calls don't need it.
    idempotencyKey?: string;
  } = {}
): Promise<T> {
  const { method = 'GET', body, auth = true, retryOnNetworkError = false, timeoutMs = REQUEST_TIMEOUT_MS } = options;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    // Reporting metadata only; the backend never trusts this to authorize a request.
    'X-Client-Channel': 'web',
    'X-Remember-Me': String(rememberPreference()),
  };
  if (options.idempotencyKey) headers['Idempotency-Key'] = options.idempotencyKey;
  if (auth) {
    const token = getAccessToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  const doFetch = () =>
    fetchWithTimeout(`${API_BASE}/api${path}`, {
      method,
      headers: {
        ...headers,
        ...(auth && accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      credentials: 'include',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }, timeoutMs);

  // Every GET is naturally safe to retry. A mutating (non-GET) request is
  // only retried when the caller explicitly says so via
  // retryOnNetworkError=true - e.g. login (see auth.tsx), which has no side
  // effect worth worrying about if the first attempt actually reached the
  // server and only the RESPONSE got lost (it just issues another valid
  // token). Left off (the default) for money-moving POSTs elsewhere in the
  // app, where that same scenario could mean silently double-submitting a
  // purchase - those already guard against exactly this with their own
  // Idempotency-Key headers rather than a blind client retry.
  const canRetry = method === 'GET' || retryOnNetworkError;

  let res: Response;
  try {
    try {
      res = await doFetch();
    } catch (firstError) {
      const isTimeout = isTimeoutError(firstError);
      if (isTimeout || !canRetry) throw firstError;
      // Patchy Nigerian mobile data very often fails once and succeeds a
      // moment later when the signal comes back - one retry after a short
      // pause meaningfully cuts down on "could not connect" errors without
      // masking a genuinely dead connection (it still fails after this).
      await new Promise((resolve) => setTimeout(resolve, 800));
      res = await doFetch();
    }
  } catch (error) {
    if (isTimeoutError(error)) {
      throw new ApiError('The request is taking too long. Please try again.', 408, 'REQUEST_TIMEOUT');
    }
    // navigator.onLine is only reliable for "definitely offline" (false),
    // never for "definitely online" (true can still mean no real route to
    // the server) - so it only ever sharpens the message, never replaces
    // the check above.
    const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
    throw new ApiError(
      offline
        ? "You're offline. Please check your internet connection and try again."
        : 'Could not connect to the server. Please check your connection and try again.',
      0,
      'NETWORK_ERROR'
    );
  }

  if (auth && res.status === 401 && path !== '/auth/token/refresh' && await refreshWebAccessToken()) {
    res = await doFetch();
  }

  let payload: unknown = null;
  try {
    payload = await res.json();
  } catch {
    // non-JSON response body — leave payload null
  }

  if (res.ok && canRetry && (payload === null || typeof payload !== 'object')) {
    await new Promise((resolve) => setTimeout(resolve, 800));
    try {
      const retryRes = await doFetch();
      let retryPayload: unknown = null;
      try {
        retryPayload = await retryRes.json();
      } catch {
        // still non-JSON — fall through with the original res/payload below
      }
      if (retryRes.ok && retryPayload !== null && typeof retryPayload === 'object') {
        res = retryRes;
        payload = retryPayload;
      }
    } catch {
      // Retry attempt itself failed to even connect - keep the original
      // (invalid-body) res/payload so the checks below report that,
      // rather than masking it with a network error from the retry.
    }
  }

  if (!res.ok) {
    const message =
      (payload as { message?: string } | null)?.message ?? `Request failed (${res.status})`;
    const code = (payload as { code?: string } | null)?.code;
    throw new ApiError(message, res.status, code);
  }

  const issuedAccessToken = (payload as { data?: { access_token?: unknown } } | null)?.data?.access_token;
  if (typeof issuedAccessToken === 'string' && issuedAccessToken) accessToken = issuedAccessToken;

  // A proxy or an interrupted deployment can occasionally answer 200 with an
  // empty/non-JSON body. Returning that `null` to screens used to turn into a
  // misleading browser crash such as "Cannot read properties of null (reading
  // 'status')" after the provider had already completed the request. Surface
  // a recoverable message instead, and never let an invalid API envelope reach
  // a purchase screen.
  if (payload === null || typeof payload !== 'object') {
    throw new ApiError('The server returned an invalid response. Please refresh your history before trying again.', 502, 'INVALID_API_RESPONSE');
  }

  return payload as T;
}

// One per page load, reused across a purchase and any user-initiated retry
// after a timeout, so both attempts land on the same backend transaction
// via purchaseSlip's idempotencyKey replay path instead of double-charging
// the wallet. crypto.randomUUID() is available in every browser this app
// targets (all support fetch + crypto.randomUUID).
function newIdempotencyKey() {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export const api = {
  get: <T>(path: string, auth = true) => request<T>(path, { method: 'GET', auth }),
  post: <T>(path: string, body?: unknown, auth = true, retryOnNetworkError = false) =>
    request<T>(path, { method: 'POST', body, auth, retryOnNetworkError }),
  // For slip-purchase style endpoints (NIN/BVN by Techhub or FranceVerified):
  // a longer timeout to match how long those upstream lookups can actually
  // take, plus a stable Idempotency-Key so a retry after a timeout replays
  // the original transaction instead of creating a second one. Pass the same
  // `idempotencyKey` back in on a manual retry (e.g. via newIdempotencyKey()
  // called once per form submission, not per attempt).
  postSlip: <T>(path: string, body: unknown, idempotencyKey: string, timeoutMs = 45_000) =>
    request<T>(path, { method: 'POST', body, auth: true, timeoutMs, idempotencyKey }),
  newIdempotencyKey,
  // PDFs cannot use request() because that helper correctly expects a JSON
  // envelope. Keep the Authorization header here so documents are never put
  // behind a token-bearing URL that could leak through browser history.
  getFile: async (path: string) => {
    const token = getAccessToken();
    const res = await fetchWithTimeout(`${API_BASE}/api${path}`, {
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        'X-Client-Channel': 'web',
      },
      credentials: 'include',
    }, REQUEST_TIMEOUT_MS);
    if (!res.ok) {
      let message = `Could not open the document (${res.status}).`;
      try { message = (await res.json() as { message?: string }).message ?? message; } catch { /* PDF/proxy error body */ }
      throw new ApiError(message, res.status);
    }
    return res.blob();
  },
};
