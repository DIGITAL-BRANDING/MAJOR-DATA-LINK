-- PENDING_REVIEW was committed by 20260905180000_add_partner_portal_auth.
-- It is safe to use as the default in this separate transaction.
-- Admin-provisioned partners continue to explicitly use ACTIVE in
-- src/scripts/create-partner.ts.
ALTER TABLE "Partner" ALTER COLUMN "status" SET DEFAULT 'PENDING_REVIEW';
