-- New partner-portal self-registration status. Existing partners (all
-- created via create-partner.ts, i.e. already vetted) keep their current
-- ACTIVE/SUSPENDED status untouched - this only affects the column's
-- default for rows created from here on.
ALTER TYPE "PartnerStatus" ADD VALUE 'PENDING_REVIEW';

ALTER TABLE "Partner"
  ADD COLUMN "passwordHash" TEXT,
  ADD COLUMN "passwordFailures" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "passwordFailureAt" TIMESTAMP(3),
  ADD COLUMN "passwordLockedUntil" TIMESTAMP(3);

-- Deliberately do NOT use PENDING_REVIEW as a column default in this
-- migration. PostgreSQL makes a newly-added enum value unavailable until the
-- transaction containing ALTER TYPE has committed. Prisma runs each migration
-- in a transaction, so using it here causes "unsafe use of new value" and
-- leaves a failed migration record (P3009). The default is installed by the
-- immediately following migration, after this transaction has committed.

CREATE TABLE "PartnerRefreshToken" (
  "id"        TEXT NOT NULL,
  "partnerId" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PartnerRefreshToken_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PartnerRefreshToken_tokenHash_key" ON "PartnerRefreshToken"("tokenHash");
CREATE INDEX "PartnerRefreshToken_partnerId_idx" ON "PartnerRefreshToken"("partnerId");

ALTER TABLE "PartnerRefreshToken" ADD CONSTRAINT "PartnerRefreshToken_partnerId_fkey"
  FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE CASCADE ON UPDATE CASCADE;
