import { createHash, randomBytes } from 'node:crypto';

/**
 * Generates a live Partner API key. Used both by the admin "Create API Key"
 * action (admin/resources/partner.resource.ts) and the self-service portal's
 * own key-generation endpoint (routes/partner-portal.routes.ts) - extracted
 * here so the two paths can never drift into different key formats or hash
 * algorithms. Only the SHA-256 hash is ever persisted (see
 * middleware/partner-auth.ts's requirePartnerApiKey, which looks it up the
 * same way); the plaintext is returned once and never stored.
 */
export function createPartnerApiKey() {
  const plaintext = `mdl_live_${randomBytes(32).toString('hex')}`;
  return {
    plaintext,
    keyPrefix: plaintext.slice(0, 16),
    secretHash: createHash('sha256').update(plaintext, 'utf8').digest('hex')
  };
}
