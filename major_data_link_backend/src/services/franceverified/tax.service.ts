import { franceVerifiedPost } from './client.js';

/** Docs: https://www.franceverified.com/api-docs/tax */
export function verifyIndividualTin(params: { bvn: string; firstName: string; lastName: string; dateOfBirth: string }) {
  return franceVerifiedPost('/tax/verify', { type: 'individual', ...params });
}

/** orgType per FranceVerified's own enum (docs sample uses "2" for Limited Liability) - confirm the full list against their dashboard before hardcoding options in the UI. */
export function verifyBusinessTin(params: { orgType: string; rc: string }) {
  return franceVerifiedPost('/tax/verify', { type: 'business', ...params });
}
