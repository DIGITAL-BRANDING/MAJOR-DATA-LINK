-- IPE clearance stays in the admin queue unless an admin explicitly routes
-- the service to Techhub in the NIN/BVN Provider settings.
UPDATE "ServicePricing"
SET "provider" = 'manual'
WHERE "service" = 'IPE_CLEARANCE';
