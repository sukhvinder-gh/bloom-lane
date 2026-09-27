import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient, createAdminClient } from '@/lib/supabase/server'
import { sendSubscriptionConfirmation } from '@/lib/email/sendSubscriptionEmail'
import { stripe } from '@/lib/stripe'
import { validateABNFormat } from '@/lib/utils/abn'

// GET — fetch current farmer subscription status
export async function GET() {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data: farmer } = await admin
    .from('farmers')
    .select('id, business_name, subscription_type, subscription_tier, subscription_expires_at, hub_id, gst_registered, rcti_agreed, rcti_agreed_at, rcti_full_name, abn, farm_address, farm_region, address, suburb, state, region, hubs(name, region)')
    .eq('user_id', user.id)
    .single()

  const { data: sub } = await admin
    .from('subscriptions')
    .select('*')
    .eq('user_id', user.id)
    .eq('subscriber_type', 'grower')
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  // farm_address/farm_region are membership-specific fields, only ever set
  // once this form has been submitted — on a first visit, fall back to the
  // address/region already entered on the Storefront page rather than
  // showing blank fields the farmer has to re-type.
  const farmerOut = farmer ? {
    ...farmer,
    farm_address: farmer.farm_address || [farmer.address, farmer.suburb, farmer.state].filter(Boolean).join(', ') || null,
    farm_region: farmer.farm_region || farmer.region || null,
  } : farmer

  return NextResponse.json({ farmer: farmerOut, subscription: sub || null })
}

// POST — save/update grower subscription details (pre-payment step)
export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const {
    subscription_type, // 'hub_membership' | 'wholesale_collection'
    billing_period,    // 'monthly' | 'seasonal' | 'annual' (null for wholesale)
    hub_id,
    abn,
    business_name,
    gst_registered,
    rcti_agreed,
    rcti_full_name,
    farm_address,
    farm_region,
  } = body

  // hub_id is only required for Hub Membership — the UI labels it
  // "(optional)" for the Free Grower Listing plan, but this check used to
  // require it unconditionally, so a grower on the free plan with no hub
  // selected got a generic "Missing required fields" error with no
  // indication of which field, even though the form looked complete.
  const missing: string[] = []
  if (!subscription_type) missing.push('plan')
  if (!abn) missing.push('ABN')
  if (subscription_type === 'hub_membership' && !hub_id) missing.push('hub / collective')
  if (missing.length > 0) {
    return NextResponse.json({ error: `Missing required fields: ${missing.join(', ')}` }, { status: 400 })
  }
  // Format-check here too, not just at registration — this route is also
  // how an existing grower edits their ABN (via "Change Plan"), and a
  // malformed value saved this way later fails Stripe payout setup with a
  // confusing error instead of being caught at the point of entry.
  if (!validateABNFormat(abn)) {
    return NextResponse.json({ error: 'Please enter a valid 11-digit ABN' }, { status: 400 })
  }
  if (subscription_type === 'hub_membership' && !billing_period) {
    return NextResponse.json({ error: 'Billing period required for Hub Membership' }, { status: 400 })
  }
  if (gst_registered && !rcti_agreed) {
    return NextResponse.json({ error: 'RCTI agreement required for GST-registered growers' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Update farmer profile. hub_id must be a real UUID or null — an empty
  // string (what the form sends when "— Select your hub —" is left as-is,
  // valid for the Free Grower Listing plan) would otherwise fail at the
  // database with an "invalid input syntax for type uuid" error.
  const farmerUpdate: Record<string, any> = {
    subscription_type,
    subscription_tier: billing_period || null,
    hub_id: hub_id || null,
    abn,
    gst_registered: !!gst_registered,
    rcti_agreed: !!rcti_agreed,
    rcti_agreed_at: rcti_agreed ? new Date().toISOString() : null,
    rcti_full_name: rcti_full_name || null,
    farm_address: farm_address || null,
    farm_region: farm_region || null,
    updated_at: new Date().toISOString(),
  }
  if (business_name) farmerUpdate.business_name = business_name

  const { error: farmerErr } = await admin
    .from('farmers')
    .update(farmerUpdate)
    .eq('user_id', user.id)

  if (farmerErr) return NextResponse.json({ error: farmerErr.message }, { status: 500 })

  // For wholesale — activate immediately (no payment)
  if (subscription_type === 'wholesale_collection') {
    const { data: sub, error: subErr } = await admin
      .from('subscriptions')
      .upsert({
        user_id: user.id,
        subscriber_type: 'grower',
        plan: 'wholesale_collection',
        billing_period: 'free',
        status: 'active',
        starts_at: new Date().toISOString(),
        expires_at: null,
        amount_cents: 0,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id,subscriber_type,plan' })
      .select()
      .single()

    if (subErr) return NextResponse.json({ error: subErr.message }, { status: 500 })

    // Send confirmation email
    const { data: profile } = await admin.from('profiles').select('email, full_name').eq('id', user.id).single()
    if (profile?.email) {
      sendSubscriptionConfirmation({
        to: profile.email,
        name: profile.full_name || 'Grower',
        plan: 'wholesale_collection',
        billing: 'free',
        amount_cents: 0,
        gst_registered: !!gst_registered,
      }).catch(() => {})
    }

    return NextResponse.json({ ok: true, subscription: sub, requiresPayment: false })
  }

  // For hub_membership — get price from config and return for Stripe checkout
  const { data: configRows } = await admin
    .from('config')
    .select('key, value')
    .in('key', ['hub_membership_monthly_cents', 'hub_membership_seasonal_cents', 'hub_membership_annual_cents'])

  const cfg: Record<string, number> = {}
  configRows?.forEach((r: any) => { cfg[r.key] = parseInt(r.value) || 0 })

  const priceMap: Record<string, number> = {
    monthly:  cfg['hub_membership_monthly_cents']  || 6000,
    seasonal: cfg['hub_membership_seasonal_cents'] || 15000,
    annual:   cfg['hub_membership_annual_cents']   || 48000,
  }
  const amount = priceMap[billing_period] || 6000

  // Create/update the pending subscription record
  const { data: sub, error: subErr } = await admin
    .from('subscriptions')
    .upsert({
      user_id: user.id,
      subscriber_type: 'grower',
      plan: 'hub_membership',
      billing_period,
      status: 'pending',
      amount_cents: amount,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,subscriber_type,plan' })
    .select()
    .single()

  if (subErr || !sub) return NextResponse.json({ error: subErr?.message || 'Failed to save subscription' }, { status: 500 })

  // Hub Membership is a fixed-term purchase, not a recurring Stripe
  // subscription (see finalizeGrowerSubscriptionPayment — status just moves
  // to 'active' with an expires_at, same one-off PaymentIntent pattern
  // already used for order checkout). A fresh PaymentIntent is created on
  // every save so the amount always matches whatever billing period is
  // currently selected, even if the farmer changes it before paying.
  let paymentIntent
  try {
    paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency: 'aud',
      metadata: {
        type: 'grower_subscription',
        subscription_id: sub.id,
        user_id: user.id,
        billing_period,
      },
      automatic_payment_methods: { enabled: true },
    })
  } catch (stripeErr) {
    return NextResponse.json({ error: 'Payment setup failed. Please try again.' }, { status: 500 })
  }

  await admin
    .from('subscriptions')
    .update({ stripe_payment_intent_id: paymentIntent.id })
    .eq('id', sub.id)

  return NextResponse.json({
    ok: true,
    subscription: sub,
    requiresPayment: true,
    amount_cents: amount,
    client_secret: paymentIntent.client_secret,
  })
}

// DELETE — cancel the grower's active subscription
export async function DELETE() {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()

  const { data: sub } = await admin
    .from('subscriptions')
    .select('id')
    .eq('user_id', user.id)
    .eq('subscriber_type', 'grower')
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
