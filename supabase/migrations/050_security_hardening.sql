-- Migration 050: security hardening from the Supabase linter (WARN-level,
-- lower severity than 049's RLS gap, but all worth closing).
--
-- 1) function_search_path_mutable — none of these functions pin
--    search_path, so a role with CREATE privilege on a schema earlier in
--    the search path could shadow an unqualified table/function reference
--    inside them. Pinning to `public, pg_temp` is the standard fix and
--    changes no behavior for any of these — they all already only
--    reference public-schema objects.
--
-- 2) anon/authenticated SECURITY DEFINER EXECUTE — handle_new_user() and
--    disable_expired_subscriptions() are directly callable via
--    /rest/v1/rpc/<fn> by anyone with the anon key. Neither needs that:
--    handle_new_user() only runs as the auth.users insert trigger (trigger
--    invocation never needs the EXECUTE grant), and
--    disable_expired_subscriptions() is only ever called with the
--    service-role key (src/app/api/admin/check-subscriptions/route.ts).
--    Revoking EXECUTE from anon/authenticated doesn't affect either path.
--
--    farmer_has_order(uuid) is deliberately NOT touched here — it isn't in
--    any tracked migration (created directly via the SQL editor at some
--    point) and isn't called anywhere in the app's own code, so it may be
--    referenced inside a live RLS policy not reflected in this repo.
--    Revoking its EXECUTE grant blind could silently break that policy.
--    Run this first to check:
--
--      SELECT polname, pg_get_expr(polqual, polrelid) AS using_expr
--      FROM pg_policy
--      WHERE pg_get_expr(polqual, polrelid) ILIKE '%farmer_has_order%'
--         OR pg_get_expr(polwithcheck, polrelid) ILIKE '%farmer_has_order%';
--
--    If nothing comes back, uncomment the REVOKE for it below and re-run
--    just that line.
--
-- 3) public_bucket_allows_listing — delivery-photos is already a public
--    bucket (storage.buckets.public = true from migration 043), so direct
--    object reads via the public URL work with no policy at all. The
--    "Delivery photos are publicly readable" SELECT policy on
--    storage.objects only adds the ability to LIST/enumerate every file in
--    the bucket (e.g. every qr/<order_id>.png), which isn't needed and
--    isn't used anywhere in the app (uploads/reads go through the
--    service-role client or a known direct URL). Dropping it removes
--    enumeration without touching direct-URL access.

-- 1) search_path
ALTER FUNCTION calculate_stock_splits()                                        SET search_path = public, pg_temp;
ALTER FUNCTION set_dispute_deadline()                                          SET search_path = public, pg_temp;
ALTER FUNCTION update_updated_at()                                             SET search_path = public, pg_temp;
ALTER FUNCTION checkout_reserve_stock(jsonb)                                   SET search_path = public, pg_temp;
ALTER FUNCTION checkout_release_stock(jsonb)                                   SET search_path = public, pg_temp;
ALTER FUNCTION disable_expired_subscriptions()                                 SET search_path = public, pg_temp;
ALTER FUNCTION cart_set_reservation(uuid, uuid, integer, boolean, timestamptz) SET search_path = public, pg_temp;
ALTER FUNCTION cart_release_reservation(uuid, uuid, boolean)                   SET search_path = public, pg_temp;
ALTER FUNCTION cart_consume_reservation(uuid, uuid, integer, boolean)          SET search_path = public, pg_temp;
ALTER FUNCTION cart_release_expired_reservations()                             SET search_path = public, pg_temp;
ALTER FUNCTION recompute_all_product_stock_splits()                            SET search_path = public, pg_temp;
ALTER FUNCTION farmer_has_order(uuid)                                          SET search_path = public, pg_temp;
ALTER FUNCTION handle_new_user()                                               SET search_path = public, pg_temp;

-- 2) EXECUTE revokes (farmer_has_order deliberately excluded — see above)
REVOKE EXECUTE ON FUNCTION handle_new_user()               FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION disable_expired_subscriptions() FROM anon, authenticated;

-- 3) storage listing
DROP POLICY IF EXISTS "Delivery photos are publicly readable" ON storage.objects;
