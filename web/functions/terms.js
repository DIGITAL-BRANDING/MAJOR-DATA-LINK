import { proxyBackendRequest } from './_admin-proxy.js';

export async function onRequest({ request, env }) {
  return proxyBackendRequest(request, env);
}
