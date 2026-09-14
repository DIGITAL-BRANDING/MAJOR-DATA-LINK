import { franceVerifiedPost } from './client.js';

export function verifyBvn(bvn: string) {
  return franceVerifiedPost('/bvn/verify/bvn', { bvn });
}

export function verifyBvnByPhone(phone: string) {
  return franceVerifiedPost('/bvn/verify/phone', { phone });
}
