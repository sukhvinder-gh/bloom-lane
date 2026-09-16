// Stripe's return_url after the farmer finishes (or exits) hosted Connect
// onboarding. Stripe doesn't tell us the outcome via the redirect itself —
// we have to ask the Accounts API directly whether onboarding actually
// completed before marking stripe_onboarding_complete.
import { redirect } from 'next/navigation'
import { getSessionUserFromCookie, createAdminClient } from '@/lib/supabase/server'
import { stripe } from '@/lib/stripe'

export default async function StripeOnboardingCompletePage() {
  const sessionUser = await getSessionUserFromCookie()
  if (!sessionUser) redirect('/auth/login')

  const admin = createAdminClient()
  const { data: farmer } = await admin
    .from('farmers')
    .select('id, stripe_account_id')
    .eq('user_id', sessionUser.id)
    .maybeSingle()

  if (!farmer?.stripe_account_id) redirect('/dashboard/farmer/payouts')

  try {
    const account = await stripe.accounts.retrieve(farmer.stripe_account_id)
    const complete = !!account.details_submitted && !!account.charges_enabled && !!account.payouts_enabled
    await admin.from('farmers').update({ stripe_onboarding_complete: complete }).eq('id', farmer.id)
  } catch (err) {
    console.error('[Stripe onboarding complete] account retrieve failed for farmer', farmer.id, err)
  }

  redirect('/dashboard/farmer/payouts')
}
