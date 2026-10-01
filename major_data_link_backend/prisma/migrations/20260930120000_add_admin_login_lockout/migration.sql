-- AlterTable
ALTER TABLE "AdminUser" ADD COLUMN "failedLoginCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "failedLoginAt" TIMESTAMP(3),
ADD COLUMN "lockedUntil" TIMESTAMP(3);
