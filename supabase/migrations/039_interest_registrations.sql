-- Migration 039: capture-interest sign-ups.
--
-- While public registration is paused for growers and buyers, /register-interest/grower
-- and /register-interest/buyer collect contact details here instead of creating a real
-- account, so there's a real, queryable list to work through when the platform opens up
-- rather than only whatever landed in an inbox.

CREATE TABLE IF NOT EXISTS interest_registrations (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role          TEXT NOT NULL CHECK (role IN ('grower', 'buyer')),
  full_name     TEXT NOT NULL,
  email         TEXT NOT NULL,
  phone         TEXT,
  business_name TEXT,
  region        TEXT,
  notes         TEXT,
  contacted     BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_interest_registrations_role ON interest_registrations(role, created_at DESC);

ALTER TABLE interest_registrations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "interest_admin_all" ON interest_registrations;
CREATE POLICY "interest_admin_all" ON interest_registrations FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','platform_admin','super_admin'))
);
-- No public SELECT/INSERT policy — all access goes through the admin-client API route.
