-- supabase/migrations/005_fix_rls_circular_dependency.sql
-- ROOT CAUSE OF LOOP:
-- The "profiles_select_admin" policy did:
--   USING (auth.uid() IN (SELECT id FROM profiles WHERE role = 'admin'))
-- This is a CIRCULAR QUERY — reading profiles to check if you can read profiles.
-- Postgres evaluates this recursively and returns NULL/empty, so role always = null.
--
-- FIX: Drop the circular admin policy. Users only need to read THEIR OWN profile.
-- Admins use the service role key (bypasses RLS) for admin operations — not the anon key.

-- Drop ALL existing profile policies (clean slate)
DROP POLICY IF EXISTS "profiles_own"             ON profiles;
DROP POLICY IF EXISTS "profiles_admin"           ON profiles;
DROP POLICY IF EXISTS "profiles_select_own"      ON profiles;
DROP POLICY IF EXISTS "profiles_select_admin"    ON profiles;  -- THE CIRCULAR ONE
DROP POLICY IF EXISTS "profiles_update_own"      ON profiles;
DROP POLICY IF EXISTS "profiles_update_admin"    ON profiles;
DROP POLICY IF EXISTS "profiles_insert_own"      ON profiles;
DROP POLICY IF EXISTS "profiles_insert_trigger"  ON profiles;

-- Simple, non-circular policies:

-- 1. Every authenticated user can read their own profile row
CREATE POLICY "profiles_read_own"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

-- 2. Every authenticated user can update their own profile
CREATE POLICY "profiles_update_own"
  ON profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- 3. Allow insert for new signups (trigger uses SECURITY DEFINER, bypasses RLS anyway)
CREATE POLICY "profiles_insert_own"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- NOTE: Admins read ALL profiles via createAdminClient() which uses the SERVICE ROLE KEY.
-- Service role bypasses RLS entirely — no admin SELECT policy needed or safe to add.
-- Never use the anon key for admin operations.

-- Verify your admin row is still correct:
-- SELECT id, email, role FROM profiles WHERE role = 'admin';
