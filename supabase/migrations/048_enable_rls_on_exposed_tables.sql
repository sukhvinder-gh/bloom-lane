-- Migration 048: CRITICAL — close a public-data exposure.
--
-- config, delivery_zones and listing_windows were created in the very first
-- migration (001_initial_schema.sql) but Row Level Security was never
-- enabled on any of the three — unlike every other table, which got
-- `ENABLE ROW LEVEL SECURITY` either in 001 or in the migration that created
-- it. With RLS off, all three tables are fully public: anyone holding the
-- project's anon key (NEXT_PUBLIC_SUPABASE_ANON_KEY, shipped in every page
-- load) can read, insert, update or delete rows directly via the Supabase
-- REST API, bypassing every app-level permission check entirely. Supabase's
-- own security scanner flagged this as "Table publicly accessible" on both
-- the dev and prod projects.
--
-- No new policies are added for delivery_zones or listing_windows, because
-- nothing in the app ever touches them through the anon/authenticated
-- client — every access goes through createAdminClient() (the service-role
-- key), which bypasses RLS regardless of whether it's enabled. Enabling RLS
-- with zero policies simply denies all anon/authenticated access, which is
-- exactly today's real access pattern — this closes the hole without
-- changing any app behavior.
--
-- config already has a dormant policy from migration 008
-- ("config_admin_write", UPDATE for admin/super_admin profiles) that has
-- never been enforced because RLS was off — enabling RLS here activates it
-- as originally intended. SELECT/INSERT/DELETE remain admin-only (service
-- role), same as the other two tables.

ALTER TABLE config          ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_zones  ENABLE ROW LEVEL SECURITY;
ALTER TABLE listing_windows ENABLE ROW LEVEL SECURITY;
