// src/lib/subscriptions/finalizeCoordinatorRegistrationPayment.ts
// Marks a coordinator's registration fee as paid once its PaymentIntent
// succeeds. The hub itself is NOT activated here — self-registered hubs
// always wait for an admin to approve them (see /api/admin/hubs PATCH), so
// payment only moves the coordinator subscription to 'active'.

import { createAdminClient } from '@/lib/supabase/server'
import { addYears } from 'date-fns'

export async function finalizeCoordinatorRegistrationPayment(
  supabase: ReturnType<typeof createAdminClient>,
  paymentIntent: { id: string; metadata?: Record<string, string> }
) {
  const subscriptionId = paymentIntent.metadata?.subscription_id
  if (!subscriptionId) {
    console.error('coordinator_registration payment_intent.succeeded missing subscription_id in metadata')
    return
  }

  // select('*') so this never depends on optional columns existing.
  const { data: sub } = await supabase.from('subscriptions').select('*').eq('id', subscriptionId).single()
  if (!sub || sub.status === 'active') return

  const now = new Date()
  await supabase
    .from('subscriptions')
    .update({
      status: 'active',
      starts_at: now.toISOString(),
      expires_at: addYears(now, 1).toISOString(),
      updated_at: now.toISOString(),
    })
    .eq('id', subscriptionId)
}
