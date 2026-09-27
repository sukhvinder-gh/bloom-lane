// Mirrors the farmer version — Stripe's return_url after the coordinator
// finishes (or exits) hosted Connect onboarding for their hub's account.
import { redirect } from 'next/navigation'
import { getSessionUserFromCookie, createAdminClient } from '@/lib/supabase/server'
import { stripe, isRecipientReadyForTransfers } from '@/lib/stripe'

export default async function CoordinatorStripeOnboardingCompletePage() {
  const sessionUser = await getSessionUserFromCookie()
  if (!sessionUser) redirect('/auth/login')

  const admin = createAdminClient()
  const { data: hub } = await admin
    .from('hubs')
    .select('id, stripe_account_id')
    .eq('coordinator_id', sessionUser.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!hub?.stripe_account_id) redirect('/dashboard/coordinator/hub/register')

  try {
    const account = await stripe.v2.core.accounts.retrieve(hub.stripe_account_id, { include: ['configuration.recipient'] })
    const complete = isRecipientReadyForTransfers(account)
    await admin.from('hubs').update({ stripe_onboarding_complete: complete }).eq('id', hub.id)
  } catch (err) {
    console.error('[Stripe onboarding complete] account retrieve failed for hub', hub.id, err)
  }

  redirect('/dashboard/coordinator/hub/register')
}
