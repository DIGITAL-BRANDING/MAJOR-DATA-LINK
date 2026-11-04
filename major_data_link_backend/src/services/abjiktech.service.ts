import { env } from '../config/env.js';
import { renderIdentitySlipPdf, renderPersonalInformationSlipPdf, type IdentitySlipField } from '../lib/render-identity-slip-pdf.js';
import { ApiError } from '../middleware/error.js';
import type { TechhubAsyncStatusResult, TechhubAsyncSubmitResult, TechhubBvnTier, TechhubSlipResult, TechhubSlipTier } from './techhub.service.js';

type AbjikResponse = Record<string, unknown>;

const NIN_BY_NIN_PATH: Record<TechhubSlipTier, string> = {
  premium: 'nin_by_nin.php', standard: 'nin_standard_slip.php', regular: 'nin_regular_slip.php', vnin: 'vnin_slip.php'
};
const NIN_BY_PHONE_PATH: Record<TechhubSlipTier, string> = {
  premium: 'nin_by_phone_premium.php', standard: 'nin_by_phone_standard.php', regular: 'nin_by_phone_regular.php', vnin: 'vnin_slip.php'
};
const BVN_PATH: Record<TechhubBvnTier, string> = { premium: 'bvn_premium_slip.php', standard: 'bvn_full_details_slip.php' };

function record(value: unknown): AbjikResponse | undefined {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as AbjikResponse : undefined;
}

function text(value: unknown): string | undefined {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (typeof value === 'number') return String(value);
  return undefined;
}

function findText(source: AbjikResponse, ...keys: string[]) {
  for (const key of keys) {
    const match = Object.keys(source).find((candidate) => candidate.toLowerCase() === key.toLowerCase());
    if (match) {
      const value = text(source[match]);
      if (value) return value;
    }
  }
  return undefined;
}

function identityRecord(envelope: AbjikResponse): AbjikResponse | undefined {
  const userData = record(envelope.user_data) ?? record(record(envelope.data)?.user_data) ?? record(envelope.data);
  if (!userData) return undefined;
  const nestedResponse = userData.response;
  return (Array.isArray(nestedResponse) ? record(nestedResponse[0]) : record(nestedResponse)) ?? userData;
}

function responseMessage(envelope: AbjikResponse, fallback: string) {
  return findText(envelope, 'message', 'error', 'description') ?? fallback;
}

async function lookup(path: string, payload: Record<string, string>, options: {
  title: 'NIN Slip' | 'BVN Slip';
  subtitle: string;
  reference: string;
  tier?: TechhubSlipTier | TechhubBvnTier | 'smart' | 'portrait';
  personalInfo?: boolean;
  fallbacks?: Record<string, string>;
}): Promise<TechhubSlipResult> {
  if (!env.ABJIKTECH_API_KEY) {
    throw new ApiError(503, 'AbjikTech verification provider is not configured.', 'PROVIDER_NOT_CONFIGURED');
  }
  const base = env.ABJIKTECH_BASE_URL.endsWith('/') ? env.ABJIKTECH_BASE_URL : `${env.ABJIKTECH_BASE_URL}/`;
  const url = new URL(path, base);
  const body = JSON.stringify({ api_key: env.ABJIKTECH_API_KEY, ...payload });
  const startedAt = Date.now();
  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body,
      signal: AbortSignal.timeout(90_000)
    });
  } catch (error) {
    console.warn('[abjiktech] request failed before response', JSON.stringify({ endpoint: path, duration_ms: Date.now() - startedAt, outcome: 'error' }));
    throw new ApiError(502, error instanceof Error && error.name === 'TimeoutError' ? 'AbjikTech verification timed out.' : 'Could not reach AbjikTech verification.', 'ABJIKTECH_CONNECTION_FAILED');
  }

  const raw: unknown = await response.json().catch(() => null);
  const envelope = record(raw) ?? {};
  const status = findText(envelope, 'status')?.toLowerCase();
  const responseCode = findText(envelope, 'response_code');
  const userData = identityRecord(envelope);
  const successful = response.ok && (status === 'success' || responseCode === '00' || envelope.success === true);
  const pdfBase64 = findText(envelope, 'pdf_base64') ?? findText(record(envelope.data) ?? {}, 'pdf_base64');
  const pdfUrl = findText(envelope, 'pdf_url', 'slip_url', 'download_url') ?? findText(record(envelope.data) ?? {}, 'pdf_url', 'slip_url', 'download_url');
  console.info('[abjiktech] slip response', JSON.stringify({ endpoint: path, http_status: response.status, duration_ms: Date.now() - startedAt, provider_status: status, response_code: responseCode, outcome: successful ? 'success' : 'failed' }));
  if (!successful || (!userData && !pdfBase64 && !pdfUrl)) {
    return { ok: false, message: responseMessage(envelope, 'AbjikTech could not find a matching verification record.'), raw };
  }
  const identity = userData ?? {};
  const genderRaw = findText(identity, 'gender');
  const gender = genderRaw?.toLowerCase() === 'm' ? 'Male' : genderRaw?.toLowerCase() === 'f' ? 'Female' : genderRaw;
  const fields: IdentitySlipField[] = options.title === 'NIN Slip' ? [
    { label: 'First Name', value: findText(identity, 'firstName', 'first_name', 'firstname') },
    { label: 'Middle Name', value: findText(identity, 'middleName', 'middle_name', 'middlename') },
    { label: 'Surname', value: findText(identity, 'surname', 'lastName', 'last_name') },
    { label: 'NIN', value: findText(identity, 'nin', 'idNumber', 'id_number') ?? payload.nin },
    { label: 'Gender', value: gender },
    { label: 'Date of Birth', value: findText(identity, 'birthDate', 'birthdate', 'date_of_birth', 'dob') },
    { label: 'Phone', value: findText(identity, 'telephoneNo', 'phone_number', 'phone') ?? payload.phone },
    { label: 'Tracking ID', value: findText(identity, 'trackingId', 'tracking_id') },
    { label: 'Address', value: findText(identity, 'address', 'residence_AdressLine1', 'residence_address') },
    { label: 'Town', value: findText(identity, 'residence_Town', 'residence_town', 'town') },
    { label: 'State', value: findText(identity, 'residence_state', 'state') },
    { label: 'Birth LGA', value: findText(identity, 'birthlga', 'birth_lga') },
    { label: 'Birth State', value: findText(identity, 'birthstate', 'birth_state') }
  ] : [
    { label: 'First Name', value: findText(identity, 'firstName', 'first_name', 'firstname') },
    { label: 'Middle Name', value: findText(identity, 'middleName', 'middle_name', 'middlename') },
    { label: 'Surname', value: findText(identity, 'surname', 'lastName', 'last_name') },
    { label: 'BVN', value: findText(identity, 'bvn') ?? payload.bvn },
    { label: 'Gender', value: gender },
    { label: 'Date of Birth', value: findText(identity, 'birthDate', 'birthday', 'date_of_birth', 'dob') },
    { label: 'Phone', value: findText(identity, 'telephoneNo', 'phone_number', 'phone') },
    { label: 'Address', value: findText(identity, 'address', 'residence_AdressLine1', 'residence_address') }
  ].filter((field) => field.value !== undefined);

  let renderedPdf = pdfBase64;
  const publicFields = Object.fromEntries(fields.filter((field): field is IdentitySlipField & { value: string } => Boolean(field.value)).map((field) => [field.label, field.value]));
  const photo = findText(identity, 'photo', 'image');
  if (!renderedPdf && !pdfUrl) {
    renderedPdf = options.personalInfo
      ? await renderPersonalInformationSlipPdf({ title: options.title, subtitle: options.subtitle, fields, photo: photo ? { base64: photo, format: 'jpeg' } : undefined, issuedAt: new Date(), tier: options.tier })
      : await renderIdentitySlipPdf({ title: options.title, subtitle: options.subtitle, reference: findText(identity, 'trackingId', 'tracking_id') ?? options.reference, fields, photo: photo ? { base64: photo, format: 'jpeg' } : undefined, issuedAt: new Date(), tier: options.tier });
  }
  return { ok: true, message: responseMessage(envelope, 'Verification completed successfully.'), userData: publicFields, pdfBase64: renderedPdf?.replace(/^data:application\/pdf;base64,/i, ''), pdfUrl, raw };
}

async function ticketRequest(path: string, payload: Record<string, string>) {
  if (!env.ABJIKTECH_API_KEY) throw new ApiError(503, 'AbjikTech verification provider is not configured.', 'PROVIDER_NOT_CONFIGURED');
  const base = env.ABJIKTECH_BASE_URL.endsWith('/') ? env.ABJIKTECH_BASE_URL : `${env.ABJIKTECH_BASE_URL}/`;
  const startedAt = Date.now();
  let response: Response;
  try {
    response = await fetch(new URL(path, base), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ api_key: env.ABJIKTECH_API_KEY, ...payload }),
      signal: AbortSignal.timeout(90_000)
    });
  } catch (error) {
    console.warn('[abjiktech] ticket request failed before response', JSON.stringify({ endpoint: path, duration_ms: Date.now() - startedAt, outcome: 'error' }));
    throw new ApiError(502, error instanceof Error && error.name === 'TimeoutError' ? 'AbjikTech request timed out.' : 'Could not reach AbjikTech.', 'ABJIKTECH_CONNECTION_FAILED');
  }
  const raw: unknown = await response.json().catch(() => null);
  const envelope = record(raw) ?? {};
  const nested = record(envelope.data) ?? {};
  const success = envelope.success === true || nested.success === true || findText(envelope, 'status')?.toLowerCase() === 'success';
  const ticketId = findText(envelope, 'ticket_id') ?? findText(nested, 'ticket_id');
  const transactionId = findText(envelope, 'transaction_id') ?? findText(nested, 'transaction_id');
  console.info('[abjiktech] ticket submit', JSON.stringify({ endpoint: path, http_status: response.status, duration_ms: Date.now() - startedAt, outcome: response.ok && success ? 'accepted' : 'rejected' }));
  const result: TechhubAsyncSubmitResult & { transactionId?: string } = {
    ok: response.ok && success,
    accepted: response.ok && success,
    ...(ticketId || transactionId ? { ticketId: ticketId ?? transactionId } : {}),
    ...(transactionId ? { transactionId } : {}),
    message: responseMessage(envelope, success ? 'Request submitted and is pending processing.' : 'AbjikTech did not accept the request.'),
    raw
  };
  return result;
}

async function ticketStatus(path: string, payload: Record<string, string>, id: string): Promise<TechhubAsyncStatusResult> {
  if (!env.ABJIKTECH_API_KEY) throw new ApiError(503, 'AbjikTech verification provider is not configured.', 'PROVIDER_NOT_CONFIGURED');
  const base = env.ABJIKTECH_BASE_URL.endsWith('/') ? env.ABJIKTECH_BASE_URL : `${env.ABJIKTECH_BASE_URL}/`;
  const startedAt = Date.now();
  const response = await fetch(new URL(path, base), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ api_key: env.ABJIKTECH_API_KEY, ...payload }),
    signal: AbortSignal.timeout(90_000)
  });
  const raw: unknown = await response.json().catch(() => null);
  const envelope = record(raw) ?? {};
  const data = record(envelope.data) ?? {};
  const statusText = (findText(envelope, 'status', 'state') ?? findText(data, 'status', 'state') ?? '').toLowerCase();
  const status: TechhubAsyncStatusResult['status'] = ['completed', 'complete', 'success', 'successful', 'approved'].includes(statusText)
    ? 'success'
    : ['failed', 'failure', 'rejected', 'error'].includes(statusText) ? 'failed' : 'pending';
  const responseData = record(envelope.response) ?? record(data.response) ?? data;
  console.info('[abjiktech] ticket status', JSON.stringify({ endpoint: path, http_status: response.status, duration_ms: Date.now() - startedAt, outcome: response.ok ? status : 'unconfirmed' }));
  return { ticketId: findText(envelope, 'ticket_id') ?? findText(data, 'ticket_id') ?? id, status: response.ok ? status : 'pending', response: responseData, raw };
}

export const abjikTicketService = {
  submitNinValidation(nin: string, errorType: 'no_record' | 'simbank_validation' | 'modification' | 'photo_error') {
    return ticketRequest('validation.php', { nin, error_type: errorType });
  },
  checkNinValidation(ticketId: string, transactionId?: string) {
    return ticketStatus('validation_status.php', { ticket_id: transactionId ?? ticketId }, ticketId);
  },
  submitIpeClearance(trackingId: string) {
    return ticketRequest('ipe_clearance.php', { trackingID: trackingId }).then((result) => ({ ...result, ticketId: trackingId }));
  },
  checkIpeClearance(trackingId: string) {
    return ticketStatus('get_status.php', { trackingID: trackingId }, trackingId);
  },
  submitPersonalization(trackingId: string) {
    return ticketRequest('personalization.php', { tracking_id: trackingId }).then((result) => ({ ...result, ticketId: trackingId }));
  },
  checkPersonalization(trackingId: string) {
    return ticketStatus('personalization_status.php', { tracking_id: trackingId }, trackingId);
  }
};

export const abjikTechService = {
  ninByNin(nin: string, tier: TechhubSlipTier, personalInfo = false) {
    return lookup(NIN_BY_NIN_PATH[tier], { nin }, { title: 'NIN Slip', subtitle: 'Verified by NIN', reference: nin, tier, personalInfo });
  },
  ninByPhone(phone: string, tier: TechhubSlipTier, personalInfo = false) {
    return lookup(NIN_BY_PHONE_PATH[tier], { phone }, { title: 'NIN Slip', subtitle: 'Verified by phone', reference: phone, tier, personalInfo });
  },
  ninByDemographic(params: { firstname: string; lastname: string; dob: string; gender?: string }) {
    return lookup('nin_by_demo.php', { firstname: params.firstname, lastname: params.lastname, dob: params.dob, gender: params.gender?.toLowerCase() ?? 'male' }, { title: 'NIN Slip', subtitle: 'Verified by demographic details', reference: `${params.firstname} ${params.lastname}` });
  },
  bvnSlip(bvn: string, tier: TechhubBvnTier) {
    return lookup(BVN_PATH[tier], { bvn }, { title: 'BVN Slip', subtitle: 'Verified by BVN', reference: bvn, tier });
  }
};
