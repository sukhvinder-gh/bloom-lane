-- Migration 022: Color palette + common/Latin name search
--
-- Buyers search by color palette and by whatever name they know a flower by
-- (common or Latin) — this adds the columns products need for both.

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS color_tags  TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS common_name TEXT,
  ADD COLUMN IF NOT EXISTS latin_name  TEXT;

CREATE INDEX IF NOT EXISTS idx_products_color_tags ON products USING GIN (color_tags);
