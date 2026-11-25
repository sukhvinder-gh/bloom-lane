-- Supports two GST-compliance gaps:
--  1. farmers.gst_registered_from — when a grower's registration actually
--     started, so a tax invoice can state it and an audit can confirm the
--     invoice's historical GST treatment (order_items.gst_applied, already
--     snapshotted at sale time) lines up with when they say they registered.
--  2. profiles.gst_registered — the BUYER's own GST registration. An RCTI
--     (recipient-created tax invoice) is only valid when both the supplying
--     grower and the buyer are GST-registered; previously only the grower's
--     side was tracked at all.
ALTER TABLE farmers
  ADD COLUMN IF NOT EXISTS gst_registered_from DATE;

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS gst_registered BOOLEAN NOT NULL DEFAULT FALSE;
