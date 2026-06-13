import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient, createClient } from '@/lib/supabase/server'

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const admin = createAdminClient()
  const { data: profile } = await admin.from('profiles').select('role').eq('id', user.id).single()
  if (!profile || !['admin', 'platform_admin', 'super_admin'].includes(profile.role)) return null
  return { user, admin }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin()
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { id } = await params
  const { action, days = 30 } = await request.json()

  if (action === 'extend') {
    const { data: sub } = await auth.admin.from('subscriptions').select('expires_at, status').eq('id', id).single()
    if (!sub) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const base = sub.expires_at && new Date(sub.expires_at) > new Date()
      ? new Date(sub.expires_at)
      : new Date()
    base.setDate(base.getDate() + days)

    const { data, error } = await auth.admin.from('subscriptions')
      .update({ expires_at: base.toISOString(), status: 'active', updated_at: new Date().toISOString() })
      .eq('id', id).select().single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ subscription: data })
  }

  if (action === 'approve') {
    const { data: sub } = await auth.admin.from('subscriptions')
      .select('starts_at, billing_period')
      .eq('id', id).single()
    if (!sub) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const startsAt = sub.starts_at ? new Date(sub.starts_at) : new Date()
    const DAYS: Record<string, number> = { weekly: 7, monthly: 30, seasonal: 90, annual: 365 }
    const daysToAdd = sub.billing_period ? (DAYS[sub.billing_period] ?? null) : null
    const expiresAt = daysToAdd
      ? new Date(startsAt.getTime() + daysToAdd * 86400000).toISOString()
      : null

    const { data, error } = await auth.admin.from('subscriptions')
      .update({
        status: 'active',
        starts_at: startsAt.toISOString(),
        expires_at: expiresAt,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id).select().single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ subscription: data })
  }

  if (action === 'cancel') {
    const { data, error } = await auth.admin.from('subscriptions')
      .update({ status: 'cancelled', updated_at: new Date().toISOString() })
      .eq('id', id).select().single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ subscription: data })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
