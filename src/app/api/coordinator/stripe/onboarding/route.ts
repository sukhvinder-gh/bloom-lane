// Mirrors /api/stripe/onboarding for farmers, but for a hub's own Stripe
// Connect account (see migration 040 — a grower's payout goes to their hub
// once it's connected). Plain browser navigation, so this redirects rather
// than returning JSON.

import { NextRequest, NextResponse } from 'next/server'
import { getSessionUserFromCookie, createAdminClient } from '@/lib/supabase/server'
import { createHubStripeAccount, createOnboardingLink } from '@/lib/stripe'

export async function GET(request: NextRequest) {
  const sessionUser = await getSessionUserFromCookie()
  if (!sessionUser) return NextResponse.redirect(new URL('/auth/login', request.url))

  const admin = createAdminClient()
  const { data: hub } = await admin
    .from('hubs')
    .select('id, name, stripe_account_id')
    .eq('coordinator_id', sessionUser.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!hub) return NextResponse.redirect(new URL('/dashboard/coordinator/hub/register', request.url))

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
    return NextResponse.redirect(new URL('/dashboard/coordinator/hub/register?stripe_error=1', request.url))
  }
}
