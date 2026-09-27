// Mirrors /api/stripe/onboarding for farmers, but for a hub's own Stripe
// Connect account (see migration 040 — a grower's payout goes to their hub
// once it's connected). Plain browser navigation, so this redirects rather
// than returning JSON.
//
// Takes an explicit ?hub_id= — a coordinator can run more than one hub, and
// picking "whichever hub this coordinator created most recently" silently
// meant every hub past their first could never be individually connected at
// all: the "Connect Payout Account" button only ever set up that one most-
// recent hub, while every other one of theirs stayed permanently
// unconnected with no way to select it. Falls back to the most-recent hub
// only when hub_id is omitted, for old links/bookmarks.

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
  const requestedHubId = reqUrl.searchParams.get('hub_id')

  const sessionUser = await getSessionUserFromCookie()
  if (!sessionUser) return NextResponse.redirect(new URL('/auth/login', origin))

  const admin = createAdminClient()
  let hubQuery = admin
    .from('hubs')
    .select('id, name, stripe_account_id')
    .eq('coordinator_id', sessionUser.id)
  hubQuery = requestedHubId
    ? hubQuery.eq('id', requestedHubId)
    : hubQuery.order('created_at', { ascending: false }).limit(1)
  const { data: hub } = await hubQuery.maybeSingle()

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
      refreshPath: `/dashboard/coordinator/stripe/refresh?hub_id=${hub.id}`,
      returnPath: `/dashboard/coordinator/stripe/complete?hub_id=${hub.id}`,
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
