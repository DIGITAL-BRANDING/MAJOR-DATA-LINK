// Thin fetch wrapper for the MAJOR DATA-LINK backend API.
// In dev, requests to /api/* are proxied to VITE_API_PROXY_TARGET (see vite.config.ts).
// In production, set VITE_API_BASE_URL to the deployed backend origin
// (leave empty if this app is served from the same origin as the API).
const API_BASE = import.meta.env.VITE_API_BASE_URL ?? '';
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
  options: { method?: string; body?: unknown; auth?: boolean } = {}
): Promise<T> {
  const { method = 'GET', body, auth = true } = options;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    // Reporting metadata only; the backend never trusts this to authorize a request.
    'X-Client-Channel': 'web',
  };
  if (auth) {
    const token = getAccessToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  let res: Response;
  try {
    res = await fetch(`${API_BASE}/api${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'TimeoutError') {
      throw new ApiError('The request is taking too long. Please try again.', 408, 'REQUEST_TIMEOUT');
    }
    throw new ApiError('Could not connect to the server. Please check your connection and try again.', 0, 'NETWORK_ERROR');
  }

  let payload: unknown = null;
  try {
    payload = await res.json();
  } catch {
    // non-JSON response body — leave payload null
  }

  if (!res.ok) {
    const message =
      (payload as { message?: string } | null)?.message ?? `Request failed (${res.status})`;
    const code = (payload as { code?: string } | null)?.code;
    throw new ApiError(message, res.status, code);
  }

  return payload as T;
}

export const api = {
  get: <T>(path: string, auth = true) => request<T>(path, { method: 'GET', auth }),
  post: <T>(path: string, body?: unknown, auth = true) =>
    request<T>(path, { method: 'POST', body, auth }),
};
