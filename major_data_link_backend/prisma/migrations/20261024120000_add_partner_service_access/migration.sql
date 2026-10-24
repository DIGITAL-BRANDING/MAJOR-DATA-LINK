CREATE TABLE "PartnerServiceAccess" (
    "id" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "service" TEXT NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PartnerServiceAccess_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PartnerServiceAccess_partnerId_service_key" ON "PartnerServiceAccess"("partnerId", "service");
CREATE INDEX "PartnerServiceAccess_service_idx" ON "PartnerServiceAccess"("service");

ALTER TABLE "PartnerServiceAccess" ADD CONSTRAINT "PartnerServiceAccess_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE CASCADE ON UPDATE CASCADE;
