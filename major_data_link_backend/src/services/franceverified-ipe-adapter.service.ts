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

export async function submitIpeClearanceFV(tracking: string, type: IpeClearanceType): Promise<TechhubAsyncSubmitResult> {
  const result = await submitIpeClearance(tracking, TYPE_MAP[type]);
  if (!result.ok || !result.data) return { ok: false, message: result.message, raw: result.raw };
  const data = result.data as Record<string, unknown>;
  const ticketId = pickString(data, ['reference', 'trackingId', 'tracking_id', 'ticketId', 'ticket_id', 'id']);
  if (!ticketId) return { ok: false, message: 'FranceVerified accepted the request but did not return a tracking reference to poll.', raw: result.raw };
  return { ok: true, ticketId, message: result.message, raw: result.raw };
}

export async function checkIpeClearanceFV(reference: string): Promise<TechhubAsyncStatusResult> {
  const result = await checkNinReference(reference);
  const data = (result.data ?? {}) as Record<string, unknown>;
  const status = typeof data.status === 'string' ? data.status.toLowerCase() : '';
  if (!result.ok || ['failed', 'rejected', 'declined'].includes(status)) {
    return { ticketId: reference, status: 'failed', response: Object.keys(data).length ? data : null, raw: result.raw };
  }
  if (['pending', 'processing', 'in_progress'].includes(status)) {
    return { ticketId: reference, status: 'pending', response: null, raw: result.raw };
  }
  return { ticketId: reference, status: 'success', response: data, raw: result.raw };
}
