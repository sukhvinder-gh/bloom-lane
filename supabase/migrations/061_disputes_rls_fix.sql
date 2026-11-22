-- Migration 061: restore the buyer-facing RLS policies on `disputes`.
--
-- Migrations 048/049 found that RLS gets altered directly in the Supabase
-- dashboard outside of migration history on this project, more than once --
-- confirmed again here: a buyer's own INSERT via the new "Report an issue"
-- feature (src/app/api/orders/[id]/dispute/route.ts) is rejected with "new
-- row violates row-level security policy for table disputes", even though
-- 001_initial_schema.sql already defines the policy needed
-- (disputes_buyer_insert). Whatever currently exists in prod, this drops
-- and recreates the full intended set so it's correct regardless of prior
-- drift, rather than guessing at what's missing.
--
-- Also widens the admin policy from role = 'admin' only (001's original,
-- never updated) to the three-role admin set every later migration uses
-- (e.g. 021, 032, 054) -- platform_admin/super_admin were never able to
-- read or resolve disputes via RLS, though in practice this never mattered
-- since the admin disputes routes exclusively use the service-role client.

DROP POLICY IF EXISTS "disputes_buyer_own" ON disputes;
DROP POLICY IF EXISTS "disputes_buyer_insert" ON disputes;
DROP POLICY IF EXISTS "disputes_admin" ON disputes;

ALTER TABLE disputes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "disputes_buyer_own" ON disputes
  FOR SELECT USING (raised_by = auth.uid());

CREATE POLICY "disputes_buyer_insert" ON disputes
  FOR INSERT WITH CHECK (
    raised_by = auth.uid() AND
    order_id IN (SELECT id FROM orders WHERE buyer_id = auth.uid())
  );

CREATE POLICY "disputes_admin" ON disputes
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'platform_admin', 'super_admin'))
  );
