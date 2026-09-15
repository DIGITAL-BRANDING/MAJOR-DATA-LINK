-- Give the singleton remote app configuration a safe, live starting value.
-- Do not overwrite a URL already chosen by a SUPER_ADMIN; a blank value is
-- normalized to NULL by the AdminJS resource and can safely receive this
-- production default.
INSERT INTO "AppConfig" ("id", "apiBaseUrl")
VALUES ('default', 'https://k-tech.up.railway.app/api')
ON CONFLICT ("id") DO UPDATE
SET "apiBaseUrl" = COALESCE("AppConfig"."apiBaseUrl", EXCLUDED."apiBaseUrl");
