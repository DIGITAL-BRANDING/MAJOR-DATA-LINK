ALTER TABLE "Partner"
  ADD COLUMN "phone" TEXT,
  ADD COLUMN "virtualAccountNumber" TEXT,
  ADD COLUMN "virtualAccountBank" TEXT,
  ADD COLUMN "virtualAccountProvider" TEXT,
  ADD COLUMN "paystackCustomerCode" TEXT;

CREATE UNIQUE INDEX "Partner_virtualAccountNumber_key" ON "Partner"("virtualAccountNumber");
CREATE UNIQUE INDEX "Partner_paystackCustomerCode_key" ON "Partner"("paystackCustomerCode");
