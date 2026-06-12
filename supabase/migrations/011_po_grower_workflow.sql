-- Migration 011: Grower PO workflow — expanded status values + audit timestamps

-- 1. Migrate legacy 'accepted' rows to 'pending' before changing the constraint
UPDATE purchase_orders SET status = 'pending' WHERE status = 'accepted';

-- 2. Replace status check with full grower workflow values
ALTER TABLE purchase_orders DROP CONSTRAINT IF EXISTS purchase_orders_status_check;
ALTER TABLE purchase_orders ADD CONSTRAINT purchase_orders_status_check
  CHECK (status IN ('pending', 'ready', 'delivered_to_hub', 'rejected'));

-- 3. Audit timestamps for each grower milestone
ALTER TABLE purchase_orders
  ADD COLUMN IF NOT EXISTS ready_at            TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS delivered_to_hub_at TIMESTAMPTZ;
