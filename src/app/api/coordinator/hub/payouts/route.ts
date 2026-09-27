// src/app/api/coordinator/hub/payouts/route.ts
//
// A coordinator could never see payouts made to their own hub's Stripe
// account — that view only ever existed in Admin > Payouts. Scoped to
// whichever hub(s) this coordinator runs, via payouts.paid_to_hub_id.

import { NextResponse } from 'next/server'
import { createSupabaseServerClient, createAdminClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data: hubs } = await admin.from('hubs').select('id').eq('coordinator_id', user.id)
  const hubIds = (hubs || []).map(h => h.id)
  if (hubIds.length === 0) return NextResponse.json({ data: [] })

  const { data, error } = await admin
    .from('payouts')
    .select('id, farmer_id, gross_amount_cents, commission_cents, net_amount_cents, status, stripe_transfer_id, paid_at, created_at, paid_to_hub_id, farmers(business_name)')
    .in('paid_to_hub_id', hubIds)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data: data || [] })
}
