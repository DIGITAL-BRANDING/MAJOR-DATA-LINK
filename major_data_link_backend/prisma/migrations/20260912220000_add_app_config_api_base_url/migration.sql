-- Lets an admin repoint every installed Flutter app at a new backend origin
-- (Railway migration, failover, custom domain cutover) without a new Play
-- Store release. NULL keeps the client on its compiled-in baseUrl - see
-- AppConfig.baseUrl in the Flutter app and getAppConfig() server-side.
ALTER TABLE "AppConfig" ADD COLUMN "apiBaseUrl" TEXT;
