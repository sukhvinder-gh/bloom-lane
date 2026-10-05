-- Migration 044: Double opt-in for newsletter subscribers.
--
-- Subscribing used to mark status='active' immediately — no proof the
-- submitter actually owns that email address, which is both an anti-spam/
-- deliverability risk and means someone could sign up any email they don't
-- own. New subscribers now land as 'pending' until they click the
-- confirmation link emailed to them.
--
-- Existing 'active' rows are untouched — this doesn't retroactively
-- unsubscribe anyone who already confirmed by virtue of being on the list
-- before this change.

ALTER TABLE newsletter_subscribers
  DROP CONSTRAINT IF EXISTS newsletter_subscribers_status_check;

ALTER TABLE newsletter_subscribers
  ADD CONSTRAINT newsletter_subscribers_status_check
  CHECK (status IN ('pending', 'active', 'unsubscribed'));

ALTER TABLE newsletter_subscribers
  ADD COLUMN IF NOT EXISTS confirm_token TEXT,
  ADD COLUMN IF NOT EXISTS confirmed_at  TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS idx_newsletter_confirm_token
  ON newsletter_subscribers(confirm_token)
  WHERE confirm_token IS NOT NULL;
