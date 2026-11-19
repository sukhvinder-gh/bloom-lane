-- Migration 060: gate a grower's collection-point choice behind the hub's
-- coordinator, rather than adding it instantly. Growers keep the existing
-- self-service hub picker (storefront page); picking a hub now creates a
-- 'pending' request until the coordinator approves or declines it from
-- their hub page.
--
-- Pickup/delivery options have never needed approval, so they (and any
-- collection_point row that already exists today) default to 'approved' --
-- this grandfathers in whatever's already live rather than silently pulling
-- an already-working collection point off a grower's storefront.
ALTER TABLE farmer_fulfillment_options
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'approved'
  CHECK (status IN ('pending', 'approved', 'declined'));
