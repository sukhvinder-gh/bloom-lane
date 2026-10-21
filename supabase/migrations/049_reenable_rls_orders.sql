-- Migration 049: CRITICAL — orders and order_items had RLS switched off at
-- some point outside the migration history (no migration ever runs
-- DISABLE ROW LEVEL SECURITY, so this happened manually, likely during one
-- of the dev/prod data-migration or debugging sessions). Confirmed via the
-- Supabase security scanner as "Policy Exists RLS Disabled" on both
-- projects: the policies from 001_initial_schema.sql (orders_buyer_own,
-- orders_farmer_read, orders_admin, order_items_buyer_own,
-- order_items_farmer_own, order_items_farmer_update, order_items_admin)
-- are all still present and correctly defined, but were never being
-- enforced — anyone holding the public anon key could read, write or
-- delete every order and order line in the database, including other
-- buyers' names, addresses and order history, via a raw REST call that
-- bypasses the app's own buyer_id filtering entirely.
--
-- Confirmed safe to re-enable: the only place these tables are queried
-- through the anon/authenticated client (as opposed to the service-role
-- admin client, which bypasses RLS regardless) is the buyer's own orders
-- page (src/app/dashboard/buyer/orders/page.tsx), which already filters by
-- .eq('buyer_id', user.id) — exactly what orders_buyer_own enforces. No
-- app behavior changes; this only closes the gap for anyone going around
-- the app's own code.

ALTER TABLE orders      ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
