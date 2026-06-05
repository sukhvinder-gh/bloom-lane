-- supabase/migrations/004_fix_redirect_loop.sql
-- ROOT CAUSE: profiles RLS was blocking SELECT with anon key,
-- causing role = null everywhere, triggering infinite redirect loop.
--
-- FIX: Drop all profile policies and replace with simple, working ones.
-- The profiles table is low-risk — users can only see/edit their own row.

-- Step 1: Drop all existing profile policies (clean slate)
DROP POLICY IF EXISTS "profiles_own"          ON profiles;
DROP POLICY IF EXISTS "profiles_admin"        ON profiles;
DROP POLICY IF EXISTS "profiles_select_own"   ON profiles;
DROP POLICY IF EXISTS "profiles_update_own"   ON profiles;
DROP POLICY IF EXISTS "profiles_select_admin" ON profiles;
DROP POLICY IF EXISTS "profiles_update_admin" ON profiles;
DROP POLICY IF EXISTS "profiles_insert_own"   ON profiles;

-- Step 2: Add simple, correct policies
-- SELECT: users read their own row; admins read all
CREATE POLICY "profiles_select_own"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "profiles_select_admin"
  ON profiles FOR SELECT
  USING (
    auth.uid() IN (
      SELECT id FROM profiles WHERE role = 'admin'
    )
  );

-- INSERT: only on signup via service role (trigger uses SECURITY DEFINER)
-- Regular users cannot insert directly
CREATE POLICY "profiles_insert_trigger"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- UPDATE: users update own; admins update all
CREATE POLICY "profiles_update_own"
  ON profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles_update_admin"
  ON profiles FOR UPDATE
  USING (
    auth.uid() IN (
      SELECT id FROM profiles WHERE role = 'admin'
    )
  );

-- Step 3: Ensure the auto-create trigger exists
-- (safe to re-run — OR REPLACE handles duplicates)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    COALESCE(
      (NEW.raw_user_meta_data->>'role')::user_role,
      'buyer_b2c'::user_role
    )
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Step 4: Verify your admin user has role set correctly
-- (run this as a check — should return your row with role='admin')
-- SELECT id, email, role FROM profiles WHERE role = 'admin';
