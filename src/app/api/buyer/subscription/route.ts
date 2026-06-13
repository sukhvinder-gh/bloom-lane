import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient, createAdminClient } from '@/lib/supabase/server'
import { sendSubscriptionConfirmation } from '@/lib/email/sendSubscriptionEmail'

export async function GET() {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data: sub } = await admin
    .from('subscriptions')
    .select('*')
    .eq('user_id', user.id)
    .eq('subscriber_type', 'florist')
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  const { data: configRows } = await admin
    .from('config')
    .select('key, value')
    .in('key', ['personal_shopper_weekly_cents', 'personal_shopper_monthly_cents', 'personal_shopper_annual_cents'])

  const cfg: Record<string, number> = {}
  configRows?.forEach((r: any) => { cfg[r.key] = parseInt(r.value) || 0 })

  return NextResponse.json({ subscription: sub || null, config: cfg })
}

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { plan, billing_period } = await request.json()

  if (!plan || !['mailing_list', 'personal_shopper'].includes(plan)) {
    return NextResponse.json({ error: 'Invalid plan' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Mailing list is always free — activate immediately
  if (plan === 'mailing_list') {
    const { data: sub, error } = await admin
      .from('subscriptions')
      .upsert({
        user_id: user.id,
        subscriber_type: 'florist',
        plan: 'mailing_list',
        billing_period: 'free',
        status: 'active',
        starts_at: new Date().toISOString(),
        expires_at: null,
        amount_cents: 0,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id,subscriber_type,plan' })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Send confirmation email
    const { data: profile } = await admin.from('profiles').select('email, full_name').eq('id', user.id).single()
    if (profile?.email) {
      sendSubscriptionConfirmation({
        to: profile.email,
        name: profile.full_name || 'Florist',
        plan: 'mailing_list',
        billing: 'free',
        amount_cents: 0,
      }).catch(() => {})
    }

    return NextResponse.json({ ok: true, subscription: sub, requiresPayment: false })
  }

  // Personal shopper — get price and return for payment
  const periodKey: Record<string, string> = {
    weekly:  'personal_shopper_weekly_cents',
    monthly: 'personal_shopper_monthly_cents',
    annual:  'personal_shopper_annual_cents',
  }
  const configKey = periodKey[billing_period]
  if (!configKey) return NextResponse.json({ error: 'Invalid billing period' }, { status: 400 })

  const { data: cfgRow } = await admin.from('config').select('value').eq('key', configKey).single()
  const amount = parseInt(cfgRow?.value || '0') || 0

  const { data: sub, error } = await admin
    .from('subscriptions')
    .upsert({
      user_id: user.id,
      subscriber_type: 'florist',
      plan: 'personal_shopper',
      billing_period,
      status: 'pending',
      amount_cents: amount,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,subscriber_type,plan' })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, subscription: sub, requiresPayment: true, amount_cents: amount })
}

// DELETE — cancel the florist's active subscription
export async function DELETE() {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()

  const { data: sub } = await admin
    .from('subscriptions')
    .select('id')
    .eq('user_id', user.id)
    .eq('subscriber_type', 'florist')
    .in('status', ['active', 'pending'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!sub) return NextResponse.json({ error: 'No active subscription found' }, { status: 404 })

  const { error } = await admin
    .from('subscriptions')
    .update({ status: 'cancelled', updated_at: new Date().toISOString() })
    .eq('id', sub.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
