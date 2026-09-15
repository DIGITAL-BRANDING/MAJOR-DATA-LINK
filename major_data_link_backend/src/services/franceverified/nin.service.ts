import { franceVerifiedGet, franceVerifiedPost } from './client.js';

export function verifyNin(nin: string) {
  return franceVerifiedPost('/nin/verify/nin', { nin });
}

export function verifyNinByPhone(phone: string) {
  return franceVerifiedPost('/nin/verify/phone', { phone });
}

// Path confirmed against https://www.franceverified.com/api-docs/nin -
// it's "/nin/verify/demo", not "/nin/verify/demographic" (the previous value
// here 404s against the live API).
export function verifyNinByDemographic(params: { firstname: string; lastname: string; dob: string; gender?: string }) {
  return franceVerifiedPost('/nin/verify/demo', params);
}

/** IPE (Identity Profile Entry) Clearance. `type` per the docs, e.g. "get-old-tracking-id". */
export function submitIpeClearance(tracking: string, type: string) {
  return franceVerifiedPost('/nin/ipe', { tracking, type });
}

/** Shared by NIN Verification (IPE) and NIN Validation - both poll status by `reference`. */
export function checkNinReference(reference: string) {
  return franceVerifiedGet('/nin/check', { reference });
}
