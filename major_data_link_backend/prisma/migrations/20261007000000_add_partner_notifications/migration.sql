-- Partner-portal equivalent of the existing Notification/NotificationBroadcast
-- tables (see 20260729120000_add_notifications and
-- 20260819100000_add_notification_popup_illustration) - lets an admin send a
-- message to partners (the partner-portal companies), with each partner
-- getting their own independent PartnerNotification row and isRead state,
-- fanned out from a PartnerNotificationBroadcast the same way the user-facing
-- feature works. No push/device-token table: the partner portal is
-- browser-only, so this is in-app (bell + popup) only.

DO $$ BEGIN
  CREATE TYPE "PartnerNotificationAudience" AS ENUM ('ALL_PARTNERS', 'ACTIVE_PARTNERS_ONLY', 'SPECIFIC_PARTNERS');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "PartnerNotificationBroadcast" (
    "id" TEXT NOT NULL,
    "createdByAdminId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL DEFAULT 'ADMIN_BROADCAST',
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "audience" "PartnerNotificationAudience" NOT NULL DEFAULT 'ALL_PARTNERS',
    "targetPartnerIds" JSONB,
    "imageKey" TEXT,
    "showAsPopup" BOOLEAN NOT NULL DEFAULT false,
    "recipientCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PartnerNotificationBroadcast_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "PartnerNotificationBroadcast_createdByAdminId_createdAt_idx" ON "PartnerNotificationBroadcast"("createdByAdminId", "createdAt");

DO $$ BEGIN
  ALTER TABLE "PartnerNotificationBroadcast" ADD CONSTRAINT "PartnerNotificationBroadcast_createdByAdminId_fkey"
    FOREIGN KEY ("createdByAdminId") REFERENCES "AdminUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "PartnerNotification" (
    "id" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL DEFAULT 'SYSTEM',
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "data" JSONB,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "readAt" TIMESTAMP(3),
    "broadcastId" TEXT,
    "imageKey" TEXT,
    "showAsPopup" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PartnerNotification_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "PartnerNotification_partnerId_createdAt_idx" ON "PartnerNotification"("partnerId", "createdAt");
CREATE INDEX IF NOT EXISTS "PartnerNotification_partnerId_isRead_idx" ON "PartnerNotification"("partnerId", "isRead");

DO $$ BEGIN
  ALTER TABLE "PartnerNotification" ADD CONSTRAINT "PartnerNotification_partnerId_fkey"
    FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "PartnerNotification" ADD CONSTRAINT "PartnerNotification_broadcastId_fkey"
    FOREIGN KEY ("broadcastId") REFERENCES "PartnerNotificationBroadcast"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
