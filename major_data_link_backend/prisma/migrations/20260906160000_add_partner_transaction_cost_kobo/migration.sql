-- PartnerTransaction.costKobo was referenced in application code
-- (partner-reconciliation.service.ts, partner-verification.service.ts,
-- partner-wallet.service.ts) but no migration for it had ever been
-- committed, so `prisma generate` correctly reported it as missing. This
-- adds the actual column - see the field's doc-comment in schema.prisma.
ALTER TABLE "PartnerTransaction" ADD COLUMN "costKobo" BIGINT;
