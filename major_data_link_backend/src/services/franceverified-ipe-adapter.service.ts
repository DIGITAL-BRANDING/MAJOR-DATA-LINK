import { checkNinReference, submitIpeClearance } from './franceverified/nin.service.js';
import type { IpeClearanceType } from './verification.service.js';
import type { TechhubAsyncSubmitResult, TechhubAsyncStatusResult } from './techhub.service.js';

const TYPE_MAP: Record<IpeClearanceType, string> = {
  get_old_tracking_id: 'get-old-tracking-id',
  inprocessing_error: 'inprocessing-error',
  tracking_is_being_processed: 'tracking-is-being-processed',
  modification_ipe: 'modification-ipe',
  hit_blocked: 'hit-blocked'
};

function pickString(record: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
}

function statusFrom(value: unknown, depth = 0): string {
  if (depth > 3 || typeof value !== 'object' || value === null || Array.isArray(value)) return '';
  const record = value as Record<string, unknown>;
  if (typeof record.status === 'string') return record.status.toLowerCase().trim();
  for (const key of ['data', 'response', 'result']) {
    const nested = statusFrom(record[key], depth + 1);
    if (nested) return nested;
  }
  return '';
}

export async function submitIpeClearanceFV(tracking: string, type: IpeClearanceType): Promise<TechhubAsyncSubmitResult> {
  const result = await submitIpeClearance(tracking, TYPE_MAP[type]);
  if (!result.ok || !result.data) return { ok: false, message: result.message, raw: result.raw };
  const data = result.data as Record<string, unknown>;
  const ticketId = pickString(data, ['reference', 'trackingId', 'tracking_id', 'ticketId', 'ticket_id', 'id']);
  if (!ticketId) return { ok: false, accepted: true, message: 'FranceVerified accepted the request but did not return a tracking reference to poll.', raw: result.raw };
  return { ok: true, ticketId, message: result.message, raw: result.raw };
}

export async function checkIpeClearanceFV(reference: string): Promise<TechhubAsyncStatusResult> {
  const result = await checkNinReference(reference);
  const data = (result.data ?? {}) as Record<string, unknown>;
  const status = statusFrom(result.data) || statusFrom(result.raw);
  // A failed HTTP request, timeout, malformed response, or unknown status is
  // not proof that the paid IPE itself failed. Keep it pending so the normal
  // reconciliation worker can retry instead of refunding on a transient
  // FranceVerified status-check problem.
  if (['failed', 'rejected', 'declined'].includes(status)) {
    return { ticketId: reference, status: 'failed', response: Object.keys(data).length ? data : null, raw: result.raw };
  }
  if (!result.ok || !status || ['pending', 'processing', 'in_progress', 'queued', 'submitted'].includes(status)) {
    return { ticketId: reference, status: 'pending', response: null, raw: result.raw };
  }
  if (['success', 'successful', 'complete', 'completed'].includes(status)) {
    return { ticketId: reference, status: 'success', response: data, raw: result.raw };
  }
  return { ticketId: reference, status: 'pending', response: null, raw: result.raw };
}
