import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient, createAdminClient } from '@/lib/supabase/server'

// POST — register a new hub (coordinator)
export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data: profile } = await admin.from('profiles').select('role').eq('id', user.id).single()
  if (!['coordinator', 'admin', 'platform_admin', 'super_admin'].includes(profile?.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { name, region } = await request.json()
  if (!name?.trim()) return NextResponse.json({ error: 'Hub name is required' }, { status: 400 })

  // Get registration fee from config
  const { data: cfgRow } = await admin.from('config').select('value').eq('key', 'coordinator_registration_cents').single()
  const fee = parseInt(cfgRow?.value || '0') || 0

  const { data: hub, error } = await admin
    .from('hubs')
    .insert({ name: name.trim(), region: region?.trim() || null, coordinator_id: user.id, status: fee > 0 ? 'pending' : 'active' })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Create subscription record
  await admin.from('subscriptions').insert({
    user_id: user.id,
    subscriber_type: 'coordinator',
    plan: 'coordinator',
    billing_period: fee > 0 ? 'annual' : 'free',
    status: fee > 0 ? 'pending' : 'active',
    amount_cents: fee,
    starts_at: fee > 0 ? null : new Date().toISOString(),
  })

  return NextResponse.json({ ok: true, hub, requiresPayment: fee > 0, fee_cents: fee })
}
