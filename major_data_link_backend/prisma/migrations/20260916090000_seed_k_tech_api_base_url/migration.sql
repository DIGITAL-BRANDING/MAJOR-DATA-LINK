-- Give the singleton remote app configuration a safe, live starting value.
-- Do not overwrite a URL already chosen by a SUPER_ADMIN; a blank value is
-- normalized to NULL by the AdminJS resource and can safely receive this
-- production default.
-- `updatedAt` has no database default in the initial AppConfig migration.
-- PostgreSQL validates the attempted INSERT before it considers the conflict,
-- so it must be supplied even though the normal production path conflicts
-- with the already-existing singleton row.
INSERT INTO "AppConfig" ("id", "apiBaseUrl", "updatedAt")
VALUES ('default', 'https://k-tech.up.railway.app/api', CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE
SET "apiBaseUrl" = COALESCE("AppConfig"."apiBaseUrl", EXCLUDED."apiBaseUrl");
