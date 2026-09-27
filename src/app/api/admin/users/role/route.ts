// src/app/api/admin/users/role/route.ts
//
// Lets an admin change a user's *business* role (grower / buyer / coordinator)
// — deliberately separate from /api/admin/team, which handles promoting or
// revoking platform-admin-tier access. Needed because there was previously no
// way to fix a mis-assigned role short of a raw SQL edit: e.g. an account
// registered years-old-and-never-confirmed, then re-registered under a
// different role, ends up stuck on whatever role its original, still-pending
// signup used (Supabase silently re-sends that original confirmation email
// instead of creating a new account or updating its metadata).

import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { isAdminRole } from '@/lib/utils/permissions'

const BUSINESS_ROLES = ['farmer', 'buyer_b2b', 'buyer_b2c', 'coordinator']

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized', status: 401 as const, role: null }
  const admin = createAdminClient()
  const { data: profile } = await admin.from('profiles').select('role').eq('id', user.id).single()
  if (!isAdminRole(profile?.role)) return { error: 'Forbidden', status: 403 as const, role: null }
  return { error: null, status: 200 as const, role: profile?.role || '' }
}

// GET /api/admin/users/role?email=... — look up a user by email
export async function GET(request: NextRequest) {
  const { error, status } = await requireAdmin()
  if (error) return NextResponse.json({ error }, { status })

  const email = request.nextUrl.searchParams.get('email')?.trim().toLowerCase()
  if (!email) return NextResponse.json({ error: 'email is required' }, { status: 400 })

  const admin = createAdminClient()
  const { data: profile, error: findError } = await admin
    .from('profiles')
    .select('id, full_name, email, role, created_at')
    .eq('email', email)
    .maybeSingle()

  if (findError) return NextResponse.json({ error: findError.message }, { status: 500 })
  if (!profile) return NextResponse.json({ error: 'No user found with that email address' }, { status: 404 })

  return NextResponse.json({ data: profile })
}

// POST /api/admin/users/role — { email, target_role }
export async function POST(request: NextRequest) {
  const { error, status } = await requireAdmin()
  if (error) return NextResponse.json({ error }, { status })

  const { email, target_role } = await request.json()
  if (!email?.trim()) return NextResponse.json({ error: 'Email required' }, { status: 400 })
  if (!BUSINESS_ROLES.includes(target_role)) {
    return NextResponse.json({ error: `target_role must be one of: ${BUSINESS_ROLES.join(', ')}` }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data: profile, error: findError } = await admin
    .from('profiles')
    .select('id, full_name, email, role')
    .eq('email', email.trim().toLowerCase())
    .maybeSingle()

  if (findError) return NextResponse.json({ error: findError.message }, { status: 500 })
  if (!profile) return NextResponse.json({ error: 'No user found with that email address' }, { status: 404 })

  // Admin-tier roles are only ever changed via /api/admin/team, which has
  // its own super-admin-only rules for promoting/revoking that access —
  // this endpoint must never be a back door around those rules.
  if (isAdminRole(profile.role)) {
    return NextResponse.json({ error: 'This user is on the platform team — change their access from Admin > Config > Team instead' }, { status: 400 })
  }

  const { data: updated, error: updateError } = await admin
    .from('profiles')
    .update({ role: target_role })
    .eq('id', profile.id)
    .select('id, full_name, email, role')
    .single()

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })

  return NextResponse.json({ success: true, user: updated })
}
