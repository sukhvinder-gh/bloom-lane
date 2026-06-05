import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient, createAdminClient } from '@/lib/supabase/server'

async function requireAdmin() {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized', status: 401, userId: null }
  const admin = createAdminClient()
  const { data: profile } = await admin.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return { error: 'Forbidden', status: 403, userId: null }
  return { error: null, status: 200, userId: user.id }
}

// GET — list all admins
export async function GET() {
  const { error, status } = await requireAdmin()
  if (error) return NextResponse.json({ error }, { status })

  const admin = createAdminClient()
  const { data } = await admin
    .from('profiles')
    .select('id, full_name, email, created_at')
    .eq('role', 'admin')
    .order('created_at')

  return NextResponse.json({ data })
}

// POST — promote a user to admin by email
export async function POST(request: NextRequest) {
  const { error, status, userId: requesterId } = await requireAdmin()
  if (error) return NextResponse.json({ error }, { status })

  const { email } = await request.json()
  if (!email?.trim()) return NextResponse.json({ error: 'Email required' }, { status: 400 })

  const admin = createAdminClient()
  const { data: profile, error: findError } = await admin
    .from('profiles')
    .select('id, full_name, email, role')
    .eq('email', email.trim().toLowerCase())
    .single()

  if (findError || !profile) return NextResponse.json({ error: 'No user found with that email address' }, { status: 404 })
  if (profile.role === 'admin') return NextResponse.json({ error: 'This user is already an admin' }, { status: 400 })

  await admin.from('profiles').update({ role: 'admin' }).eq('id', profile.id)

  return NextResponse.json({ success: true, user: { id: profile.id, full_name: profile.full_name, email: profile.email } })
}

// DELETE — revoke admin role
export async function DELETE(request: NextRequest) {
  const { error, status, userId: requesterId } = await requireAdmin()
  if (error) return NextResponse.json({ error }, { status })

  const { user_id } = await request.json()
  if (!user_id) return NextResponse.json({ error: 'user_id required' }, { status: 400 })

  // Prevent self-demotion
  if (user_id === requesterId) return NextResponse.json({ error: 'You cannot remove your own admin access' }, { status: 400 })

  // Prevent removing last admin
  const admin = createAdminClient()
  const { count } = await admin.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'admin')
  if ((count || 0) <= 1) return NextResponse.json({ error: 'Cannot remove the last admin' }, { status: 400 })

  await admin.from('profiles').update({ role: 'buyer_b2c' }).eq('id', user_id)
  return NextResponse.json({ success: true })
}
