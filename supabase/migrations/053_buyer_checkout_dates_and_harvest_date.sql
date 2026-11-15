-- Migration 053: buyer-driven fulfilment dates at checkout + grower-only harvest date
--
-- Buyer now chooses the real fulfilment deadline at checkout (delivery date,
-- or a farm-pickup slot's concrete date) instead of admin setting it after
-- the fact. Per-farmer pickup-date choices must be held on `orders` until the
-- matching purchase_orders row exists (created later, at payment
-- finalization) -- the same reason fulfillment_option_selections already
-- lives on this table.
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS buyer_fulfillment_dates JSONB NOT NULL DEFAULT '{}'::jsonb;

-- Grower's own, independent "when will I actually cut" date -- separate
-- from grower_fulfillment_date, which is the buyer-set deadline the grower
-- must satisfy, not something the grower should be able to overwrite.
ALTER TABLE purchase_orders
  ADD COLUMN IF NOT EXISTS harvest_date TIMESTAMPTZ;
