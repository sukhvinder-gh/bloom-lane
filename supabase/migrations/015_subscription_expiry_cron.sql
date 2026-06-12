-- Migration 015: Subscription expiry — auto-disable listings
-- This function is called by the /api/admin/check-subscriptions endpoint
-- (or a scheduled cron) to deactivate expired grower subscriptions.

CREATE OR REPLACE FUNCTION disable_expired_subscriptions()
RETURNS INTEGER AS $$
DECLARE
  affected INTEGER := 0;
BEGIN
  -- Mark subscriptions as expired
  UPDATE subscriptions
  SET status = 'expired', updated_at = now()
  WHERE status = 'active'
    AND expires_at IS NOT NULL
    AND expires_at < now()
    AND subscriber_type = 'grower';

  GET DIAGNOSTICS affected = ROW_COUNT;

  -- Hide all products for growers whose subscription has expired
  -- (hub_membership only — wholesale collection has no expiry)
  UPDATE products p
  SET is_listed_this_week = FALSE, updated_at = now()
  FROM farmers f
  WHERE p.farmer_id = f.id
    AND f.subscription_type = 'hub_membership'
    AND f.subscription_expires_at IS NOT NULL
    AND f.subscription_expires_at < now()
    AND p.is_active = TRUE;

  RETURN affected;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
