-- Migration 034: Harvest/pack checklist tracking
--
-- Harvest and pack lists need real, persisted "done" state per line item —
-- previously these were read-only worksheets with nothing to check off.
-- Tracked at the order_items grain (not a separate table) since that's
-- already the natural unit both lists are built from: the harvest list
-- aggregates order_items by product across orders, and the pack list
-- shows order_items grouped by order — a boolean+timestamp pair on the
-- row itself avoids a join for what's fundamentally a per-line-item fact.

ALTER TABLE order_items
  ADD COLUMN IF NOT EXISTS harvested_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS packed_at    TIMESTAMPTZ;
