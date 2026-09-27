// Mirrors the farmer version — Stripe's return_url after the coordinator
// finishes (or exits) hosted Connect onboarding for their hub's account.
//
// Takes an explicit ?hub_id= from the onboarding link (see
// /api/coordinator/stripe/onboarding) — a coordinator can run more than one
// hub, and falling back to "whichever hub they created most recently" here
// meant onboarding a second/third hub always silently updated the WRONG
// hub's stripe_onboarding_complete flag instead of the one just connected.
import { redirect } from 'next/navigation'
import { getSessionUserFromCookie, createAdminClient } from '@/lib/supabase/server'
import { stripe, isRecipientReadyForTransfers } from '@/lib/stripe'

export default async function CoordinatorStripeOnboardingCompletePage({
  searchParams,
}: {
  searchParams: Promise<{ hub_id?: string }>
}) {
  const { hub_id } = await searchParams
  const sessionUser = await getSessionUserFromCookie()
  if (!sessionUser) redirect('/auth/login')

  const admin = createAdminClient()
  let hubQuery = admin
    .from('hubs')
    .select('id, stripe_account_id')
    .eq('coordinator_id', sessionUser.id)
  hubQuery = hub_id
    ? hubQuery.eq('id', hub_id)
    : hubQuery.order('created_at', { ascending: false }).limit(1)
  const { data: hub } = await hubQuery.maybeSingle()

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
