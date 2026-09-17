import {
  submitNinValidation as fvSubmitNinValidation,
  checkNinValidation as fvCheckNinValidation,
  type NinValidationType
} from './franceverified/nin-validation.service.js';
import type { TechhubAsyncSubmitResult, TechhubAsyncStatusResult } from './techhub.service.js';

/**
 * Our internal validation-type keys (see NIN_VALIDATION_SERVICE_BY_TYPE in
 * verification.service.ts) mapped to FranceVerified's own NinValidationType
 * enum (see franceverified/nin-validation.service.ts). These are NOT a 1:1
 * naming coincidence - each mapping below was matched by meaning, not by
 * string similarity, and only included where that meaning is actually
 * confident:
 *   nin_validation     -> bypass_nin
 *   no_record          -> no_record            (exact match)
 *   bank_validation     -> bank_validation       (exact match)
 *   modification        -> modification_validation
 *   photo_error         -> photography_error
 *   v.nin_validation    -> vnin_validation
 *
 * Deliberately NOT mapped - FranceVerified has no corresponding type:
 *   sim               - no matching type in FranceVerified's enum at all.
 *   update_records     - no matching type in FranceVerified's enum at all.
 * A service in this gap simply has no `franceverified` entry, which makes
 * submitNinValidationFV() below fail loudly with a specific, actionable
 * message rather than silently submitting the wrong validation type.
 */
const TYPE_MAP: Partial<Record<string, NinValidationType>> = {
  // FranceVerified exposes its general validation route as `bypass_nin`.
  // It is intentionally the route used when admin selects FranceVerified
  // for our General NIN Validation service.
  nin_validation: 'bypass_nin',
  no_record: 'no_record',
  bank_validation: 'bank_validation',
  modification: 'modification_validation',
  photo_error: 'photography_error',
  'v.nin_validation': 'vnin_validation'
};

const SUPPORTED_TYPES_HINT = Object.keys(TYPE_MAP).join(', ');

function pickString(record: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim().length > 0) return value.trim();
  }
  return undefined;
}

export async function submitNinValidationFV(nin: string, validationType?: string): Promise<TechhubAsyncSubmitResult> {
  const key = validationType ?? 'nin_validation';
  const fvType = TYPE_MAP[key];
  if (!fvType) {
    return {
      ok: false,
      message: `FranceVerified has no confirmed equivalent for NIN validation type "${key}" - supported types on this provider are: ${SUPPORTED_TYPES_HINT}. Use Techhub for this type, or pick a supported one.`,
      raw: null
    };
  }

  const result = await fvSubmitNinValidation(nin, fvType);
  if (!result.ok || !result.data) {
    return { ok: false, message: result.message, raw: result.raw };
  }

  const data = result.data as Record<string, unknown>;
  // FranceVerified's docs don't publish a confirmed field name for the
  // tracking reference on this endpoint specifically - tried in order of
  // how their other endpoints name it (trackingId on /nin/verify/nin,
  // reference on /nin/check's own query param).
  const ticketId = pickString(data, ['reference', 'trackingId', 'tracking_id', 'ticketId', 'ticket_id', 'id']);
  if (!ticketId) {
    return { ok: false, message: 'FranceVerified accepted the request but did not return a tracking reference to poll', raw: result.raw };
  }

  return { ok: true, ticketId, message: result.message, raw: result.raw };
}

export async function checkNinValidationFV(reference: string): Promise<TechhubAsyncStatusResult> {
  const result = await fvCheckNinValidation(reference);

  // client.ts's envelope parsing treats a "pending" status as ok:true (see
  // its own comment on why - shared JSON-verification transport, and JAMB's
  // polling flow needs `status: "pending"` to still count as a normal,
  // non-error response) so `result.ok` alone cannot distinguish
  // pending/success here - the actual status text has to be read back out
  // of the response body itself.
  const data = (result.data ?? {}) as Record<string, unknown>;
  const statusText = typeof data.status === 'string' ? data.status.toLowerCase() : '';

  if (!result.ok) {
    return { ticketId: reference, status: 'failed', response: Object.keys(data).length ? data : null, raw: result.raw };
  }
  if (statusText === 'pending' || statusText === 'processing' || statusText === 'in_progress') {
    return { ticketId: reference, status: 'pending', response: null, raw: result.raw };
  }
  if (statusText === 'failed' || statusText === 'rejected' || statusText === 'declined') {
    return { ticketId: reference, status: 'failed', response: data, raw: result.raw };
  }
  // ok:true with a status that isn't recognizably pending/failed (e.g.
  // "success", "successful", "completed", or no status field at all) is
  // treated as done.
  return { ticketId: reference, status: 'success', response: data, raw: result.raw };
}
