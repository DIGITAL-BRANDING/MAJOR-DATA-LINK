import { Router } from 'express';
import { getResultPinPrice, type ExamPinType } from '../services/result-pin.service.js';

export const publicRoutes = Router();

const RESULT_EXAM_TYPES: ExamPinType[] = ['WAEC', 'NECO', 'NABTEB'];

/**
 * Deliberately NOT behind requireAuth — this exists so the marketing
 * landing page (web/src/pages/LandingPage.tsx) can show real, current
 * result-checker prices to visitors who haven't signed up yet. Reuses
 * getResultPinPrice() (the same function the authenticated
 * /api/result/:exam/price route uses), which already returns only
 * { service, label, unitPrice } — never providerCost/margin, so this
 * cannot leak anything sensitive. Checked individually (not via
 * listResultPinPrices()'s Promise.all) so that one exam type being
 * toggled off in the admin Service Pricing panel just omits that one
 * card instead of blanking the whole section for a visitor.
 */
publicRoutes.get('/result-prices', async (_req, res) => {
  const results = await Promise.allSettled(RESULT_EXAM_TYPES.map((exam) => getResultPinPrice(exam)));
  const prices = results
    .filter((r) => r.status === 'fulfilled')
    .map((r) => (r as PromiseFulfilledResult<Awaited<ReturnType<typeof getResultPinPrice>>>).value)
    .map((p) => ({ service: p.service, label: p.label, unit_price: p.unitPrice }));

  res.json({ status: true, data: prices });
});
