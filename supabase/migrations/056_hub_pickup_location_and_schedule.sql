-- Migration 056: physical pickup location + schedule for hubs
--
-- `market_windows` (added in 032/037) is the buyer-ordering cutoff window
-- ("Ordering Windows" in the admin UI) -- when buyers can place orders
-- targeting this hub's growers. It is NOT when buyers/growers physically
-- meet. Collection Point needs that second, separate concept: a real
-- address, and a weekly schedule the hub's coordinator owns and every
-- grower who picks this hub as their collection point inherits.
ALTER TABLE hubs
  ADD COLUMN IF NOT EXISTS pickup_address  TEXT,
  ADD COLUMN IF NOT EXISTS pickup_suburb   TEXT,
  ADD COLUMN IF NOT EXISTS pickup_state    TEXT,
  ADD COLUMN IF NOT EXISTS pickup_postcode TEXT,
  ADD COLUMN IF NOT EXISTS pickup_windows  JSONB NOT NULL DEFAULT '[]'::jsonb;
