ALTER TABLE "Partner"
    ADD COLUMN "contactName" TEXT,
    ADD COLUMN "companyRegistrationNumber" TEXT,
    ADD COLUMN "businessType" TEXT,
    ADD COLUMN "websiteUrl" TEXT,
    ADD COLUMN "useCase" TEXT,
    ADD COLUMN "expectedMonthlyVolume" INTEGER,
    ADD COLUMN "requestedServices" JSONB,
    ADD COLUMN "integrationEnvironment" TEXT,
    ADD COLUMN "technicalContactEmail" TEXT,
    ADD COLUMN "technicalContactPhone" TEXT,
    ADD COLUMN "enterpriseOfferCode" TEXT;

CREATE UNIQUE INDEX "Partner_enterpriseOfferCode_key"
    ON "Partner"("enterpriseOfferCode");
