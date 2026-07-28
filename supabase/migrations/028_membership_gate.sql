-- Migration 028: Membership gate for buying/selling
--
-- "Users should not be able to buy or sell until their membership has been
-- paid for and approved." The subscriptions table already exists but is
-- unchecked anywhere in the buy/sell path. Per the confirmed rollout: every
-- account that exists at the moment this migration runs is grandfathered as
-- active — the gate only ever blocks accounts created after this point that
-- haven't completed a subscription (even the free tiers count, since they
-- still require an explicit signup step).

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS membership_grandfathered BOOLEAN NOT NULL DEFAULT false;

-- Backfill: every profile that exists right now is grandfathered. New
-- signups after this line runs get the column default (false) and must
-- complete a subscription (even a free one) to pass the gate.
UPDATE profiles SET membership_grandfathered = true WHERE membership_grandfathered = false;
