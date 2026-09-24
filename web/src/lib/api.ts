// Thin fetch wrapper for the MAJOR DATA-LINK backend API.
// In dev, requests to /api/* are proxied to VITE_API_PROXY_TARGET (see vite.config.ts).
// In production, set VITE_API_BASE_URL to the deployed backend origin
// (leave empty if this app is served from the same origin as the API).
// Exported so src/components/ChatWidget.tsx can point its Socket.IO
// connection at the same backend origin as every REST call here, instead
// of duplicating this env lookup.
export const API_BASE = import.meta.env.VITE_API_BASE_URL ?? '';
export const PARTNER_API_BASE = `${API_BASE}/api/v1`;

const TOKEN_KEY = 'mdl_access_token';
const REFRESH_KEY = 'mdl_refresh_token';
const REQUEST_TIMEOUT_MS = 25_000;

export function getAccessToken() {
  return localStorage.getItem(TOKEN_KEY) ?? sessionStorage.getItem(TOKEN_KEY);
}

/**
 * `remember` picks where the tokens live: localStorage survives closing the
 * browser (default - matches the app's previous always-persistent
 * behavior), sessionStorage clears when the tab/browser closes ("Remember
 * Me" off, e.g. on a shared/public computer). getAccessToken() above checks
 * both, so every other call site keeps working unmodified either way.
 */
export function setTokens(accessToken: string, refreshToken: string, remember = true) {
  const store = remember ? localStorage : sessionStorage;
  const other = remember ? sessionStorage : localStorage;
  // Clear the other backend first so switching "Remember Me" between logins
  // never leaves a stale duplicate token sitting in the other one.
  other.removeItem(TOKEN_KEY);
  other.removeItem(REFRESH_KEY);
  store.setItem(TOKEN_KEY, accessToken);
  store.setItem(REFRESH_KEY, refreshToken);
}

export function clearTokens() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_KEY);
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(REFRESH_KEY);
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
  options: { method?: string; body?: unknown; auth?: boolean; retryOnNetworkError?: boolean } = {}
): Promise<T> {
  const { method = 'GET', body, auth = true, retryOnNetworkError = false } = options;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    // Reporting metadata only; the backend never trusts this to authorize a request.
    'X-Client-Channel': 'web',
  };
  if (auth) {
    const token = getAccessToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  const doFetch = () =>
    fetch(`${API_BASE}/api${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

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
      const isTimeout = firstError instanceof DOMException && firstError.name === 'TimeoutError';
      if (isTimeout || !canRetry) throw firstError;
      // Patchy Nigerian mobile data very often fails once and succeeds a
      // moment later when the signal comes back - one retry after a short
      // pause meaningfully cuts down on "could not connect" errors without
      // masking a genuinely dead connection (it still fails after this).
      await new Promise((resolve) => setTimeout(resolve, 800));
      res = await doFetch();
    }
  } catch (error) {
    if (error instanceof DOMException && error.name === 'TimeoutError') {
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

export const api = {
  get: <T>(path: string, auth = true) => request<T>(path, { method: 'GET', auth }),
  post: <T>(path: string, body?: unknown, auth = true, retryOnNetworkError = false) =>
    request<T>(path, { method: 'POST', body, auth, retryOnNetworkError }),
  // PDFs cannot use request() because that helper correctly expects a JSON
  // envelope. Keep the Authorization header here so documents are never put
  // behind a token-bearing URL that could leak through browser history.
  getFile: async (path: string) => {
    const token = getAccessToken();
    const res = await fetch(`${API_BASE}/api${path}`, {
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        'X-Client-Channel': 'web',
      },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!res.ok) {
      let message = `Could not open the document (${res.status}).`;
      try { message = (await res.json() as { message?: string }).message ?? message; } catch { /* PDF/proxy error body */ }
      throw new ApiError(message, res.status);
    }
    return res.blob();
  },
};
