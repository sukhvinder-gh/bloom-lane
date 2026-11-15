-- Migration 054: durable record of confirmation/PO email outcomes
--
-- sendAllOrderEmails() in finalizeOrderPayment.ts was fire-and-forget with
-- only a console.error on failure -- undiagnosable after the fact once logs
-- roll over. This gives each attempt a persisted, queryable row.
CREATE TABLE IF NOT EXISTS order_email_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id    UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  email_type  TEXT NOT NULL CHECK (email_type IN ('buyer_confirmation', 'grower_po')),
  recipient   TEXT NOT NULL,
  status      TEXT NOT NULL CHECK (status IN ('sent', 'failed')),
  error       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_order_email_log_order_id ON order_email_log(order_id);

ALTER TABLE order_email_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "order_email_log_admin_all" ON order_email_log;
CREATE POLICY "order_email_log_admin_all" ON order_email_log FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','platform_admin','super_admin'))
);
