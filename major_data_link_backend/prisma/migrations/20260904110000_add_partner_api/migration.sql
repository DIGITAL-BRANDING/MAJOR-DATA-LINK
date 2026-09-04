CREATE TYPE "PartnerStatus" AS ENUM ('ACTIVE', 'SUSPENDED');

CREATE TABLE "Partner" (
  "id" TEXT NOT NULL,
  "businessName" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "walletBalanceKobo" BIGINT NOT NULL DEFAULT 0,
  "status" "PartnerStatus" NOT NULL DEFAULT 'ACTIVE',
  "webhookUrl" TEXT,
  "webhookSecretHash" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Partner_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PartnerApiKey" (
  "id" TEXT NOT NULL,
  "partnerId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "keyPrefix" TEXT NOT NULL,
  "secretHash" TEXT NOT NULL,
  "lastUsedAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PartnerApiKey_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PartnerTransaction" (
  "id" TEXT NOT NULL,
  "partnerId" TEXT NOT NULL,
  "type" "TransactionType" NOT NULL,
  "status" "TransactionStatus" NOT NULL DEFAULT 'PENDING',
  "amountKobo" BIGINT NOT NULL,
  "balanceBeforeKobo" BIGINT NOT NULL,
  "balanceAfterKobo" BIGINT NOT NULL,
  "provider" TEXT,
  "providerRef" TEXT,
  "reference" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PartnerTransaction_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Partner_email_key" ON "Partner"("email");
CREATE UNIQUE INDEX "PartnerApiKey_secretHash_key" ON "PartnerApiKey"("secretHash");
CREATE INDEX "PartnerApiKey_partnerId_revokedAt_idx" ON "PartnerApiKey"("partnerId", "revokedAt");
CREATE INDEX "PartnerApiKey_keyPrefix_idx" ON "PartnerApiKey"("keyPrefix");
CREATE UNIQUE INDEX "PartnerTransaction_reference_key" ON "PartnerTransaction"("reference");
CREATE UNIQUE INDEX "PartnerTransaction_partnerId_idempotencyKey_key" ON "PartnerTransaction"("partnerId", "idempotencyKey");
CREATE INDEX "PartnerTransaction_partnerId_createdAt_idx" ON "PartnerTransaction"("partnerId", "createdAt");
CREATE INDEX "PartnerTransaction_partnerId_status_createdAt_idx" ON "PartnerTransaction"("partnerId", "status", "createdAt");

ALTER TABLE "PartnerApiKey" ADD CONSTRAINT "PartnerApiKey_partnerId_fkey"
  FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PartnerTransaction" ADD CONSTRAINT "PartnerTransaction_partnerId_fkey"
  FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
