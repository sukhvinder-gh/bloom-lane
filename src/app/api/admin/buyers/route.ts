// src/app/api/admin/buyers/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const adminSupabase = await createAdminClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
    if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const filter = new URL(request.url).searchParams.get('filter') || 'all'

    let query = adminSupabase
      .from('profiles')
      .select('id, email, full_name, role, abn, abn_verified, business_name, phone, created_at')
      .in('role', ['buyer_b2b', 'buyer_b2c'])
      .order('created_at', { ascending: false })

    if (filter === 'pending') {
      query = (query as any).eq('role', 'buyer_b2b').eq('abn_verified', false)
    } else if (filter === 'verified') {
      query = (query as any).eq('role', 'buyer_b2b').eq('abn_verified', true)
    } else if (filter === 'b2c') {
      query = (query as any).eq('role', 'buyer_b2c')
    }

    const { data, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data: data || [] })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Internal error' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient()
    const adminSupabase = await createAdminClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
    if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const body = await request.json()
    const { user_id, action } = body
    if (!user_id || !action) return NextResponse.json({ error: 'user_id and action required' }, { status: 400 })

    let updates: Record<string, any> = {}
    switch (action) {
      case 'verify_abn':       updates = { abn_verified: true }; break
      case 'revoke_abn':       updates = { abn_verified: false }; break
      case 'upgrade_to_b2b':   updates = { role: 'buyer_b2b' }; break
      case 'downgrade_to_b2c': updates = { role: 'buyer_b2c', abn_verified: false }; break
      default: return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 })
    }

    const { data, error } = await adminSupabase.from('profiles').update(updates).eq('id', user_id).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Internal error' }, { status: 500 })
  }
}
