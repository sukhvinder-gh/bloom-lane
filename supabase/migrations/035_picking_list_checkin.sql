-- Migration 035: Picking list hub check-in tracking
--
-- The admin "Picking List" tab (Orders page) groups active order_items by
-- grower so admin/hub coordinators know what each grower needs to bring to
-- the hub. Its checkboxes were previously decorative only. picked_at is
-- distinct from farmer-side packed_at (migration 034) — packed_at is the
-- grower marking their own item packed at their farm; picked_at is the hub
-- coordinator marking that the item has physically arrived at the hub.

ALTER TABLE order_items
  ADD COLUMN IF NOT EXISTS picked_at TIMESTAMPTZ;
