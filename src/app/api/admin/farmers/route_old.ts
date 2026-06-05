import { createAdminClient } from '@/lib/supabase/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

// Helper — confirms the calling user is an admin
async function requireAdmin() {
  const supabase = await createSupabaseServerClient()
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    return { error: 'Unauthorised', status: 401 }
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    return { error: 'Forbidden', status: 403 }
  }

  return { userId: user.id }
}

// GET /api/admin/farmers?filter=pending|approved|rejected
export async function GET(request: NextRequest) {
  const auth = await requireAdmin()
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const { searchParams } = new URL(request.url)
  const filter = searchParams.get('filter') // 'pending' | 'approved' | 'rejected' | null

  const supabase = createAdminClient() // ✅ Service role — bypasses RLS

  let query = supabase
    .from('farmers')
    .select(`
      *,
      profiles (
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
    console.error('[admin/farmers GET]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}

// PATCH /api/admin/farmers — approve or reject a farmer
// Body: { farmerId: string, status: 'approved' | 'rejected' }
export async function PATCH(request: NextRequest) {
  const auth = await requireAdmin()
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const body = await request.json()
  const { farmerId, status } = body

  if (!farmerId || !['approved', 'rejected'].includes(status)) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
  }

  const supabase = createAdminClient() // ✅ Service role — bypasses RLS

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
    console.error('[admin/farmers PATCH]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}