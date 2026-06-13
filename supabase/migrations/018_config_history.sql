-- Migration 018: Config history with effective-date scheduling + audit trail

CREATE TABLE IF NOT EXISTS config_history (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key            TEXT NOT NULL,
  value          TEXT NOT NULL,
  previous_value TEXT,
  effective_from TIMESTAMPTZ NOT NULL DEFAULT now(),
  status         TEXT NOT NULL DEFAULT 'applied'
                 CHECK (status IN ('applied', 'scheduled', 'superseded')),
  set_by         UUID REFERENCES profiles(id) ON DELETE SET NULL,
  set_by_name    TEXT,
  note           TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE config_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "config_history_admin_all" ON config_history;
CREATE POLICY "config_history_admin_all" ON config_history
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'platform_admin', 'super_admin')
    )
  );

CREATE INDEX IF NOT EXISTS idx_config_history_key   ON config_history(key, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_config_history_sched ON config_history(effective_from) WHERE status = 'scheduled';

-- Seed current config values into history as the starting baseline
INSERT INTO config_history (key, value, previous_value, status, set_by_name, note)
SELECT key, value, null, 'applied', 'system', 'Initial seed from existing config'
FROM config
ON CONFLICT DO NOTHING;
