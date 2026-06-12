-- Migration 016: Newsletter subscribers + campaign log

CREATE TABLE IF NOT EXISTS newsletter_subscribers (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email           TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'unsubscribed')),
  source          TEXT NOT NULL DEFAULT 'landing_page',
  subscribed_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  unsubscribed_at TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (email)
);

CREATE TABLE IF NOT EXISTS campaign_log (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject          TEXT NOT NULL,
  body             TEXT NOT NULL,
  sent_by          UUID REFERENCES profiles(id),
  sent_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  recipient_count  INTEGER NOT NULL DEFAULT 0
);

ALTER TABLE newsletter_subscribers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "newsletter_admin_all" ON newsletter_subscribers;
CREATE POLICY "newsletter_admin_all" ON newsletter_subscribers FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','platform_admin','super_admin'))
);

ALTER TABLE campaign_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "campaign_log_admin_all" ON campaign_log;
CREATE POLICY "campaign_log_admin_all" ON campaign_log FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','platform_admin','super_admin'))
);

CREATE INDEX IF NOT EXISTS idx_newsletter_status ON newsletter_subscribers(status);
