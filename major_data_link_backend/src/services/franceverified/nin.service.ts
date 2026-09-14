import { franceVerifiedPost } from './client.js';

export function verifyNin(nin: string) {
  return franceVerifiedPost('/nin/verify/nin', { nin });
}

export function verifyNinByPhone(phone: string) {
  return franceVerifiedPost('/nin/verify/phone', { phone });
}

export function verifyNinByDemographic(params: { firstname: string; lastname: string; dob: string; gender?: string }) {
  return franceVerifiedPost('/nin/verify/demographic', params);
}
