import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient, createClient } from '@/lib/supabase/server'
import { sendSubscriptionExpiryWarning } from '@/lib/email/sendSubscriptionEmail'

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data: profile } = await admin.from('profiles').select('role').eq('id', user.id).single()
  if (!profile || !['admin', 'platform_admin', 'super_admin'].includes(profile.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params
  const { data: sub } = await admin
    .from('subscriptions')
    .select('plan, expires_at, profiles!subscriptions_user_id_fkey(full_name, email)')
    .eq('id', id)
    .single()

  if (!sub) return NextResponse.json({ error: 'Subscription not found' }, { status: 404 })

  const memberProfile = (sub as any).profiles
  if (!memberProfile?.email) return NextResponse.json({ error: 'No email on record' }, { status: 400 })

  await sendSubscriptionExpiryWarning({
    to: memberProfile.email,
    name: memberProfile.full_name || 'Grower',
    plan: sub.plan,
    expires_at: sub.expires_at || new Date().toISOString(),
  })

  return NextResponse.json({ ok: true })
}
