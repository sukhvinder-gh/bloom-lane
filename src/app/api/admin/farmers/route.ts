import { createAdminClient, createSupabaseServerClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { isAdminRole } from '@/lib/utils/permissions'

async function requireAdmin() {
  const supabase = await createSupabaseServerClient()
  const { data: { user: _authUser } } = await supabase.auth.getUser()
  if (!_authUser) return { error: 'Unauthorised', status: 401 }

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('profiles')
    .select('role')
    .eq('id', _authUser.id)
    .single()

  if (!isAdminRole(profile?.role)) return { error: 'Forbidden', status: 403 }
  return { userId: _authUser.id }
}

// GET /api/admin/farmers?filter=pending_approval|approved|suspended
export async function GET(request: NextRequest) {
  const auth = await requireAdmin()
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const { searchParams } = new URL(request.url)
  const filter = searchParams.get('filter')

  const supabase = createAdminClient()

  let query = supabase
    .from('farmers')
    .select(`
      *,
      profiles!farmers_user_id_fkey (
        id,
        email,
        full_name,
        phone
      )
    `)
    .order('created_at', { ascending: false })

  if (filter && filter !== 'all') {
    query = query.eq('status', filter)
  }

  const { data, error } = await query

  if (error) {
    console.error('[GET /api/admin/farmers]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}

// PATCH /api/admin/farmers â€” approve, suspend, or reinstate a farmer
// Body: { farmerId: string, status: 'approved' | 'suspended' }
export async function PATCH(request: NextRequest) {
  const auth = await requireAdmin()
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const body = await request.json()
  const { farmerId, status } = body

  if (!farmerId || !['approved', 'suspended'].includes(status)) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
  }

  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('farmers')
    .update({
      status,
      approved_at: status === 'approved' ? new Date().toISOString() : null,
      approved_by: status === 'approved' ? auth.userId : null,
    })
    .eq('id', farmerId)
    .select()
    .single()

  if (error) {
    console.error('[PATCH /api/admin/farmers]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}
