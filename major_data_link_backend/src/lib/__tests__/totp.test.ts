import { describe, expect, it } from 'vitest';
import { base32Decode, base32Encode, generateTotp, generateTotpSecret, otpauthUri, verifyTotp } from '../totp.js';

// RFC 6238 Appendix B test secret is the ASCII string "12345678901234567890".
const RFC_SECRET = base32Encode(Buffer.from('12345678901234567890'));

describe('totp', () => {
  it('matches the RFC 6238 SHA-1 test vectors (last 6 digits)', () => {
    const vectors: Array<[number, string]> = [
      [59, '287082'],
      [1111111109, '081804'],
      [1111111111, '050471'],
      [1234567890, '005924'],
      [2000000000, '279037'],
      [20000000000, '353130']
    ];
    for (const [seconds, code] of vectors) expect(generateTotp(RFC_SECRET, seconds * 1000)).toBe(code);
  });

  it('base32 round-trips and tolerates spaces, dashes and lower case', () => {
    const raw = Buffer.from('hello world, 2fa!');
    expect(base32Decode(base32Encode(raw)).equals(raw)).toBe(true);
    const spaced = base32Encode(raw).replace(/(.{4})/g, '$1 ').toLowerCase();
    expect(base32Decode(spaced).equals(raw)).toBe(true);
    expect(() => base32Decode('not*valid')).toThrow();
  });

  it('accepts the current code and one step of clock drift, but not two', () => {
    const now = 1_700_000_000_000;
    const secret = generateTotpSecret();
    expect(verifyTotp(secret, generateTotp(secret, now), { nowMs: now })).not.toBeNull();
    expect(verifyTotp(secret, generateTotp(secret, now - 30_000), { nowMs: now })).not.toBeNull();
    expect(verifyTotp(secret, generateTotp(secret, now + 30_000), { nowMs: now })).not.toBeNull();
    expect(verifyTotp(secret, generateTotp(secret, now - 90_000), { nowMs: now })).toBeNull();
  });

  it('refuses a code whose step was already used (replay)', () => {
    const now = 1_700_000_000_000;
    const secret = generateTotpSecret();
    const code = generateTotp(secret, now);
    const step = verifyTotp(secret, code, { nowMs: now })!;
    expect(verifyTotp(secret, code, { nowMs: now, lastStep: step })).toBeNull();
    expect(verifyTotp(secret, generateTotp(secret, now + 30_000), { nowMs: now, lastStep: step })).not.toBeNull();
  });

  it('rejects malformed input', () => {
    const secret = generateTotpSecret();
    for (const bad of ['', '12345', '1234567', 'abcdef', '12 34 5x']) expect(verifyTotp(secret, bad)).toBeNull();
  });

  it('builds an otpauth URI authenticator apps understand', () => {
    const uri = otpauthUri({ issuer: 'K-Tech Admin', account: 'boss@ktech.ng', secret: 'ABCDEFGH' });
    expect(uri.startsWith('otpauth://totp/K-Tech%20Admin:boss%40ktech.ng?')).toBe(true);
    expect(uri).toContain('secret=ABCDEFGH');
    expect(uri).toContain('issuer=K-Tech+Admin');
  });
});
