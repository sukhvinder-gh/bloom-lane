import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient, createAdminClient } from '@/lib/supabase/server'
import { isAdminRole } from '@/lib/utils/permissions'

export async function GET() {
  const supabase = await createSupabaseServerClient()
  const { data: { user: _authUser } } = await supabase.auth.getUser()
  if (!_authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data: profile } = await admin.from('profiles').select('role').eq('id', _authUser.id).single()
  if (!isAdminRole(profile?.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data, error } = await admin
    .from('disputes')
    .select(`
      id, reason, created_at, resolved_at, resolution_note,
      order:orders ( id, order_number, status, total_cents, created_at,
        buyer:profiles ( full_name, email )
      ),
      raised_by_profile:profiles!disputes_raised_by_fkey ( full_name, email )
    `)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

export async function PATCH(request: NextRequest) {
  const supabase = await createSupabaseServerClient()
  const { data: { user: _authUser } } = await supabase.auth.getUser()
  if (!_authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data: profile } = await admin.from('profiles').select('role').eq('id', _authUser.id).single()
  if (!isAdminRole(profile?.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { dispute_id, order_id, resolution_note, new_order_status } = await request.json()

  await admin.from('disputes').update({
    resolved_at: new Date().toISOString(),
    resolution_note: resolution_note || null,
  }).eq('id', dispute_id)

  if (new_order_status) {
    await admin.from('orders').update({ status: new_order_status }).eq('id', order_id)
  }

  return NextResponse.json({ success: true })
}
