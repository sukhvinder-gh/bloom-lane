-- Migration 037: let a hub have several ordering windows, not just one.
--
-- market_windows is a JSON array of { day, open, close } objects, e.g.
--   [{"day":"monday","open":"08:00","close":"20:00"},
--    {"day":"thursday","open":"08:00","close":"12:00"}]
-- The original single-window columns (market_open_day/time, market_close_time)
-- are kept and still written from the first window, so anything that has not
-- moved to market_windows keeps working. An empty/NULL array means "no
-- schedule" -> the hub stays open at all times, same as before.

ALTER TABLE hubs
  ADD COLUMN IF NOT EXISTS market_windows JSONB;

-- Carry every hub's existing single window across as window #1.
UPDATE hubs
SET market_windows = jsonb_build_array(
      jsonb_build_object('day', market_open_day, 'open', market_open_time, 'close', market_close_time)
    )
WHERE market_windows IS NULL
  AND market_open_day IS NOT NULL
  AND market_open_time IS NOT NULL
  AND market_close_time IS NOT NULL;
