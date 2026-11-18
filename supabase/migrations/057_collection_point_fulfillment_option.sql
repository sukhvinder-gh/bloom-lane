-- Migration 057: let a grower's fulfilment option point at a hub's
-- collection point, as a third option alongside farm pickup/delivery.
--
-- The hub's own pickup_windows (migration 056) is the single source of
-- truth for the schedule -- day_of_week/start_time/end_time stay null on
-- this row, since the coordinator owns the schedule, not each grower.
ALTER TABLE farmer_fulfillment_options
  DROP CONSTRAINT IF EXISTS farmer_fulfillment_options_type_check;
ALTER TABLE farmer_fulfillment_options
  ADD CONSTRAINT farmer_fulfillment_options_type_check
  CHECK (type IN ('pickup', 'delivery', 'collection_point'));
ALTER TABLE farmer_fulfillment_options
  ADD COLUMN IF NOT EXISTS hub_id UUID REFERENCES hubs(id) ON DELETE SET NULL;

-- Mirrors farm_pickup_farmer_ids (024) -- the buyer's per-farmer choice,
-- snapshotted onto the order until purchase_orders rows exist at payment
-- finalization, when each gets its own pickup_method.
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS collection_point_farmer_ids UUID[] NOT NULL DEFAULT '{}';

ALTER TABLE purchase_orders
  DROP CONSTRAINT IF EXISTS purchase_orders_pickup_method_check;
ALTER TABLE purchase_orders
  ADD CONSTRAINT purchase_orders_pickup_method_check
  CHECK (pickup_method IN ('standard', 'farm_pickup', 'collection_point'));
