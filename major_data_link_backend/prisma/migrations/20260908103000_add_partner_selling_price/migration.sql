-- Lets an admin charge API Partners a different price than retail web/app
-- users for the same ServicePricing row (NIN/BVN verification, WAEC/NECO/
-- NABTEB result pins). Null means "fall back to sellingPriceKobo" - see
-- getVerificationPrice(service, { forPartner: true }) in
-- verification.service.ts.
ALTER TABLE "ServicePricing" ADD COLUMN "partnerSellingPriceKobo" BIGINT;
