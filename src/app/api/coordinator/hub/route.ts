import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient, createAdminClient } from '@/lib/supabase/server'
import { stripe } from '@/lib/stripe'
import { sendEmail, getAdminInbox } from '@/lib/email/mailer'

const ADMIN_ROLES = ['admin', 'platform_admin', 'super_admin']

function escapeHtml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

// GET — this coordinator's own hub(s) + their coordinator subscription, so
// the register page can show "already registered" instead of a blank form
// (previously it always showed the form, even after approval/payment,
// since nothing ever checked for an existing registration).
export async function GET() {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  // select('*') on hubs, not a named list — stripe_account_id/stripe_onboarding_complete
  // may not exist yet if migration 040 hasn't been applied, and naming an unknown
  // column explicitly makes PostgREST error the whole query instead of just omitting it.
  const [{ data: hubs }, { data: subscription }] = await Promise.all([
    admin.from('hubs').select('*').eq('coordinator_id', user.id).order('created_at', { ascending: false }),
    admin.from('subscriptions').select('*').eq('user_id', user.id).eq('subscriber_type', 'coordinator').eq('plan', 'coordinator').maybeSingle(),
  ])

  return NextResponse.json({ hubs: hubs || [], subscription: subscription || null })
}

// POST — register a new hub (coordinator).
// Self-registered hubs always start 'pending' and only go live when an admin
// approves them (Admin > Hubs). If a registration fee is configured
// (config.coordinator_registration_cents), the coordinator also pays it
// online — payment activates their coordinator subscription, but never the
// hub itself. Admins registering a hub directly are already the approvers,
// so theirs is active straight away.
export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data: profile } = await admin.from('profiles').select('role, full_name, email').eq('id', user.id).single()
  const role = profile?.role as string | undefined
  if (!role || !['coordinator', ...ADMIN_ROLES].includes(role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const isAdmin = ADMIN_ROLES.includes(role)

  const { name, region } = await request.json()
  if (!name?.trim()) return NextResponse.json({ error: 'Hub name is required' }, { status: 400 })

  const { data: cfgRow } = await admin.from('config').select('value').eq('key', 'coordinator_registration_cents').maybeSingle()
  const fee = isAdmin ? 0 : parseInt(cfgRow?.value || '0') || 0

  const { data: hub, error } = await admin
    .from('hubs')
    .insert({
      name: name.trim(),
      region: region?.trim() || null,
      coordinator_id: user.id,
      status: isAdmin ? 'active' : 'pending',
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // One coordinator subscription per account (UNIQUE user/type/plan). The fee
  // is paid once, so a coordinator who already has an active one — or a free
  // registration — needs no payment step.
  const { data: existingSub } = await admin
    .from('subscriptions')
    .select('*')
    .eq('user_id', user.id)
    .eq('subscriber_type', 'coordinator')
    .eq('plan', 'coordinator')
    .maybeSingle()

  let subscription = existingSub
  let clientSecret: string | null = null

  if (!existingSub) {
    const { data: created } = await admin
      .from('subscriptions')
      .insert({
        user_id: user.id,
        subscriber_type: 'coordinator',
        plan: 'coordinator',
        billing_period: fee > 0 ? 'annual' : 'free',
        status: fee > 0 ? 'pending' : 'active',
        amount_cents: fee,
        starts_at: fee > 0 ? null : new Date().toISOString(),
      })
      .select()
      .single()
    subscription = created
  }

  const needsPayment = fee > 0 && subscription && subscription.status !== 'active'
  if (needsPayment) {
    try {
      const pi = await stripe.paymentIntents.create({
        amount: fee,
        currency: 'aud',
        metadata: {
          type: 'coordinator_registration',
          subscription_id: subscription!.id,
          user_id: user.id,
          hub_id: hub.id,
        },
        automatic_payment_methods: { enabled: true },
      })
      clientSecret = pi.client_secret
    } catch {
      // The hub and pending subscription are saved; the coordinator can retry payment.
      return NextResponse.json({ ok: true, hub, requiresPayment: true, fee_cents: fee, client_secret: null, paymentSetupFailed: true })
    }
  }

  // Let the admins know there's a hub waiting for review. Best-effort only.
  const inbox = getAdminInbox()
  if (!isAdmin && inbox) {
    sendEmail({
      to: inbox,
      subject: `New hub awaiting approval: ${hub.name}`,
      html: `<p>${escapeHtml(profile?.full_name || profile?.email || 'A coordinator')} has registered the hub <strong>${escapeHtml(hub.name)}</strong>${hub.region ? ` (${escapeHtml(hub.region)})` : ''}.</p>
<p>Review and activate it from <strong>Admin &rarr; Hubs &amp; Collectives</strong>.</p>`,
    }).catch(() => {})
  }

  return NextResponse.json({
    ok: true,
    hub,
    requiresPayment: !!needsPayment,
    fee_cents: fee,
    client_secret: clientSecret,
    pendingApproval: hub.status === 'pending',
  })
}
