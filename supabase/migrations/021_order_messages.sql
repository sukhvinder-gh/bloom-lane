-- Migration 021: Order messaging
--
-- Centralizes buyer<->grower communication into an audit trail attached to
-- a specific order, instead of Instagram DMs/texts/emails. Threads are
-- scoped per (order, farmer) via purchase_orders — the per-grower slice of
-- a multi-supplier order — so a buyer's conversation with one grower never
-- leaks to another grower on the same order.

CREATE TABLE IF NOT EXISTS messages (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  sender_id         UUID NOT NULL REFERENCES profiles(id),
  sender_role       TEXT NOT NULL CHECK (sender_role IN ('buyer', 'farmer', 'admin')),
  body              TEXT NOT NULL CHECK (char_length(body) BETWEEN 1 AND 2000),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- RLS is a backstop here — the app routes do their own explicit ownership
-- checks (same pattern as the rest of this codebase), matching what admin
-- clients bypass day to day.
DROP POLICY IF EXISTS "messages_buyer_select"  ON messages;
DROP POLICY IF EXISTS "messages_buyer_insert"  ON messages;
DROP POLICY IF EXISTS "messages_farmer_select" ON messages;
DROP POLICY IF EXISTS "messages_farmer_insert" ON messages;
DROP POLICY IF EXISTS "messages_admin_all"     ON messages;

CREATE POLICY "messages_buyer_select" ON messages FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM purchase_orders po JOIN orders o ON o.id = po.order_id
    WHERE po.id = messages.purchase_order_id AND o.buyer_id = auth.uid()
  )
);
CREATE POLICY "messages_buyer_insert" ON messages FOR INSERT WITH CHECK (
  sender_id = auth.uid() AND sender_role = 'buyer' AND
  EXISTS (
    SELECT 1 FROM purchase_orders po JOIN orders o ON o.id = po.order_id
    WHERE po.id = messages.purchase_order_id AND o.buyer_id = auth.uid()
  )
);

CREATE POLICY "messages_farmer_select" ON messages FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM purchase_orders po JOIN farmers f ON f.id = po.farmer_id
    WHERE po.id = messages.purchase_order_id AND f.user_id = auth.uid()
  )
);
CREATE POLICY "messages_farmer_insert" ON messages FOR INSERT WITH CHECK (
  sender_id = auth.uid() AND sender_role = 'farmer' AND
  EXISTS (
    SELECT 1 FROM purchase_orders po JOIN farmers f ON f.id = po.farmer_id
    WHERE po.id = messages.purchase_order_id AND f.user_id = auth.uid()
  )
);

CREATE POLICY "messages_admin_all" ON messages FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'platform_admin', 'super_admin'))
);

CREATE INDEX IF NOT EXISTS idx_messages_po_created ON messages(purchase_order_id, created_at);
