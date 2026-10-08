import { describe, expect, it } from 'vitest';
import { EXAM_RESULT_FRAME_SOURCES, customerAppCspDirectives } from '../csp.js';

describe('customer app CSP', () => {
  const directives = customerAppCspDirectives(["'sha256-abc'"]);

  it('lets the app frame the official NECO and WAEC result sites', () => {
    const frameSrc = directives['frame-src'];
    for (const origin of ['https://results.neco.gov.ng', 'https://www.waecdirect.org']) {
      expect(frameSrc).toContain(origin);
    }
    // Both hosts redirect between bare and www, and CSP applies to every redirect hop.
    expect(frameSrc).toEqual(expect.arrayContaining(['https://neco.gov.ng', 'https://waecdirect.org']));
  });

  it('keeps the existing same-origin and blob: frames (PDF previews)', () => {
    expect(directives['frame-src']).toEqual(expect.arrayContaining(["'self'", 'blob:']));
  });

  it('only ever allows https origins, never a bare wildcard or http', () => {
    expect(EXAM_RESULT_FRAME_SOURCES.every((origin) => origin.startsWith('https://'))).toBe(true);
    expect(directives['frame-src']).not.toContain('*');
    expect(directives['frame-src']).not.toContain('https:');
  });

  it('is unchanged otherwise: scripts stay hash-locked and network access stays same-origin', () => {
    expect(directives['script-src']).toEqual(["'self'", 'data:', "'sha256-abc'"]);
    expect(directives['connect-src']).toEqual(["'self'"]);
  });
});
