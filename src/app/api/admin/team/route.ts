import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { isAdminRole, isSuperAdminRole } from '@/lib/utils/permissions'

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized', status: 401 as const, userId: null, role: null }
  const admin = createAdminClient()
  const { data: profile } = await admin.from('profiles').select('role').eq('id', user.id).single()
  if (!isAdminRole(profile?.role)) return { error: 'Forbidden', status: 403 as const, userId: null, role: null }
  return { error: null, status: 200 as const, userId: user.id, role: profile?.role || '' }
}

export async function GET() {
  const { error, status } = await requireAdmin()
  if (error) return NextResponse.json({ error }, { status })

  const admin = createAdminClient()
  const { data } = await admin
    .from('profiles')
    .select('id, full_name, email, role, created_at')
    .in('role', ['admin', 'super_admin', 'platform_admin'])
    .order('created_at')

  return NextResponse.json({ data })
}

export async function POST(request: NextRequest) {
  const { error, status, role: requesterRole } = await requireAdmin()
  if (error) return NextResponse.json({ error }, { status })

  const { email, target_role } = await request.json()
  if (!email?.trim()) return NextResponse.json({ error: 'Email required' }, { status: 400 })

  const newRole = target_role || 'platform_admin'
  const validRoles = ['platform_admin', 'super_admin']
  if (!validRoles.includes(newRole)) {
    return NextResponse.json({ error: 'Invalid role. Must be platform_admin or super_admin' }, { status: 400 })
  }

  // Only super admins can promote to super_admin
  if (newRole === 'super_admin' && !isSuperAdminRole(requesterRole)) {
    return NextResponse.json({ error: 'Only Super Admins can promote to Super Admin' }, { status: 403 })
  }

  const admin = createAdminClient()
  const { data: profile, error: findError } = await admin
    .from('profiles')
    .select('id, full_name, email, role')
    .eq('email', email.trim().toLowerCase())
    .single()

  if (findError || !profile) return NextResponse.json({ error: 'No user found with that email address' }, { status: 404 })
  if (isAdminRole(profile.role)) return NextResponse.json({ error: 'This user is already in the platform team' }, { status: 400 })

  await admin.from('profiles').update({ role: newRole }).eq('id', profile.id)

  return NextResponse.json({
    success: true,
    user: { id: profile.id, full_name: profile.full_name, email: profile.email, role: newRole },
  })
}

export async function DELETE(request: NextRequest) {
  const { error, status, userId: requesterId, role: requesterRole } = await requireAdmin()
  if (error) return NextResponse.json({ error }, { status })

  const { user_id } = await request.json()
  if (!user_id) return NextResponse.json({ error: 'user_id required' }, { status: 400 })
  if (user_id === requesterId) return NextResponse.json({ error: 'You cannot remove your own admin access' }, { status: 400 })

  const admin = createAdminClient()
  const { data: target } = await admin.from('profiles').select('role').eq('id', user_id).single()

  // Only super_admin can revoke another super_admin
  if (target?.role === 'super_admin' && !isSuperAdminRole(requesterRole)) {
    return NextResponse.json({ error: 'Only Super Admins can revoke Super Admin access' }, { status: 403 })
  }

  const { count } = await admin
    .from('profiles')
    .select('*', { count: 'exact', head: true })
    .in('role', ['admin', 'super_admin', 'platform_admin'])

  if ((count || 0) <= 1) return NextResponse.json({ error: 'Cannot remove the last team member' }, { status: 400 })

  await admin.from('profiles').update({ role: 'buyer_b2c' }).eq('id', user_id)
  return NextResponse.json({ success: true })
}
