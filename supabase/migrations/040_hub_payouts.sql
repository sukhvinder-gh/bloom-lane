-- Migration 040: pay a hub's connected Stripe account on behalf of its
-- growers, instead of always paying the grower directly.
--
-- A hub gets its own Stripe Connect Express account, set up by its
-- coordinator the same way a grower connects their own (see
-- src/app/api/stripe/onboarding/route.ts / src/app/api/coordinator/stripe/onboarding).
-- When a grower belongs to a hub AND that hub has finished Stripe onboarding,
-- their payout is transferred to the hub's account instead of their own; the
-- hub is then responsible for passing that on to the grower outside the
-- platform. A grower not in a hub, or whose hub hasn't connected Stripe yet,
-- is still paid directly -- this must never be a reason a payout gets stuck.

ALTER TABLE hubs
  ADD COLUMN IF NOT EXISTS stripe_account_id        TEXT,
  ADD COLUMN IF NOT EXISTS stripe_onboarding_complete BOOLEAN NOT NULL DEFAULT FALSE;

-- Records which hub actually received the transfer, when one did — payouts.farmer_id
-- still identifies whose sale this was, this just clarifies where the money went.
ALTER TABLE payouts
  ADD COLUMN IF NOT EXISTS paid_to_hub_id UUID REFERENCES hubs(id) ON DELETE SET NULL;
