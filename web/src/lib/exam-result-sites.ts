/**
 * Official result-checking portals we show inside the app after a customer
 * buys a token/PIN. The backend CSP (`frame-src`, major_data_link_backend/src/
 * config/csp.ts) must list the same hosts or the browser blocks the frame.
 * NABTEB has no portal configured, so it gets no "Check result" tab.
 */
export type CheckableExam = 'NECO' | 'WAEC';

export const EXAM_RESULT_SITES: Record<CheckableExam, { url: string; name: string; credentialLabel: string; credentialNoun: string }> = {
  NECO: { url: 'https://results.neco.gov.ng/', name: 'NECO result portal', credentialLabel: 'Token', credentialNoun: 'token' },
  WAEC: { url: 'https://www.waecdirect.org/', name: 'WAEC result checker', credentialLabel: 'PIN', credentialNoun: 'PIN' }
};

export const isCheckableExam = (exam: string): exam is CheckableExam => exam === 'NECO' || exam === 'WAEC';
