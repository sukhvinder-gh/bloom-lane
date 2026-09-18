-- Migration 036: track the Stripe PaymentIntent behind a grower subscription
-- payment. Hub Membership is a fixed-term purchase (not a Stripe recurring
-- subscription — see subscriptions.expires_at / disable_expired_subscriptions()),
-- charged one-off via PaymentIntent the same way order payments are, so this
-- mirrors orders.stripe_payment_intent_id for the same audit/idempotency purpose.

ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS stripe_payment_intent_id TEXT;

CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_payment_intent_id
  ON subscriptions(stripe_payment_intent_id);
