-- Migration 008: Two-tier admin role hierarchy + product image support
-- Run manually in Supabase SQL Editor

-- ── New admin roles ──────────────────────────────────────────────────────────
-- super_admin  : full access (pricing, commission, all inventory, config)
-- platform_admin: manage growers/buyers, basic setup — no pricing/commission edit

ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'super_admin';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'platform_admin';

-- ── Product image support ────────────────────────────────────────────────────
-- image_url  : kept as the primary/first image (backward compat)
-- image_urls : array of all product images (up to 5)

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS image_urls TEXT[] DEFAULT '{}';

-- ── RLS: allow new admin roles the same access as 'admin' ────────────────────
-- The existing policies use EXISTS (SELECT 1 FROM profiles WHERE role = 'admin')
-- We extend them to also match super_admin and platform_admin.

-- Products: admins can update any product
DROP POLICY IF EXISTS "products_admin" ON products;
CREATE POLICY "products_admin" ON products FOR ALL USING (
  EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid()
    AND p.role IN ('admin', 'super_admin', 'platform_admin')
  )
);

-- Config: restrict writes to super_admin only (reads still open to all admins)
DROP POLICY IF EXISTS "config_admin_write" ON config;
CREATE POLICY "config_admin_write" ON config FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid()
    AND p.role IN ('admin', 'super_admin')
  )
);
