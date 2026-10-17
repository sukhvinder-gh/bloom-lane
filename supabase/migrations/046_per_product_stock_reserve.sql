-- Migration 046: B2B/B2C stock split becomes a per-product grower setting,
-- not a platform-wide config value.
--
-- b2b_stock_pct used to be a single global config row applied to every
-- product via the calculate_stock_splits() trigger. Growers have no business
-- reason to all share one wholesale/retail split — a grower selling mostly
-- to florists wants a very different reserve than one focused on retail
-- walk-up — so this moves the setting onto products itself, grower-editable
-- per listing like wholesale_price and min_order_b2b already are.
--
-- Existing rows are backfilled to the platform's current global value
-- (1.0 at the time of writing) so today's live split doesn't change the
-- moment this migration runs — growers can then adjust their own products
-- going forward. New products default to 0.5 (neutral 50/50) rather than
-- inheriting whatever the old platform default happened to be.

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS b2b_stock_pct DECIMAL(5,4) NOT NULL DEFAULT 0.5
  CHECK (b2b_stock_pct >= 0 AND b2b_stock_pct <= 1);

UPDATE products
SET b2b_stock_pct = COALESCE(
  (SELECT value::DECIMAL FROM config WHERE key = 'b2b_stock_pct'),
  0.5
);

-- Re-point the split trigger at the product's own column instead of config,
-- and watch b2b_stock_pct for changes too — previously only a stock_total
-- write re-triggered the split, so changing just the percentage (with stock
-- untouched) silently did nothing.
CREATE OR REPLACE FUNCTION calculate_stock_splits()
RETURNS TRIGGER AS $$
BEGIN
  NEW.b2b_reserved  := FLOOR(NEW.stock_total * NEW.b2b_stock_pct);
  NEW.b2c_reserved  := NEW.stock_total - NEW.b2b_reserved;
  NEW.b2b_available := NEW.b2b_reserved;
  NEW.b2c_available := NEW.b2c_reserved;
  NEW.updated_at    := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_stock_splits ON products;
CREATE TRIGGER trigger_stock_splits
  BEFORE INSERT OR UPDATE OF stock_total, b2b_stock_pct ON products
  FOR EACH ROW EXECUTE FUNCTION calculate_stock_splits();
