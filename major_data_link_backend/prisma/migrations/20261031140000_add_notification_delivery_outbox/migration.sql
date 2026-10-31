CREATE TABLE IF NOT EXISTS "NotificationDelivery" (
  "id" TEXT NOT NULL,
  "notificationId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "attemptCount" INTEGER NOT NULL DEFAULT 0,
  "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastAttemptAt" TIMESTAMP(3),
  "lastError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "NotificationDelivery_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "NotificationDelivery_notificationId_fkey" FOREIGN KEY ("notificationId") REFERENCES "Notification"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "NotificationDelivery_notificationId_key" ON "NotificationDelivery"("notificationId");
CREATE INDEX IF NOT EXISTS "NotificationDelivery_status_nextAttemptAt_idx" ON "NotificationDelivery"("status", "nextAttemptAt");
