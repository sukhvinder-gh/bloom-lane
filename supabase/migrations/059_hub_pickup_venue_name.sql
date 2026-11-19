-- Optional building/shop name line shown above the street address, e.g.
-- "Community Hall" or "Macedon Ranges Farmers Market" — the address alone
-- is often not enough to find a pickup spot on a shared site.
ALTER TABLE hubs
  ADD COLUMN IF NOT EXISTS pickup_venue_name TEXT;
