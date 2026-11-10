import { franceVerifiedGet, franceVerifiedPost } from './client.js';

export function verifyNin(nin: string) {
  // The FranceVerified docs show a `provider` selector on this endpoint
  // (v1/v2/v3). Pin V2 so the endpoint does not depend on an upstream default
  // that may route to an unavailable legacy lookup provider.
  return franceVerifiedPost('/nin/verify/nin', { nin, provider: 'v2' });
}

export function verifyNinByPhone(phone: string) {
  return franceVerifiedPost('/nin/verify/phone', { phone, provider: 'v2' });
}

// Path confirmed against https://www.franceverified.com/api-docs/nin -
// it's "/nin/verify/demo", not "/nin/verify/demographic" (the previous value
// here 404s against the live API).
export function verifyNinByDemographic(params: { firstname: string; lastname: string; dob: string; gender?: string }) {
  return franceVerifiedPost('/nin/verify/demo', { ...params, provider: 'v2' });
}

/** IPE (Identity Profile Entry) Clearance. `type` per the docs, e.g. "get-old-tracking-id". */
export function submitIpeClearance(tracking: string, type: string) {
  return franceVerifiedPost('/nin/ipe', { tracking, type });
}

/** Shared by NIN Verification (IPE) and NIN Validation - both poll status by `reference`. */
export function checkNinReference(reference: string) {
  return franceVerifiedGet('/nin/check', { reference });
}
