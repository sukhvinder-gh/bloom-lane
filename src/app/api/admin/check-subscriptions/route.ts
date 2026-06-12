import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient, createAdminClient } from '@/lib/supabase/server'
import { isAdminRole } from '@/lib/utils/permissions'
import { sendSubscriptionExpiryWarning } from '@/lib/email/sendSubscriptionEmail'

// POST — check and expire subscriptions + send 7-day warnings
// Called manually from admin or by a scheduled job
export async function POST(request: NextRequest) {
  // Allow internal cron calls via secret header, or admin users
  const cronSecret = request.headers.get('x-cron-secret')
  const isInternalCron = cronSecret && cronSecret === process.env.CRON_SECRET

  if (!isInternalCron) {
    const supabase = await createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const admin = createAdminClient()
    const { data: profile } = await admin.from('profiles').select('role').eq('id', user.id).single()
    if (!isAdminRole(profile?.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const admin = createAdminClient()

  // Run the DB function to expire subscriptions and hide listings
  const { data: expiredCount, error } = await admin.rpc('disable_expired_subscriptions')
  if (error) console.error('[CRON] disable_expired_subscriptions failed:', error.message)

  // Send 7-day expiry warnings
  const in7Days = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
  const now = new Date().toISOString()

  const { data: expiringSoon } = await admin
    .from('subscriptions')
    .select('user_id, expires_at, plan, profiles!subscriptions_user_id_fkey(email, full_name)')
    .eq('status', 'active')
    .eq('subscriber_type', 'grower')
    .not('expires_at', 'is', null)
    .gt('expires_at', now)
    .lte('expires_at', in7Days)

  let warningSent = 0
  for (const sub of expiringSoon || []) {
    const p = (sub as any).profiles
    if (!p?.email) continue
    try {
      await sendSubscriptionExpiryWarning({
        to: p.email,
        name: p.full_name || 'Grower',
        plan: sub.plan,
        expires_at: sub.expires_at!,
      })
      warningSent++
    } catch (err: any) {
      console.error('[CRON] expiry warning failed for', p.email, err.message)
    }
  }

  return NextResponse.json({ ok: true, expired: expiredCount ?? 0, warnings_sent: warningSent })
}
