-- Preserve the exact finance reconciliation outcome for pending wallet
-- funding rows. PostgreSQL enum values are additive and existing rows remain
-- unchanged.
ALTER TYPE "TransactionStatus" ADD VALUE IF NOT EXISTS 'IGNORED';
ALTER TYPE "TransactionStatus" ADD VALUE IF NOT EXISTS 'DECLINED';
