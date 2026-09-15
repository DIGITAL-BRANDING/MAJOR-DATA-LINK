import { franceVerifiedGet, franceVerifiedPost } from './client.js';

/** Docs: https://www.franceverified.com/api-docs/nin_validation */
export const NIN_VALIDATION_TYPES = [
  'no_record',
  'photography_error',
  'modification_validation',
  'bypass_nin',
  'vnin_validation',
  'bank_validation',
  'jamb_validation'
] as const;

export type NinValidationType = (typeof NIN_VALIDATION_TYPES)[number];

export function submitNinValidation(nin: string, type: NinValidationType) {
  return franceVerifiedPost('/nin/validate', { nin, type });
}

/** Same underlying endpoint as nin.service.ts's checkNinReference - kept as its own export here so this file stays independently usable. */
export function checkNinValidation(reference: string) {
  return franceVerifiedGet('/nin/check', { reference });
}
