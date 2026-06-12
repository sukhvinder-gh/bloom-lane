-- Migration 014: Hubs, Subscriptions, Coordinator role, B2C support

-- ── Hubs (coordinator-registered groups) ────────────────────────────────────
CREATE TABLE IF NOT EXISTS hubs (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name             TEXT NOT NULL,
  region           TEXT,
  coordinator_id   UUID REFERENCES profiles(id) ON DELETE SET NULL,
  status           TEXT NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending', 'active', 'inactive')),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE hubs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "hubs_public_read" ON hubs;
DROP POLICY IF EXISTS "hubs_admin_all"   ON hubs;
CREATE POLICY "hubs_public_read"  ON hubs FOR SELECT USING (status = 'active');
CREATE POLICY "hubs_admin_all"    ON hubs FOR ALL    USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','platform_admin','super_admin'))
);

-- ── Subscriptions ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS subscriptions (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  subscriber_type        TEXT NOT NULL CHECK (subscriber_type IN ('grower','florist','coordinator')),
  plan                   TEXT NOT NULL CHECK (plan IN (
                           'hub_membership','wholesale_collection',
                           'mailing_list','personal_shopper','coordinator'
                         )),
  billing_period         TEXT CHECK (billing_period IN ('weekly','monthly','seasonal','annual','free')),
  status                 TEXT NOT NULL DEFAULT 'pending'
                         CHECK (status IN ('pending','active','expired','cancelled')),
  starts_at              TIMESTAMPTZ,
  expires_at             TIMESTAMPTZ,
  stripe_subscription_id TEXT,
  stripe_customer_id     TEXT,
  amount_cents           INTEGER,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, subscriber_type, plan)
);

-- Add unique constraint if it doesn't already exist (handles partial prior runs)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'subscriptions_user_id_subscriber_type_plan_key'
  ) THEN
    ALTER TABLE subscriptions ADD CONSTRAINT subscriptions_user_id_subscriber_type_plan_key
      UNIQUE (user_id, subscriber_type, plan);
  END IF;
END $$;

ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "subs_own"       ON subscriptions;
DROP POLICY IF EXISTS "subs_admin_all" ON subscriptions;
CREATE POLICY "subs_own"       ON subscriptions FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "subs_admin_all" ON subscriptions FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','platform_admin','super_admin'))
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_user   ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_expires ON subscriptions(expires_at) WHERE status = 'active';

-- ── Farmers: subscription + hub + RCTI columns ──────────────────────────────
ALTER TABLE farmers
  ADD COLUMN IF NOT EXISTS hub_id                UUID REFERENCES hubs(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS subscription_type     TEXT CHECK (subscription_type IN ('hub_membership','wholesale_collection')),
  ADD COLUMN IF NOT EXISTS subscription_tier     TEXT CHECK (subscription_tier IN ('monthly','seasonal','annual')),
  ADD COLUMN IF NOT EXISTS subscription_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS gst_registered        BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS rcti_agreed           BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS rcti_agreed_at        TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS rcti_full_name        TEXT,
  ADD COLUMN IF NOT EXISTS abn                   TEXT,
  ADD COLUMN IF NOT EXISTS farm_address          TEXT,
  ADD COLUMN IF NOT EXISTS farm_region           TEXT;

-- ── Profiles: coordinator role ───────────────────────────────────────────────
-- role column is an enum type; add missing values rather than a CHECK constraint
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'coordinator';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'platform_admin';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'super_admin';

-- ── Config: subscription pricing defaults ───────────────────────────────────
INSERT INTO config (key, value) VALUES
  ('hub_membership_monthly_cents',   '6000'),
  ('hub_membership_seasonal_cents',  '15000'),
  ('hub_membership_annual_cents',    '48000'),
  ('wholesale_commission_pct',       '0.15'),
  ('personal_shopper_weekly_cents',  '0'),
  ('personal_shopper_monthly_cents', '0'),
  ('personal_shopper_annual_cents',  '0'),
  ('coordinator_registration_cents', '0')
ON CONFLICT (key) DO NOTHING;
