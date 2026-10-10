-- Anonymous live chat for visitors who have not signed up.
ALTER TYPE "ChatOwnerType" ADD VALUE IF NOT EXISTS 'GUEST';

CREATE TABLE "ChatGuest" (
    "id" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "contact" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatGuest_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ChatGuest_tokenHash_key" ON "ChatGuest"("tokenHash");
CREATE INDEX "ChatGuest_lastSeenAt_idx" ON "ChatGuest"("lastSeenAt");
