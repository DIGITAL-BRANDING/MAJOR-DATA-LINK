-- Two-way Resend Contacts/Audience sync (see src/lib/resend-contacts.ts and
-- the /api/webhooks/resend handler in src/routes/webhook.routes.ts):
--   - resendContactId remembers the Resend contact id once a User/Partner has
--     been pushed to the matching audience, so later syncs UPDATE instead of
--     creating a duplicate contact.
--   - emailSubscribed mirrors Resend's own `unsubscribed` flag, updated by
--     the inbound webhook whenever someone unsubscribes on Resend's side.
--     Only the admin bulk email tool (admin/email-composer.ts) respects it;
--     transactional mail is unaffected.

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "resendContactId" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "emailSubscribed" BOOLEAN NOT NULL DEFAULT true;

DO $$ BEGIN
  ALTER TABLE "User" ADD CONSTRAINT "User_resendContactId_key" UNIQUE ("resendContactId");
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

ALTER TABLE "Partner" ADD COLUMN IF NOT EXISTS "resendContactId" TEXT;
ALTER TABLE "Partner" ADD COLUMN IF NOT EXISTS "emailSubscribed" BOOLEAN NOT NULL DEFAULT true;

DO $$ BEGIN
  ALTER TABLE "Partner" ADD CONSTRAINT "Partner_resendContactId_key" UNIQUE ("resendContactId");
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
