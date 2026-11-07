-- Migration 051: track interest-registration -> real-account conversion.
--
-- The admin "Register Interest" list had no way to go from a submitted
-- grower/buyer interest row to an actual account other than a manual SQL
-- insert (see the "Approving a Grower Interest Registration" admin guide).
-- These columns let /api/admin/interest/[id]/approve record which user
-- account a row turned into, so the UI can show "Approved" instead of
-- re-creating a duplicate account on a second click.

ALTER TABLE interest_registrations
  ADD COLUMN IF NOT EXISTS converted_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS converted_at TIMESTAMPTZ;
