-- Migration 045: Recompute all products' B2B/B2C stock split on demand.
--
-- The split (b2b_reserved/b2c_reserved/b2b_available/b2c_available) is only
-- ever recalculated by trigger_stock_splits, which fires on INSERT OR
-- UPDATE OF stock_total — so when an admin changes the platform-wide
-- b2b_stock_pct config, every existing product keeps its *old* split until
-- someone happens to re-save that product's stock. This function re-touches
-- every row's stock_total (to itself) so the existing trigger re-fires and
-- recomputes against whatever b2b_stock_pct is current right now — called
-- from the config save route whenever that key changes.

CREATE OR REPLACE FUNCTION recompute_all_product_stock_splits()
RETURNS INTEGER AS $$
DECLARE
  affected INTEGER := 0;
BEGIN
  -- WHERE true: this project has a guard against WHERE-less UPDATE/DELETE
  -- statements, which a bare "UPDATE products SET ..." trips even though
  -- every row is the intended target here.
  UPDATE products SET stock_total = stock_total WHERE true;
  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END;
$$ LANGUAGE plpgsql;
