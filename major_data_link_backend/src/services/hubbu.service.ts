import { createHash } from 'node:crypto';
import { env } from '../config/env.js';
import { ApiError } from '../middleware/error.js';
import { renderPersonalInformationSlipPdf, type IdentitySlipField } from '../lib/render-identity-slip-pdf.js';
import type { TechhubAsyncSubmitResult, TechhubSlipResult } from './techhub.service.js';

// Keep synchronous identity lookups alive long enough for the provider to
// finish its verification and render the slip. The web client allows 120s.
const LOOKUP_TIMEOUT_MS = 90_000;
const DOWNLOAD_TIMEOUT_MS = 20_000;
const MAX_PDF_BYTES = 12 * 1024 * 1024;
const MAX_RESPONSE_BYTES = 20 * 1024 * 1024;
type Json = Record<string, unknown>;
type HubbuResponse = Json & { __httpStatus: number; __rawBody: string; __jsonValid: boolean };
const record = (value: unknown): Json => value && typeof value === 'object' && !Array.isArray(value) ? value as Json : {};
const nonEmpty = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value as Json).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, canonical(item)]));
  return value;
}

/** Stable one-way fingerprint to deduplicate unresolved retries without storing identifiers in clear text. */
export function hubbuRequestHash(userId: string, service: string, input: unknown): string {
  return createHash('sha256').update(JSON.stringify(canonical({ userId, service, input }))).digest('hex');
}

/** Stable for overlapping HTTP retries while allowing a later intentional purchase. */
export function hubbuIdempotencyKey(requestHash: string, now = Date.now()): string {
  return `hubbu-${requestHash}-${Math.floor(now / 30_000)}`;
}

function responseLayers(raw: HubbuResponse): Json[] {
  const envelopeKeys = ['data', 'result', 'response', 'payload', 'output'];
  const layers: Json[] = [];
  const seen = new Set<object>();
  const visit = (value: unknown, depth: number) => {
    const current = record(value);
    if (!Object.keys(current).length || seen.has(current) || depth > 5) return;
    seen.add(current);
    for (const key of envelopeKeys) visit(current[key], depth + 1);
    layers.push(current);
  };
  visit(raw, 0);
  return layers;
}

function firstValue(layers: Json[], keys: string[]) {
  for (const layer of layers) for (const key of keys) if (layer[key] !== undefined && layer[key] !== null && layer[key] !== '') return layer[key];
  return undefined;
}

function stringValue(value: unknown) { return value === undefined || value === null ? undefined : String(value); }

function identityFields(value: Json): IdentitySlipField[] {
  const first = stringValue(firstValue([value], ['first_name', 'firstName', 'firstname', 'given_name', 'givenName']));
  const middle = stringValue(firstValue([value], ['middle_name', 'middleName', 'other_names', 'otherNames']));
  const last = stringValue(firstValue([value], ['last_name', 'lastName', 'surname', 'family_name', 'familyName']));
  const nin = stringValue(firstValue([value], ['nin', 'nin_number', 'ninNumber', 'id_number', 'idNumber']));
  const phone = stringValue(firstValue([value], ['phone', 'phone_number', 'phoneNumber', 'mobile']));
  const dob = stringValue(firstValue([value], ['date_of_birth', 'dateOfBirth', 'dob', 'birthdate']));
  const gender = stringValue(firstValue([value], ['gender', 'sex']));
  return [
    { label: 'First Name', value: first },
    { label: 'Middle Name', value: middle },
    { label: 'Last Name', value: last },
    { label: 'NIN', value: nin },
    { label: 'Phone Number', value: phone },
    { label: 'Date of Birth', value: dob },
    { label: 'Gender', value: gender }
  ];
}

function isIdentityData(value: Json) {
  return identityFields(value).some(({ label, value: fieldValue }) =>
    (label === 'First Name' || label === 'Last Name' || label === 'NIN') && fieldValue !== undefined && String(fieldValue).trim() !== ''
  );
}

function successState(raw: HubbuResponse): 'success' | 'failure' | 'pending' | 'unknown' {
  if (!raw.__jsonValid) return 'unknown';
  const layers = responseLayers(raw);
  const status = firstValue(layers, ['status', 'state', 'outcome']);
  const normalized = typeof status === 'string' ? status.trim().toLowerCase() : '';
  if (['success', 'successful', 'completed', 'complete', 'verified', 'ok'].includes(normalized)) return 'success';
  if (['pending', 'queued', 'processing', 'in_progress', 'in progress', 'accepted'].includes(normalized)) return 'pending';
  if (['failed', 'failure', 'error', 'rejected', 'declined'].includes(normalized)) return 'failure';
  if (firstValue(layers, ['success']) === true) return 'success';
  if (firstValue(layers, ['success']) === false) return 'failure';
  if (firstValue(layers, ['code']) === 'OK') return 'success';
  if (raw.__httpStatus >= 500 || raw.__httpStatus === 0) return 'unknown';
  return raw.__httpStatus >= 200 && raw.__httpStatus < 300 ? 'unknown' : 'failure';
}

function safeMessage(raw: HubbuResponse, fallback: string) {
  const value = firstValue(responseLayers(raw), ['message', 'detail', 'error_description', 'error']);
  return nonEmpty(value) ? value.trim().slice(0, 500) : fallback;
}

async function request(path: string, body?: Json): Promise<HubbuResponse> {
  if (!env.HUBBU_API_KEY) throw new ApiError(503, 'Hubbu provider is not configured.', 'PROVIDER_NOT_CONFIGURED');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), LOOKUP_TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(new URL(path, env.HUBBU_BASE_URL.endsWith('/') ? env.HUBBU_BASE_URL : `${env.HUBBU_BASE_URL}/`), {
      method: body ? 'POST' : 'GET',
      headers: { 'X-API-KEY': env.HUBBU_API_KEY, ...(body ? { 'Content-Type': 'application/json', Accept: 'application/json' } : { Accept: 'application/json' }) },
      ...(body ? { body: JSON.stringify(body) } : {}), signal: controller.signal, redirect: 'error'
    });
  } catch (error) {
    clearTimeout(timer);
    // A timeout or socket reset does not prove Hubbu failed to receive the
    // request. Callers keep the wallet debit pending for reconciliation.
    throw new ApiError(502, error instanceof Error && error.name === 'AbortError' ? 'Hubbu response timed out; request outcome is unknown.' : 'Hubbu connection ended before a response; request outcome is unknown.', 'HUBBU_OUTCOME_UNKNOWN');
  }

  try {
    const rawBody = await readTextBounded(response, MAX_RESPONSE_BYTES);
    let parsed: unknown;
    let jsonValid = false;
    try { parsed = JSON.parse(rawBody); jsonValid = true; } catch { parsed = undefined; }
    const parsedRecord = record(parsed);
    const envelope: HubbuResponse = {
      ...parsedRecord,
      ...(parsed !== undefined && (Array.isArray(parsed) || parsed === null || typeof parsed !== 'object') ? { __parsedBody: parsed } : {}),
      __httpStatus: response.status,
      __rawBody: rawBody.slice(0, MAX_PDF_BYTES),
      __jsonValid: jsonValid
    };
    return envelope;
  } finally { clearTimeout(timer); }
}

async function readTextBounded(response: Response, limit: number): Promise<string> {
  const declaredLength = Number(response.headers.get('content-length'));
  if (Number.isFinite(declaredLength) && declaredLength > limit) throw new ApiError(502, 'Hubbu response exceeded the allowed size; request outcome is unknown.', 'HUBBU_RESPONSE_TOO_LARGE');
  if (!response.body) return '';
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) {
        await reader.cancel();
        throw new ApiError(502, 'Hubbu response exceeded the allowed size; request outcome is unknown.', 'HUBBU_RESPONSE_TOO_LARGE');
      }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  return new TextDecoder().decode(Buffer.concat(chunks.map((chunk) => Buffer.from(chunk))));
}

function downloadToken(value: string): string | null {
  const trimmed = value.trim();
  if (trimmed.length > 4096) return null;
  try {
    if (/^https?:\/\//i.test(trimmed) || trimmed.startsWith('/')) {
      const url = new URL(trimmed, env.HUBBU_BASE_URL);
      const base = new URL(env.HUBBU_BASE_URL);
      if (url.protocol !== 'https:' || url.origin !== base.origin || url.pathname !== '/slips/download') return null;
      return url.searchParams.get('file');
    }
    // Docs may return the download token directly rather than a URL.
    return /^[A-Za-z0-9_-]+$/.test(trimmed) ? trimmed : null;
  } catch { return null; }
}

async function downloadPdf(token: string): Promise<string | undefined> {
  if (!env.HUBBU_API_KEY) return undefined;
  const url = new URL('/slips/download', env.HUBBU_BASE_URL.endsWith('/') ? env.HUBBU_BASE_URL : `${env.HUBBU_BASE_URL}/`);
  url.searchParams.set('file', token);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DOWNLOAD_TIMEOUT_MS);
  try {
    const response = await fetch(url, { headers: { 'X-API-KEY': env.HUBBU_API_KEY, Accept: 'application/pdf' }, signal: controller.signal, redirect: 'error' });
    if (!response.ok || !response.body) return undefined;
    const type = response.headers.get('content-type')?.toLowerCase() ?? '';
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > MAX_PDF_BYTES) { await reader.cancel(); return undefined; }
        chunks.push(value);
      }
    } finally { reader.releaseLock(); }
    const pdf = Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)));
    if (!(type.includes('pdf') || pdf.subarray(0, 5).toString('ascii') === '%PDF-') || pdf.subarray(0, 5).toString('ascii') !== '%PDF-') return undefined;
    return pdf.toString('base64');
  } catch { return undefined; }
  finally { clearTimeout(timer); }
}

async function extractSlipResult(raw: HubbuResponse, fallback: string, title: 'NIN Slip' | 'BVN Slip'): Promise<TechhubSlipResult> {
  const layers = responseLayers(raw);
  let state = successState(raw);
  const rawData = firstValue(layers, ['result', 'user_data', 'userData', 'profile', 'record', 'response', 'payload']);
  const userData = (isIdentityData(record(rawData)) ? record(rawData) : undefined)
    ?? layers.find(isIdentityData);
  const pdf = firstValue(layers, ['pdf_base64', 'pdf', 'pdfBase64']);
  const downloadUrl = firstValue(layers, ['download_url', 'pdf_url', 'slip_url', 'downloadUrl']);
  let base64 = nonEmpty(pdf) ? pdf.replace(/^data:application\/pdf;base64,/i, '').replace(/\s/g, '') : undefined;
  if (base64 && (!/^[A-Za-z0-9+/]*={0,2}$/.test(base64) || Buffer.from(base64, 'base64').subarray(0, 5).toString('ascii') !== '%PDF-')) base64 = undefined;
  let downloadError: string | undefined;
  if (!base64 && nonEmpty(downloadUrl)) {
    const token = downloadToken(downloadUrl);
    if (token) base64 = await downloadPdf(token);
    if (!base64) downloadError = 'Hubbu PDF download was unavailable or failed validation';
  }
  if (!base64 && userData && isIdentityData(userData)) {
    try {
      base64 = await renderPersonalInformationSlipPdf({
        title,
        subtitle: 'Verified identity details',
        fields: identityFields(userData),
        issuedAt: new Date()
      });
    } catch (error) {
      console.error('[hubbu] could not render a report from verified identity data:', error);
    }
  }
  // Some Hubbu deployments return the verified identity payload without a
  // top-level success flag. A usable identity record is a completed result.
  if (state === 'unknown' && ((userData && isIdentityData(userData)) || base64)) state = 'success';
  if (state === 'success' && !userData && !base64) state = 'unknown';
  return {
    ok: state === 'success',
    pending: state === 'pending' || state === 'unknown',
    providerRef: (() => {
      const ticket = firstValue(layers, ['ticket_id', 'request_id', 'reference']);
      return nonEmpty(ticket) || typeof ticket === 'number' ? String(ticket) : undefined;
    })(),
    message: state === 'success'
      ? 'Verification completed successfully. Your document is ready.'
      : state === 'pending'
        ? 'Hubbu is still processing this verification. Please check the status shortly.'
        : state === 'unknown'
          ? 'We could not confirm Hubbu’s result yet. Your request is being checked; please do not submit it again.'
          : safeMessage(raw, fallback),
    userData, pdfBase64: base64,
    // Never pass an untrusted provider URL to the browser; PDF bytes are
    // fetched server-side from the documented same-origin download endpoint.
    raw: { ...raw, __classifiedState: state, ...(downloadError ? { __pdfDownloadError: downloadError } : {}) }
  };
}

export const hubbuService = {
  async verifyNin(input: { method: 'nin' | 'phone' | 'tracking' | 'demo'; nin?: string; phone?: string; tracking_id?: string; first_name?: string; last_name?: string; dob?: string; gender?: string; slip_type?: string }): Promise<TechhubSlipResult> {
    return extractSlipResult(await request('/nin/verify', input as Json), 'Hubbu could not verify this NIN.', 'NIN Slip');
  },
  async verifyBvn(bvn: string, slipType: string): Promise<TechhubSlipResult> {
    return extractSlipResult(await request('/bvn/verify', { bvn, slip_type: slipType }), 'Hubbu could not verify this BVN.', 'BVN Slip');
  },
  async submit(path: '/ipe/clearance' | '/bvn/retrieval' | '/nin/modification' | '/nin/personalization' | '/bvn/modification', body: Json): Promise<TechhubAsyncSubmitResult> {
    const raw = await request(path, body);
    const layers = responseLayers(raw);
    const state = successState(raw);
    const ticketId = firstValue(layers, ['request_id', 'ticket_id', 'reference', 'id']);
    const accepted = state === 'success' || state === 'pending';
    return {
      ok: accepted,
      accepted,
      ticketId: nonEmpty(ticketId) || typeof ticketId === 'number' ? String(ticketId) : undefined,
      message: safeMessage(raw, accepted ? 'Hubbu accepted the request.' : state === 'unknown' ? 'Hubbu response was incomplete; request outcome is unknown.' : 'Hubbu rejected the request.'),
      raw: { ...raw, __classifiedState: state }
    };
  },
  async balance(): Promise<Json> {
    const raw = await request('/balance');
    if (successState(raw) !== 'success') throw new ApiError(502, safeMessage(raw, 'Could not read Hubbu balance.'), 'HUBBU_BALANCE_FAILED');
    return raw;
  }
};
