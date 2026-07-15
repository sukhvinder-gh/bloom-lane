-- Migration 023: Standardized bunch sizes + per-stem price comparison
--
-- Buyers compare cut-flower prices "by the stem" regardless of how a grower
-- bunches them. stems_per_unit lets a bunch/stem-unit product declare how
-- many stems it contains so the price-per-stem can be shown consistently.

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS stems_per_unit INTEGER CHECK (stems_per_unit IS NULL OR stems_per_unit > 0);
