import { proxyAdminRequest } from './_admin-proxy.js';

export async function onRequest({ request, env }) {
  return proxyAdminRequest(request, env);
}
