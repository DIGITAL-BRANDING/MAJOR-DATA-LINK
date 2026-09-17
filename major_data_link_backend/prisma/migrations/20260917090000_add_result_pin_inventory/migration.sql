CREATE TABLE "ResultPinInventory" (
  "id" TEXT NOT NULL,
  "examType" TEXT NOT NULL,
  "pinEncrypted" TEXT NOT NULL,
  "serialEncrypted" TEXT,
  "purchaseCostKobo" BIGINT NOT NULL,
  "sourceReference" TEXT,
  "status" TEXT NOT NULL DEFAULT 'AVAILABLE',
  "soldToUserId" TEXT,
  "transactionId" TEXT,
  "addedByAdminId" TEXT,
  "soldAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ResultPinInventory_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ResultPinInventory_transactionId_key" ON "ResultPinInventory"("transactionId");
CREATE INDEX "ResultPinInventory_examType_status_createdAt_idx" ON "ResultPinInventory"("examType", "status", "createdAt");
CREATE INDEX "ResultPinInventory_soldToUserId_createdAt_idx" ON "ResultPinInventory"("soldToUserId", "createdAt");

UPDATE "ServicePricing" SET "provider" = 'inventory'
WHERE "service" IN ('WAEC_PIN', 'NECO_PIN', 'NABTEB_PIN');

UPDATE "PricingSettings" SET "resultPinProvider" = 'inventory'
WHERE "id" = 'default';
