// Mirrors /api/stripe/onboarding for farmers, but for a hub's own Stripe
// Connect account (see migration 040 — a grower's payout goes to their hub
// once it's connected). Plain browser navigation, so this redirects rather
// than returning JSON.

import { NextRequest, NextResponse } from 'next/server'
import { getSessionUserFromCookie, createAdminClient } from '@/lib/supabase/server'
import { createHubStripeAccount, createOnboardingLink } from '@/lib/stripe'

export async function GET(request: NextRequest) {
  // Use forwarded headers so redirects go to the public hostname, not the
  // internal Azure container address (e.g. http://dd2d00ce69eb:8080) — see
  // the same fix already applied in auth/callback and auth/logout.
  const reqUrl = new URL(request.url)
  const host = request.headers.get('x-forwarded-host') ?? reqUrl.host
  const proto = request.headers.get('x-forwarded-proto') ?? reqUrl.protocol.replace(':', '')
  const origin = `${proto}://${host}`

  const sessionUser = await getSessionUserFromCookie()
  if (!sessionUser) return NextResponse.redirect(new URL('/auth/login', origin))

  const admin = createAdminClient()
  const { data: hub } = await admin
    .from('hubs')
    .select('id, name, stripe_account_id')
    .eq('coordinator_id', sessionUser.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!hub) return NextResponse.redirect(new URL('/dashboard/coordinator/hub/register', origin))

  try {
    let stripeAccountId = hub.stripe_account_id as string | null

    if (!stripeAccountId) {
      stripeAccountId = await createHubStripeAccount({
        email: sessionUser.email || '',
        businessName: hub.name,
      })
      await admin.from('hubs').update({ stripe_account_id: stripeAccountId }).eq('id', hub.id)
    }

    const onboardingUrl = await createOnboardingLink(stripeAccountId, hub.id, {
      refreshPath: '/dashboard/coordinator/stripe/refresh',
      returnPath: '/dashboard/coordinator/stripe/complete',
    })
    return NextResponse.redirect(onboardingUrl)
  } catch (err) {
    console.error('[Stripe onboarding] failed for hub', hub.id, err)
    const msg = err instanceof Error ? err.message : 'Unknown error'
    const url = new URL('/dashboard/coordinator/hub/register', origin)
    url.searchParams.set('stripe_error', '1')
    url.searchParams.set('stripe_error_msg', msg.slice(0, 300))
    return NextResponse.redirect(url)
  }
}
