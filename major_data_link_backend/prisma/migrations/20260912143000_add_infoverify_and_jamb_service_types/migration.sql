-- Import transaction categories that existed in InfoVerify without removing
-- Major Data Link's partner/API schema.  PostgreSQL enum additions are
-- idempotent, making this safe for a database that was partially upgraded.
ALTER TYPE "TransactionType" ADD VALUE IF NOT EXISTS 'CAC_SERVICE_REQUEST';
ALTER TYPE "TransactionType" ADD VALUE IF NOT EXISTS 'BVN_MODIFICATION';
ALTER TYPE "TransactionType" ADD VALUE IF NOT EXISTS 'BIRTH_ATTESTATION';
ALTER TYPE "TransactionType" ADD VALUE IF NOT EXISTS 'NEWSPAPER_PUBLICATION';
ALTER TYPE "TransactionType" ADD VALUE IF NOT EXISTS 'BVN_CRM';
ALTER TYPE "TransactionType" ADD VALUE IF NOT EXISTS 'JAMB_SERVICE_REQUEST';

-- Delivery records can now carry protected inline data, as in InfoVerify.
-- Existing files continue to use filePath until explicitly migrated.
ALTER TABLE "UserDelivery" ADD COLUMN IF NOT EXISTS "inlineData" JSONB;
