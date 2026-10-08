import helmet from 'helmet';

/**
 * Official result-checking sites the customer app may show inside an iframe,
 * so a customer who has just bought a NECO token / WAEC PIN can check the
 * result without leaving the app (see web ExamResultChecker). Any other origin
 * stays blocked by `frame-src`.
 *
 * Both the bare and www hosts are listed because these sites redirect between
 * them and a CSP applies to every hop of a frame navigation. The sites'
 * OWN framing policy (X-Frame-Options / frame-ancestors) is outside our
 * control; the web component falls back to "open in a new tab" if they refuse.
 */
export const EXAM_RESULT_FRAME_SOURCES = [
  'https://results.neco.gov.ng',
  'https://neco.gov.ng',
  'https://*.neco.gov.ng',
  'https://www.waecdirect.org',
  'https://waecdirect.org',
  'https://*.waecdirect.org'
] as const;

/** CSP for the customer web app (everything outside /admin). */
export function customerAppCspDirectives(inlineScriptHashes: string[]) {
  return {
    ...helmet.contentSecurityPolicy.getDefaultDirectives(),
    'script-src': ["'self'", 'data:', ...inlineScriptHashes],
    'connect-src': ["'self'"],
    // PDFs are fetched with the user's Authorization header and shown from a
    // short-lived blob URL (same-origin app frame), plus the official exam
    // result sites above.
    'frame-src': ["'self'", 'blob:', ...EXAM_RESULT_FRAME_SOURCES]
  };
}
