-- Migration 033: Buyer-selected delivery option per grower at checkout
--
-- Checkout could only ever use a grower's FIRST configured delivery option
-- (farmer_fulfillment_options, type='delivery') when computing delivery
-- cost, ignoring any additional day/time/cost slots a grower configured.
-- Growers already support multiple delivery slots (storefront "+ Add
-- delivery option"), and the marketplace drawer / grower profile already
-- display all of them — checkout was the only place still assuming there
-- was just one.

-- Snapshot of which specific option the buyer picked per grower at
-- checkout — read when purchase_orders rows are created (in
-- finalizeOrderPayment), same reason farm_pickup_farmer_ids exists: POs
-- don't exist yet at order-creation time.
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS fulfillment_option_selections JSONB NOT NULL DEFAULT '{}'::jsonb;

-- Which specific option (day/time/cost) this PO's delivery is fulfilled
-- under, if the buyer selected one — null means hub pickup, farm pickup,
-- or a grower with no configured delivery options (flat platform fee).
ALTER TABLE purchase_orders
  ADD COLUMN IF NOT EXISTS fulfillment_option_id UUID REFERENCES farmer_fulfillment_options(id) ON DELETE SET NULL;
