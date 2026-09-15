-- Last successful customer sign-in and its reporting channel. These fields
-- intentionally do not store IP addresses, user agents, or device IDs.
CREATE TYPE "CustomerLoginChannel" AS ENUM ('MOBILE_APP', 'WEB', 'UNKNOWN');

ALTER TABLE "User"
  ADD COLUMN "lastLoginAt" TIMESTAMP(3),
  ADD COLUMN "lastLoginChannel" "CustomerLoginChannel";

ALTER TABLE "Partner"
  ADD COLUMN "lastPortalLoginAt" TIMESTAMP(3);

CREATE INDEX "User_lastLoginAt_idx" ON "User"("lastLoginAt");
CREATE INDEX "Partner_lastPortalLoginAt_idx" ON "Partner"("lastPortalLoginAt");
