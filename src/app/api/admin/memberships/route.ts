import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient, createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data: profile } = await admin.from('profiles').select('role').eq('id', user.id).single()
  if (!profile || !['admin', 'platform_admin', 'super_admin'].includes(profile.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const type = new URL(request.url).searchParams.get('type') ?? 'grower'
  const subscriberType = type === 'florist' ? 'florist' : 'grower'

  const { data: subs, error } = await admin
    .from('subscriptions')
    .select(`
      id, plan, billing_period, status, starts_at, expires_at, amount_cents, created_at,
      profiles!subscriptions_user_id_fkey(id, full_name, email)
    `)
    .eq('subscriber_type', subscriberType)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // For growers, also pull business_name from farmers table
  let farmerMap: Record<string, string> = {}
  if (subscriberType === 'grower' && subs && subs.length > 0) {
    const userIds = subs.map((s: any) => s.profiles?.id).filter(Boolean)
    const { data: farmers } = await admin
      .from('farmers')
      .select('user_id, business_name')
      .in('user_id', userIds)
    farmers?.forEach((f: any) => { farmerMap[f.user_id] = f.business_name })
  }

  const rows = (subs ?? []).map((s: any) => ({
    id: s.id,
    user_id: s.profiles?.id,
    name: farmerMap[s.profiles?.id] || s.profiles?.full_name || '—',
    email: s.profiles?.email || '—',
    plan: s.plan,
    billing_period: s.billing_period,
    status: s.status,
    starts_at: s.starts_at,
    expires_at: s.expires_at,
    amount_cents: s.amount_cents,
    created_at: s.created_at,
  }))

  return NextResponse.json({ rows })
}
