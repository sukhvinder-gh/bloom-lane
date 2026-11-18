-- Migration 058: attendance tracking for collection points -- a coordinator
-- can mark a purchase order's grower drop-off and buyer collection
-- independently, since they happen at different times on pickup day.
CREATE TABLE IF NOT EXISTS collection_point_checkins (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id  UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  checkin_type       TEXT NOT NULL CHECK (checkin_type IN ('grower_dropoff', 'buyer_collection')),
  checked_in_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  checked_in_by      UUID REFERENCES profiles(id),
  UNIQUE (purchase_order_id, checkin_type)
);

ALTER TABLE collection_point_checkins ENABLE ROW LEVEL SECURITY;

-- The hub's own coordinator (via the PO's fulfillment option -> hub ->
-- coordinator_id chain) or an admin can read/write check-ins for that PO.
CREATE POLICY collection_point_checkins_coordinator ON collection_point_checkins
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM purchase_orders po
      JOIN farmer_fulfillment_options ffo ON ffo.id = po.fulfillment_option_id
      JOIN hubs h ON h.id = ffo.hub_id
      WHERE po.id = collection_point_checkins.purchase_order_id
        AND h.coordinator_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'platform_admin', 'super_admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM purchase_orders po
      JOIN farmer_fulfillment_options ffo ON ffo.id = po.fulfillment_option_id
      JOIN hubs h ON h.id = ffo.hub_id
      WHERE po.id = collection_point_checkins.purchase_order_id
        AND h.coordinator_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'platform_admin', 'super_admin')
    )
  );
