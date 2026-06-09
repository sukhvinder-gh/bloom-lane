-- Migration 008: Two-tier admin role hierarchy + product image support
-- Run manually in Supabase SQL Editor
--
-- IMPORTANT: PostgreSQL requires enum values to be committed before they can be
-- referenced in policies. Run this in TWO separate steps:
--
--   STEP 1 — paste and run only the lines between the "STEP 1" markers below.
--   STEP 2 — after step 1 succeeds, paste and run the "STEP 2" block.

-- ════════════════════════════════════════════════════════════════════
-- STEP 1: Add enum values  (run this first, on its own)
-- ════════════════════════════════════════════════════════════════════

ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'super_admin';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'platform_admin';

-- ════════════════════════════════════════════════════════════════════
-- STEP 2: Schema changes + RLS policies  (run AFTER step 1 commits)
-- ════════════════════════════════════════════════════════════════════

-- Product image support
-- image_url  : primary/first image (backward compat)
-- image_urls : array of all product images (up to 5)
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS image_urls TEXT[] DEFAULT '{}';

-- Extend products policy to accept all three admin roles
DROP POLICY IF EXISTS "products_admin" ON products;
CREATE POLICY "products_admin" ON products FOR ALL USING (
  EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid()
    AND p.role IN ('admin', 'super_admin', 'platform_admin')
  )
);

-- Config writes restricted to super_admin only
DROP POLICY IF EXISTS "config_admin_write" ON config;
CREATE POLICY "config_admin_write" ON config FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid()
    AND p.role IN ('admin', 'super_admin')
  )
);
