-- supabase/migrations/006_fix_farmers_rls.sql
-- Farmers table had RLS enabled but NO policies — blocked all reads/writes

-- Drop any accidental duplicates first
DROP POLICY IF EXISTS "farmers_select_own"    ON farmers;
DROP POLICY IF EXISTS "farmers_insert_own"    ON farmers;
DROP POLICY IF EXISTS "farmers_update_own"    ON farmers;
DROP POLICY IF EXISTS "farmers_select_public" ON farmers;
DROP POLICY IF EXISTS "farmers_admin"         ON farmers;

-- Farmers read their own record
CREATE POLICY "farmers_select_own"
  ON farmers FOR SELECT
  USING (user_id = auth.uid());

-- Public can see approved farmers (for marketplace display)
CREATE POLICY "farmers_select_public"
  ON farmers FOR SELECT
  USING (status = 'approved');

-- Farmers insert their own record (storefront create form)
CREATE POLICY "farmers_insert_own"
  ON farmers FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Farmers update their own record (storefront edit form)
CREATE POLICY "farmers_update_own"
  ON farmers FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Admins manage all farmers (admin uses service role key which bypasses RLS,
-- but this covers anon key admin reads in dashboard pages)
CREATE POLICY "farmers_admin"
  ON farmers FOR ALL
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );
