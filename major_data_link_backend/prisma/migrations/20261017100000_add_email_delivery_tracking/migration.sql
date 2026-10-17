-- Delivery tracking for admin email sends (see admin/email-composer.ts and the
-- email.* events handled by /api/webhooks/resend). One EmailBroadcast per
-- "Send an email" action, one EmailDelivery per recipient, keyed by the Resend
-- email id so delivery webhooks can update the right row.

CREATE TABLE IF NOT EXISTS "EmailBroadcast" (
    "id" TEXT NOT NULL,
    "createdByAdminId" TEXT NOT NULL,
    "audience" TEXT NOT NULL,
    "recipientMode" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "recipientCount" INTEGER NOT NULL DEFAULT 0,
    "acceptedCount" INTEGER NOT NULL DEFAULT 0,
    "failedCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailBroadcast_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "EmailBroadcast_createdAt_idx" ON "EmailBroadcast"("createdAt");

DO $$ BEGIN
  ALTER TABLE "EmailBroadcast" ADD CONSTRAINT "EmailBroadcast_createdByAdminId_fkey"
    FOREIGN KEY ("createdByAdminId") REFERENCES "AdminUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "EmailDelivery" (
    "id" TEXT NOT NULL,
    "broadcastId" TEXT NOT NULL,
    "resendEmailId" TEXT,
    "recipientEmail" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "errorMessage" TEXT,
    "lastEventAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailDelivery_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "EmailDelivery_resendEmailId_key" ON "EmailDelivery"("resendEmailId");
CREATE INDEX IF NOT EXISTS "EmailDelivery_broadcastId_status_idx" ON "EmailDelivery"("broadcastId", "status");

DO $$ BEGIN
  ALTER TABLE "EmailDelivery" ADD CONSTRAINT "EmailDelivery_broadcastId_fkey"
    FOREIGN KEY ("broadcastId") REFERENCES "EmailBroadcast"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
