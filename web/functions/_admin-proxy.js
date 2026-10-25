const ADMIN_PATH = /^\/admin(?:\/|$)/;
const DEFAULT_BACKEND_ORIGIN = 'https://k-tech.com.ng';

/**
 * Proxy AdminJS through the customer-facing host while the web app calls the
 * Railway apex domain directly for APIs and Socket.IO.
 */
export async function proxyAdminRequest(request, env) {
  const configuredOrigin = String(env.KTECH_BACKEND_ORIGIN || DEFAULT_BACKEND_ORIGIN).trim();

  let backendOrigin;
  try {
    backendOrigin = new URL(configuredOrigin);
    if (backendOrigin.protocol !== 'https:' || backendOrigin.username || backendOrigin.password) {
      throw new Error('KTECH_BACKEND_ORIGIN must be an HTTPS origin.');
    }
  } catch {
    return Response.json(
      { status: false, message: 'Admin backend proxy URL is invalid.' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  const incomingUrl = new URL(request.url);
  if (!ADMIN_PATH.test(incomingUrl.pathname)) {
    return new Response('Not found', { status: 404 });
  }

  // Use only the configured backend host; never let request input choose the
  // upstream. Preserve the full AdminJS path, query, method, body and cookies.
  const upstreamUrl = new URL(`${incomingUrl.pathname}${incomingUrl.search}`, backendOrigin.origin);
  const upstreamHeaders = new Headers(request.headers);
  upstreamHeaders.set('x-forwarded-host', incomingUrl.host);
  upstreamHeaders.set('x-forwarded-proto', incomingUrl.protocol.slice(0, -1));
  upstreamHeaders.delete('host');

  const upstreamRequest = new Request(upstreamUrl, request);
  const forwardedRequest = new Request(upstreamRequest, {
    headers: upstreamHeaders,
    redirect: 'manual',
  });

  return fetch(forwardedRequest);
}
