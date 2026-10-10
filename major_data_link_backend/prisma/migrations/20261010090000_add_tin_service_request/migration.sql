-- TIN Certificate requests (company / individual). Fulfilled manually by an
-- admin, so they are a separate transaction type from the other identity
-- services and can be filtered and reconciled on their own.
ALTER TYPE "TransactionType" ADD VALUE IF NOT EXISTS 'TIN_SERVICE_REQUEST';
