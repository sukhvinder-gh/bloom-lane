-- Migration 047: fulfilment date becomes a per-grower setting, not a single
-- admin-set value shared by every farmer on a multi-vendor order.
--
-- orders.grower_fulfillment_date is one column on a table shared by every
-- farmer in the order, and the only way to set it was an admin-only PATCH
-- route — growers had no input and no visibility beyond "TBC, see admin".
-- purchase_orders already has one row per (order_id, farmer_id), so the
-- real per-grower date belongs there. orders.grower_fulfillment_date is
-- left in place unchanged — it still drives the admin override UI, the
-- buyer-facing order view, and acts as a fallback for any row created
-- before this migration.
--
-- Existing purchase_orders rows are backfilled from their order's current
-- value so already-placed orders don't regress to "unscheduled" the moment
-- this ships.

ALTER TABLE purchase_orders
  ADD COLUMN IF NOT EXISTS grower_fulfillment_date TIMESTAMPTZ;

UPDATE purchase_orders po
SET grower_fulfillment_date = o.grower_fulfillment_date
FROM orders o
WHERE po.order_id = o.id
  AND po.grower_fulfillment_date IS NULL
  AND o.grower_fulfillment_date IS NOT NULL;
