-- Migration 032: Per-hub market window + farmer pickup/delivery config
--
-- "Market open time should be removed as a global setting — it will not be
-- the same for all growers or hubs. It should be configured at hub or farm
-- level." isMarketOpen()/isListingWindowOpen() in timezone.ts are currently
-- hardcoded to always return true; the config table's market_open/close
-- values are documented as display-only and drive nothing. This adds real
-- scoped schedule storage — the app-layer rewrite of isMarketOpen() reads
-- from this.
--
-- Confirmed with stakeholder: a cart spanning growers with different open
-- windows blocks the whole checkout if ANY grower in it is currently
-- closed (not partial/per-item checkout).

ALTER TABLE hubs
  ADD COLUMN IF NOT EXISTS market_open_day    TEXT CHECK (market_open_day IN ('monday','tuesday','wednesday','thursday','friday','saturday','sunday')),
  ADD COLUMN IF NOT EXISTS market_open_time   TEXT, -- 'HH:MM', matches existing delivery_zones.hub_collection_time_start convention
  ADD COLUMN IF NOT EXISTS market_close_time  TEXT;

-- Farm-level override — null on all three means "use the hub's schedule."
ALTER TABLE farmers
  ADD COLUMN IF NOT EXISTS market_open_day_override    TEXT CHECK (market_open_day_override IN ('monday','tuesday','wednesday','thursday','friday','saturday','sunday')),
  ADD COLUMN IF NOT EXISTS market_open_time_override    TEXT,
  ADD COLUMN IF NOT EXISTS market_close_time_override   TEXT;

-- Pickup/delivery config: "days, times, costs, delivery distance, and
-- related rules." A farm can offer more than one option (e.g. Wednesday
-- farm pickup free + delivery within 20km for $15), hence a table rather
-- than flat columns on farmers.
CREATE TABLE IF NOT EXISTS farmer_fulfillment_options (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farmer_id       UUID NOT NULL REFERENCES farmers(id) ON DELETE CASCADE,
  type            TEXT NOT NULL CHECK (type IN ('pickup', 'delivery')),
  day_of_week     TEXT CHECK (day_of_week IN ('monday','tuesday','wednesday','thursday','friday','saturday','sunday')),
  start_time      TEXT, -- 'HH:MM'
  end_time        TEXT,
  cost_cents      INTEGER NOT NULL DEFAULT 0,
  max_distance_km INTEGER, -- delivery only; null for pickup
  notes           TEXT,    -- free-text rules, e.g. "48 hours notice required"
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE farmer_fulfillment_options ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "fulfillment_options_public_read" ON farmer_fulfillment_options;
DROP POLICY IF EXISTS "fulfillment_options_owner_all"    ON farmer_fulfillment_options;
CREATE POLICY "fulfillment_options_public_read" ON farmer_fulfillment_options FOR SELECT USING (true);
CREATE POLICY "fulfillment_options_owner_all" ON farmer_fulfillment_options FOR ALL USING (
  EXISTS (SELECT 1 FROM farmers WHERE farmers.id = farmer_fulfillment_options.farmer_id AND farmers.user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'platform_admin', 'super_admin'))
);

CREATE INDEX IF NOT EXISTS idx_fulfillment_options_farmer ON farmer_fulfillment_options(farmer_id);
