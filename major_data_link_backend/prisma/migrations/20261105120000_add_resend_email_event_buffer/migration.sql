CREATE TABLE IF NOT EXISTS "ResendEmailDeliveryEvent" (
    "id" TEXT NOT NULL,
    "resendEmailId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ResendEmailDeliveryEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ResendEmailDeliveryEvent_resendEmailId_occurredAt_idx"
    ON "ResendEmailDeliveryEvent"("resendEmailId", "occurredAt");
