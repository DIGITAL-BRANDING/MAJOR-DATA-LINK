-- Partner ZenithPay activation: the business owner's BVN is submitted once to
-- issue the partner's dedicated account (see services/partner-funding.service.ts).
-- Only the last 4 digits are kept, same as User.bvnLast4.

ALTER TABLE "Partner" ADD COLUMN IF NOT EXISTS "bvnLast4" TEXT;
ALTER TABLE "Partner" ADD COLUMN IF NOT EXISTS "bvnVerifiedAt" TIMESTAMP(3);
