-- Migration 013: Add has_partial_rejection flag to orders
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS has_partial_rejection BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_orders_partial_rejection ON orders(has_partial_rejection) WHERE has_partial_rejection = TRUE;
