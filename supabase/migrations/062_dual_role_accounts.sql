-- Migration 062: dual-role accounts (one email, grower + buyer)
--
-- profiles.role stays a single enum value — the account's primary/default
-- role, which decides where /dashboard sends them after login. This adds an
-- additive secondary_role for a second capability on the same account (e.g.
-- a buyer who also runs a storefront, or a grower who also places orders).
-- Grower is always treated as the primary role when both exist (product
-- decision: dual-role accounts default into the grower dashboard) — see
-- src/app/api/admin/interest/[id]/approve/route.ts.
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS secondary_role user_role;
