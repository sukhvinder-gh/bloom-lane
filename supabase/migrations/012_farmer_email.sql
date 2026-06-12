-- Migration 012: Add email to farmers table + populate from profiles
-- The farmers.email column is used for sending PO emails and display on the PO page.

ALTER TABLE farmers
  ADD COLUMN IF NOT EXISTS email TEXT;

-- Back-fill from auth profile (one-time; new farmers should set this on registration)
UPDATE farmers f
SET email = p.email
FROM profiles p
WHERE f.user_id = p.id
  AND f.email IS NULL;
