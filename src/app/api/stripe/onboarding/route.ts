// src/app/api/stripe/onboarding/route.ts
//
// Linked from the farmer Payouts page's "Connect your bank account" /
// "Continue Setup" button — that link previously went nowhere (this route
// didn't exist), so no farmer could ever complete Stripe Connect onboarding
// even though the account-creation and onboarding-link helpers were already
// written (src/lib/stripe/index.ts). A plain browser navigation, so this
// responds with a redirect, not JSON.
//
// The "Update bank details" link on an already-connected account hits this
// same route — Stripe rejects the v2 'account_update' link type outright for
// this platform account ("Valid types for this account are
// [account_onboarding]", confirmed by a live test call), so re-running
// 'account_onboarding' is the only option; Stripe's hosted flow just shows
// the account's existing details in an editable form when nothing is
// outstanding, rather than erroring or re-collecting from scratch.

import { NextRequest, NextResponse } from 'next/server'
import { getSessionUserFromCookie, createAdminClient } from '@/lib/supabase/server'
import { createFarmerStripeAccount, createOnboardingLink } from '@/lib/stripe'

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
  const { data: farmer } = await admin
    .from('farmers')
    .select('id, business_name, abn, email, stripe_account_id')
    .eq('user_id', sessionUser.id)
    .maybeSingle()

  if (!farmer) return NextResponse.redirect(new URL('/dashboard/farmer/storefront', origin))

  try {
    let stripeAccountId = farmer.stripe_account_id as string | null

    if (!stripeAccountId) {
      stripeAccountId = await createFarmerStripeAccount({
        email: farmer.email || sessionUser.email || '',
        businessName: farmer.business_name,
        abn: farmer.abn,
      })
      await admin.from('farmers').update({ stripe_account_id: stripeAccountId }).eq('id', farmer.id)
    }

    const onboardingUrl = await createOnboardingLink(stripeAccountId, farmer.id)
    return NextResponse.redirect(onboardingUrl)
  } catch (err) {
    console.error('[Stripe onboarding] failed for farmer', farmer.id, err)
    const msg = err instanceof Error ? err.message : 'Unknown error'
    const url = new URL('/dashboard/farmer/payouts', origin)
    url.searchParams.set('stripe_error', '1')
    url.searchParams.set('stripe_error_msg', msg.slice(0, 300))
    return NextResponse.redirect(url)
  }
}
