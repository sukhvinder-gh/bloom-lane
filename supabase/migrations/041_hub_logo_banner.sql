-- Migration 041: Hub logo/banner
-- Hubs had no equivalent of the farmer storefront's Logo / Farm-Owner Photo —
-- a coordinator had no way to put a picture on their hub at all.

ALTER TABLE hubs
  ADD COLUMN IF NOT EXISTS logo_url   TEXT,
  ADD COLUMN IF NOT EXISTS banner_url TEXT;
