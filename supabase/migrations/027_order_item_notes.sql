-- Migration 027: Per-item order notes
-- Today only orders.notes exists (one note for the whole order). Growers need
-- to see instructions tied to the specific line they apply to (e.g. "tie with
-- raffia not rubber bands" on one product, not the whole order).
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS notes TEXT;
