-- Migration 042: let a grower's ordering-window override have several
-- windows, not just one — same shape/rollout as migration 037 did for hubs.
--
-- market_windows_override is a JSON array of { day, open, close } objects.
-- The original single-window override columns (market_open_day_override,
-- market_open_time_override, market_close_time_override) are kept and still
-- read as a fallback by application code, so nothing that hasn't moved to
-- market_windows_override breaks. An empty/NULL array means "no override" ->
-- the farm falls through to its hub's schedule, same as before.

ALTER TABLE farmers
  ADD COLUMN IF NOT EXISTS market_windows_override JSONB;

-- Carry every farmer's existing single override window across as window #1.
UPDATE farmers
SET market_windows_override = jsonb_build_array(
      jsonb_build_object('day', market_open_day_override, 'open', market_open_time_override, 'close', market_close_time_override)
    )
WHERE market_windows_override IS NULL
  AND market_open_day_override IS NOT NULL
  AND market_open_time_override IS NOT NULL
  AND market_close_time_override IS NOT NULL;
