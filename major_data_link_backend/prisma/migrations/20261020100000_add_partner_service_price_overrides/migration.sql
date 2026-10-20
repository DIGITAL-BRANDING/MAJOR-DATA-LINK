CREATE TABLE "PartnerServicePrice" (
    "id" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "service" TEXT NOT NULL,
    "priceKobo" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PartnerServicePrice_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PartnerServicePrice_partnerId_service_key"
    ON "PartnerServicePrice"("partnerId", "service");

CREATE INDEX "PartnerServicePrice_service_idx"
    ON "PartnerServicePrice"("service");

ALTER TABLE "PartnerServicePrice"
    ADD CONSTRAINT "PartnerServicePrice_partnerId_fkey"
    FOREIGN KEY ("partnerId") REFERENCES "Partner"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
