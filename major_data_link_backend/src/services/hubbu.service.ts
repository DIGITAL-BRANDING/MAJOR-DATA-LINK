import { env } from '../config/env.js';
import { ApiError } from '../middleware/error.js';
import type { TechhubAsyncSubmitResult, TechhubSlipResult } from './techhub.service.js';

const TIMEOUT_MS = 20_000;
type Json = Record<string, unknown>;
const record = (value: unknown): Json => value && typeof value === 'object' && !Array.isArray(value) ? value as Json : {};

async function request(path: string, body?: Json): Promise<Json> {
  if (!env.HUBBU_API_KEY) throw new ApiError(503, 'Hubbu provider is not configured.', 'PROVIDER_NOT_CONFIGURED');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(new URL(path, env.HUBBU_BASE_URL.endsWith('/') ? env.HUBBU_BASE_URL : `${env.HUBBU_BASE_URL}/`), {
      method: body ? 'POST' : 'GET', headers: { 'X-API-KEY': env.HUBBU_API_KEY, ...(body ? { 'Content-Type': 'application/json' } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}), signal: controller.signal
    });
    const data = record(await response.json().catch(() => ({})));
    if (!response.ok || data.status === 'error' || data.success === false) {
      return { ...data, __httpStatus: response.status };
    }
    return data;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(502, error instanceof Error && error.name === 'AbortError' ? 'Hubbu request timed out.' : 'Could not connect to Hubbu.', 'HUBBU_CONNECTION_ERROR');
  } finally { clearTimeout(timer); }
}

export const hubbuService = {
  async verifyNin(input: { method: 'nin' | 'phone' | 'tracking' | 'demo'; nin?: string; phone?: string; tracking_id?: string; first_name?: string; last_name?: string; dob?: string; gender?: string; slip_type?: string }): Promise<TechhubSlipResult> {
    const raw = await request('/nin/verify', input as Json); const data = record(raw.data);
    const success = raw.status === 'success' || raw.success === true;
    return { ok: success, message: String(raw.message ?? (success ? 'Verification successful' : 'Hubbu could not verify this NIN.')),
      userData: Object.keys(record(data.result)).length ? record(data.result) : undefined,
      pdfBase64: typeof data.pdf_base64 === 'string' ? data.pdf_base64 : undefined,
      pdfUrl: typeof data.download_url === 'string' ? data.download_url : undefined, raw };
  },
  async verifyBvn(bvn: string, slipType: string): Promise<TechhubSlipResult> {
    const raw = await request('/bvn/verify', { bvn, slip_type: slipType }); const data = record(raw.data);
    const success = raw.status === 'success' || raw.success === true;
    return { ok: success, message: String(raw.message ?? (success ? 'Verification successful' : 'Hubbu could not verify this BVN.')),
      userData: Object.keys(record(data.result)).length ? record(data.result) : undefined,
      pdfBase64: typeof data.pdf_base64 === 'string' ? data.pdf_base64 : undefined,
      pdfUrl: typeof data.download_url === 'string' ? data.download_url : undefined, raw };
  },
  async submit(path: '/ipe/clearance' | '/bvn/retrieval' | '/nin/modification' | '/nin/personalization' | '/bvn/modification', body: Json): Promise<TechhubAsyncSubmitResult> {
    const raw = await request(path, body); const data = record(raw.data);
    const ticketId = data.request_id ?? data.reference ?? raw.request_id;
    const ok = raw.status === 'success' || raw.success === true || (typeof data.status === 'string' && data.status.toLowerCase() === 'pending');
    return { ok, accepted: ok, ticketId: ticketId == null ? undefined : String(ticketId), message: String(raw.message ?? 'Hubbu accepted the request.'), raw };
  },
  async balance(): Promise<Json> { return request('/balance'); }
};
