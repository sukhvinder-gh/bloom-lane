-- Migration 009: Purchase Orders + Fulfillment/Delivery Dates
-- Run this entire script in one SQL Editor execution.

-- 1. Add fulfilment/delivery dates to orders
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS grower_fulfillment_date TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS florist_delivery_date   TIMESTAMPTZ;

-- 2. Per-grower PO tracking within each order
CREATE TABLE IF NOT EXISTS purchase_orders (
  id               UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id         UUID        NOT NULL REFERENCES orders(id)  ON DELETE CASCADE,
  farmer_id        UUID        NOT NULL REFERENCES farmers(id),
  status           TEXT        NOT NULL DEFAULT 'pending'
                               CHECK (status IN ('pending', 'accepted', 'rejected')),
  rejection_reason TEXT,
  rejected_at      TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (order_id, farmer_id)
);

ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;

-- Farmers see/update/insert their own POs
CREATE POLICY "po_farmer_select" ON purchase_orders
  FOR SELECT USING (
    farmer_id IN (SELECT id FROM farmers WHERE user_id = auth.uid())
  );

CREATE POLICY "po_farmer_update" ON purchase_orders
  FOR UPDATE USING (
    farmer_id IN (SELECT id FROM farmers WHERE user_id = auth.uid())
  );

CREATE POLICY "po_farmer_insert" ON purchase_orders
  FOR INSERT WITH CHECK (
    farmer_id IN (SELECT id FROM farmers WHERE user_id = auth.uid())
  );

-- Admins have full access
CREATE POLICY "po_admin_all" ON purchase_orders
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND role IN ('admin', 'super_admin', 'platform_admin')
    )
  );

-- 3. Add order_id to payouts for easier per-order payout lookup
ALTER TABLE payouts ADD COLUMN IF NOT EXISTS order_id UUID REFERENCES orders(id);

-- 4. Indexes
CREATE INDEX IF NOT EXISTS idx_purchase_orders_order_id  ON purchase_orders(order_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_farmer_id ON purchase_orders(farmer_id);
CREATE INDEX IF NOT EXISTS idx_payouts_order_id          ON payouts(order_id);
