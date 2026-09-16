// src/app/api/stripe/onboarding/route.ts
//
// Linked from the farmer Payouts page's "Connect your bank account" /
// "Continue Setup" button — that link previously went nowhere (this route
// didn't exist), so no farmer could ever complete Stripe Connect onboarding
// even though the account-creation and onboarding-link helpers were already
// written (src/lib/stripe/index.ts). A plain browser navigation, so this
// responds with a redirect, not JSON.

import { NextRequest, NextResponse } from 'next/server'
import { getSessionUserFromCookie, createAdminClient } from '@/lib/supabase/server'
import { createFarmerStripeAccount, createOnboardingLink } from '@/lib/stripe'

export async function GET(request: NextRequest) {
  const sessionUser = await getSessionUserFromCookie()
  if (!sessionUser) return NextResponse.redirect(new URL('/auth/login', request.url))

  const admin = createAdminClient()
  const { data: farmer } = await admin
    .from('farmers')
    .select('id, business_name, abn, email, stripe_account_id')
    .eq('user_id', sessionUser.id)
    .maybeSingle()

  if (!farmer) return NextResponse.redirect(new URL('/dashboard/farmer/storefront', request.url))

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
    return NextResponse.redirect(new URL('/dashboard/farmer/payouts?stripe_error=1', request.url))
  }
}
