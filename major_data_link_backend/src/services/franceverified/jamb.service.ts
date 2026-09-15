import { franceVerifiedGet, franceVerifiedPost } from './client.js';

/**
 * Docs: https://www.franceverified.com/api-docs/jamb
 * All four submit endpoints return either a resolved result immediately
 * (with `file_url` to the PDF/image) or a `processing`/pending state -
 * poll checkJambStatus(reference) either way.
 */
type JambIdentity = { fullname: string; profile_code: string; jamb_reg_no: string };

export function requestAdmissionLetter(params: JambIdentity & { additional_info?: string }) {
  return franceVerifiedPost('/jamb/admission-letter', params);
}

export function requestOriginalResult(params: JambIdentity) {
  return franceVerifiedPost('/jamb/original-result', params);
}

/** service_type examples: "CHANGE OF COURSE SLIP", "REGISTRATION SLIP", "ORIGINAL RESULTS REPRINTS ONLY". */
export function requestReprint(params: JambIdentity & { service_type: string }) {
  return franceVerifiedPost('/jamb/reprint', params);
}

/** service_type: "UTME" | "D.E" | "UTME_MOCK". */
export function vendJambPin(params: JambIdentity & { phone: string; service_type: 'UTME' | 'D.E' | 'UTME_MOCK' }) {
  return franceVerifiedPost('/jamb/vend-pin', params);
}

/** When status is "successful", `file_url` points to the downloadable PDF/image result. */
export function checkJambStatus(reference: string) {
  return franceVerifiedGet('/jamb/status', { reference });
}
