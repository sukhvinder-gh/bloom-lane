-- supabase/migrations/007_grower_profiles.sql
-- Adds public-facing grower profile fields to support the grower directory

ALTER TABLE farmers
  ADD COLUMN IF NOT EXISTS region               TEXT,
  ADD COLUMN IF NOT EXISTS growing_practices    TEXT,
  ADD COLUMN IF NOT EXISTS seasonal_specialties TEXT[]   DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS sustainability       TEXT[]   DEFAULT '{}';

COMMENT ON COLUMN farmers.region               IS 'e.g. Yarra Valley, Mornington Peninsula';
COMMENT ON COLUMN farmers.growing_practices    IS 'Freeform description of how the farm grows';
COMMENT ON COLUMN farmers.seasonal_specialties IS 'Array of seasonal / specialty offerings';
COMMENT ON COLUMN farmers.sustainability       IS 'Array of sustainability practices e.g. organic, spray-free';
