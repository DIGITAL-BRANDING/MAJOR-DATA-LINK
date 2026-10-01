import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

/**
 * RFC 6238 time-based one-time passwords (Google Authenticator, Microsoft
 * Authenticator, Authy, 1Password ... all speak this): HMAC-SHA1, 6 digits,
 * 30-second steps. Implemented with node:crypto only, so the admin login
 * does not depend on a third-party package.
 */
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
export const TOTP_STEP_SECONDS = 30;

export function base32Encode(buf: Buffer): string {
  let bits = 0;
  let value = 0;
  let out = '';
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(input: string): Buffer {
  const clean = input.replace(/[\s=-]/g, '').toUpperCase();
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of clean) {
    const idx = ALPHABET.indexOf(ch);
    if (idx < 0) throw new Error('Invalid base32 secret');
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

/** A fresh 160-bit secret, base32 encoded (the length authenticator apps expect). */
export function generateTotpSecret(): string {
  return base32Encode(randomBytes(20));
}

function hotp(secret: Buffer, counter: number, digits = 6): string {
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(counter));
  const hmac = createHmac('sha1', secret).update(msg).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const bin =
    ((hmac[offset] & 0x7f) << 24) | (hmac[offset + 1] << 16) | (hmac[offset + 2] << 8) | hmac[offset + 3];
  return String(bin % 10 ** digits).padStart(digits, '0');
}

export function totpStep(nowMs = Date.now()): number {
  return Math.floor(nowMs / 1000 / TOTP_STEP_SECONDS);
}

export function generateTotp(secretBase32: string, nowMs = Date.now()): string {
  return hotp(base32Decode(secretBase32), totpStep(nowMs));
}

/**
 * Returns the matched time step, or null. `window` allows for clock drift
 * (1 = the previous and next 30s code are also accepted). `lastStep` is the
 * most recent step already used for this account: a code from that step or
 * earlier is refused, so one code can never be used twice (replay).
 */
export function verifyTotp(
  secretBase32: string,
  token: string,
  opts: { nowMs?: number; window?: number; lastStep?: number | null } = {}
): number | null {
  const candidate = String(token ?? '').replace(/\s/g, '');
  if (!/^\d{6}$/.test(candidate)) return null;
  const secret = base32Decode(secretBase32);
  const current = totpStep(opts.nowMs);
  const window = opts.window ?? 1;
  let matched: number | null = null;
  for (let w = -window; w <= window; w++) {
    const step = current + w;
    const expected = Buffer.from(hotp(secret, step));
    // Every step is compared (no early exit) so timing does not reveal which matched.
    if (timingSafeEqual(expected, Buffer.from(candidate)) && matched === null) matched = step;
  }
  if (matched === null) return null;
  if (opts.lastStep != null && matched <= opts.lastStep) return null;
  return matched;
}

export function otpauthUri(params: { issuer: string; account: string; secret: string }): string {
  const label = `${encodeURIComponent(params.issuer)}:${encodeURIComponent(params.account)}`;
  const q = new URLSearchParams({
    secret: params.secret,
    issuer: params.issuer,
    algorithm: 'SHA1',
    digits: '6',
    period: String(TOTP_STEP_SECONDS)
  });
  return `otpauth://totp/${label}?${q.toString()}`;
}
