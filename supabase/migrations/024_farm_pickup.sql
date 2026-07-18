-- Migration 024: Per-grower farm pickup
--
-- Fulfillment stays a single order-level choice (hub_pickup / direct_delivery)
-- for whichever growers don't offer farm pickup or weren't opted into it —
-- one hub trip or one delivery address per buyer, same as today. Farm pickup
-- is an opt-out-to-a-different-collection-point on top of that, per grower:
-- a buyer can pull specific growers' items out of the pooled hub/delivery
-- leg and collect them directly from that farm instead.

ALTER TABLE farmers
  ADD COLUMN IF NOT EXISTS offers_farm_pickup BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE purchase_orders
  ADD COLUMN IF NOT EXISTS pickup_method TEXT NOT NULL DEFAULT 'standard'
    CHECK (pickup_method IN ('standard', 'farm_pickup'));

-- Snapshot of which growers the buyer chose farm pickup for at checkout —
-- read by the payment webhook when purchase_orders rows are created, since
-- POs don't exist yet at order-creation time.
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS farm_pickup_farmer_ids UUID[] NOT NULL DEFAULT '{}';
