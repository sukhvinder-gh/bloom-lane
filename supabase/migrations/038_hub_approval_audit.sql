-- Migration 038: record who approved a hub, and when.
--
-- Plain snapshot columns rather than a foreign key + join -- the approver's
-- name at the time of approval, not a live lookup, so it still reads
-- correctly even if that admin account is later renamed or removed.

ALTER TABLE hubs
  ADD COLUMN IF NOT EXISTS approved_by_name TEXT,
  ADD COLUMN IF NOT EXISTS approved_at      TIMESTAMPTZ;
