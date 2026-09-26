CREATE TABLE "PartnerRequestUpdate" (
    "id" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "partnerTransactionId" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PartnerRequestUpdate_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PartnerRequestUpdate_partnerTransactionId_createdAt_idx"
ON "PartnerRequestUpdate"("partnerTransactionId", "createdAt");

CREATE INDEX "PartnerRequestUpdate_partnerId_createdAt_idx"
ON "PartnerRequestUpdate"("partnerId", "createdAt");

ALTER TABLE "PartnerRequestUpdate"
ADD CONSTRAINT "PartnerRequestUpdate_partnerId_fkey"
FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PartnerRequestUpdate"
ADD CONSTRAINT "PartnerRequestUpdate_partnerTransactionId_fkey"
FOREIGN KEY ("partnerTransactionId") REFERENCES "PartnerTransaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;
