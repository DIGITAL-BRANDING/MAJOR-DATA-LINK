CREATE TYPE "PartnerWebhookDeliveryStatus" AS ENUM ('PENDING', 'PROCESSING', 'DELIVERED', 'FAILED');

ALTER TABLE "Partner" ADD COLUMN "webhookSecretEncrypted" JSONB;

CREATE TABLE "PartnerWebhookDelivery" (
  "id" TEXT NOT NULL,
  "partnerId" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "eventKey" TEXT NOT NULL,
  "event" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "signingSecret" JSONB NOT NULL,
  "status" "PartnerWebhookDeliveryStatus" NOT NULL DEFAULT 'PENDING',
  "attemptCount" INTEGER NOT NULL DEFAULT 0,
  "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lockedAt" TIMESTAMP(3),
  "deliveredAt" TIMESTAMP(3),
  "lastAttemptAt" TIMESTAMP(3),
  "lastResponseStatus" INTEGER,
  "lastError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PartnerWebhookDelivery_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PartnerWebhookDelivery_eventId_key" ON "PartnerWebhookDelivery"("eventId");
CREATE UNIQUE INDEX "PartnerWebhookDelivery_partnerId_eventKey_key" ON "PartnerWebhookDelivery"("partnerId", "eventKey");
CREATE INDEX "PartnerWebhookDelivery_status_nextAttemptAt_idx" ON "PartnerWebhookDelivery"("status", "nextAttemptAt");
CREATE INDEX "PartnerWebhookDelivery_partnerId_createdAt_idx" ON "PartnerWebhookDelivery"("partnerId", "createdAt");

ALTER TABLE "PartnerWebhookDelivery" ADD CONSTRAINT "PartnerWebhookDelivery_partnerId_fkey"
  FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE CASCADE ON UPDATE CASCADE;
