ALTER TABLE "Notification" ADD COLUMN IF NOT EXISTS "dedupeKey" TEXT;
ALTER TABLE "PartnerNotification" ADD COLUMN IF NOT EXISTS "dedupeKey" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "Notification_dedupeKey_key" ON "Notification"("dedupeKey");
CREATE UNIQUE INDEX IF NOT EXISTS "PartnerNotification_dedupeKey_key" ON "PartnerNotification"("dedupeKey");
