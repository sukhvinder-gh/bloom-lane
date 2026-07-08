-- Migration 020: Per-grower GST calculation + refund/credit-note wiring
--
-- Problem: GST was calculated purely from product.is_gst_free, ignoring whether
-- the supplying grower (farmer) is actually GST-registered. Only a GST-registered
-- entity may charge GST. This migration adds a per-line snapshot of that decision
-- (captured at time of purchase, not recomputed later from onboarding data), plus
-- the tables needed to record credit notes and carry-forward payout clawbacks when
-- a refund is issued.

-- ── Order items: snapshot GST status per line at time of purchase ───────────
ALTER TABLE order_items
  ADD COLUMN IF NOT EXISTS gst_applied BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS gst_cents   INTEGER NOT NULL DEFAULT 0 CHECK (gst_cents >= 0);

-- ── Orders: cumulative refund tracking ───────────────────────────────────────
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS refunded_cents INTEGER NOT NULL DEFAULT 0 CHECK (refunded_cents >= 0);

-- ── Disputes: resolution_note (already used by existing API/UI but never
--    migrated), plus refund tracking ─────────────────────────────────────────
ALTER TABLE disputes
  ADD COLUMN IF NOT EXISTS resolution_note     TEXT,
  ADD COLUMN IF NOT EXISTS refund_amount_cents INTEGER,
  ADD COLUMN IF NOT EXISTS stripe_refund_id    TEXT;

-- ── Credit notes: one row per affected grower per refund event ──────────────
CREATE TABLE IF NOT EXISTS credit_notes (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id                UUID NOT NULL REFERENCES orders(id),
  dispute_id              UUID REFERENCES disputes(id),
  farmer_id               UUID NOT NULL REFERENCES farmers(id),
  credit_note_number      TEXT NOT NULL UNIQUE DEFAULT ('CN-' || UPPER(SUBSTRING(gen_random_uuid()::TEXT, 1, 8))),
  original_subtotal_cents INTEGER NOT NULL CHECK (original_subtotal_cents > 0),
  refund_amount_cents     INTEGER NOT NULL CHECK (refund_amount_cents > 0),
  gst_cents               INTEGER NOT NULL DEFAULT 0 CHECK (gst_cents >= 0),
  reason                  TEXT,
  created_by              UUID REFERENCES profiles(id),
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE credit_notes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "credit_notes_admin_all"   ON credit_notes;
DROP POLICY IF EXISTS "credit_notes_farmer_read" ON credit_notes;
CREATE POLICY "credit_notes_admin_all" ON credit_notes FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','platform_admin','super_admin'))
);
CREATE POLICY "credit_notes_farmer_read" ON credit_notes FOR SELECT USING (
  EXISTS (SELECT 1 FROM farmers WHERE farmers.id = credit_notes.farmer_id AND farmers.user_id = auth.uid())
);

CREATE INDEX IF NOT EXISTS idx_credit_notes_order  ON credit_notes(order_id);
CREATE INDEX IF NOT EXISTS idx_credit_notes_farmer ON credit_notes(farmer_id);

-- ── Farmer balance adjustments: negative-balance carry-forward ──────────────
-- When a refund happens after (or independent of) payout timing, we don't
-- reverse the Stripe transfer immediately — we record what the farmer owes
-- back and deduct it from their next payout(s) in generate-payouts.
CREATE TABLE IF NOT EXISTS farmer_balance_adjustments (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farmer_id            UUID NOT NULL REFERENCES farmers(id),
  credit_note_id       UUID REFERENCES credit_notes(id),
  amount_cents         INTEGER NOT NULL CHECK (amount_cents > 0),
  reason               TEXT,
  status               TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'applied')),
  applied_to_payout_id UUID REFERENCES payouts(id),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  applied_at           TIMESTAMPTZ
);

ALTER TABLE farmer_balance_adjustments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "balance_adj_admin_all"  ON farmer_balance_adjustments;
DROP POLICY IF EXISTS "balance_adj_farmer_read" ON farmer_balance_adjustments;
CREATE POLICY "balance_adj_admin_all" ON farmer_balance_adjustments FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','platform_admin','super_admin'))
);
CREATE POLICY "balance_adj_farmer_read" ON farmer_balance_adjustments FOR SELECT USING (
  EXISTS (SELECT 1 FROM farmers WHERE farmers.id = farmer_balance_adjustments.farmer_id AND farmers.user_id = auth.uid())
);

CREATE INDEX IF NOT EXISTS idx_balance_adj_farmer_pending
  ON farmer_balance_adjustments(farmer_id) WHERE status = 'pending';

-- ── Payouts: a dedicated column for clawback deductions ─────────────────────
-- The existing valid_amounts CHECK requires net = gross - commission exactly,
-- so a clawback needs its own column rather than silently overwriting net.
ALTER TABLE payouts
  ADD COLUMN IF NOT EXISTS adjustment_cents INTEGER NOT NULL DEFAULT 0 CHECK (adjustment_cents >= 0);

ALTER TABLE payouts DROP CONSTRAINT IF EXISTS valid_amounts;
ALTER TABLE payouts ADD CONSTRAINT valid_amounts
  CHECK (net_amount_cents = gross_amount_cents - commission_cents - adjustment_cents);
