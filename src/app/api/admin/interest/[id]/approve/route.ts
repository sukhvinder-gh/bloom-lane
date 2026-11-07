import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient, createAdminClient } from '@/lib/supabase/server'
import { isAdminRole } from '@/lib/utils/permissions'
import { validateABNFormat } from '@/lib/utils/abn'
import { sendApprovalWelcomeEmail } from '@/lib/email/sendApprovalWelcomeEmail'
import crypto from 'crypto'

async function requireAdmin() {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized', status: 401 as const }
  const admin = createAdminClient()
  const { data: profile } = await admin.from('profiles').select('role').eq('id', user.id).single()
  if (!isAdminRole(profile?.role)) return { error: 'Forbidden', status: 403 as const }
  return { admin, userId: user.id }
}

function generateTempPassword() {
  // base64url is alnum + "-_" — always satisfies Supabase's min-length-8
  // password rule, no character-class juggling needed.
  return crypto.randomBytes(9).toString('base64url')
}

// POST — convert one interest_registrations row into a real account: creates
// the auth user + profile (and, for growers, the farmers row), emails the
// person a temporary password, and marks the row as converted so "Approve"
// can't be clicked twice.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const check = await requireAdmin()
  if ('error' in check) return NextResponse.json({ error: check.error }, { status: check.status })
  const { admin, userId } = check

  const { id } = await params
  const body = await request.json().catch(() => ({}))

  const { data: interest, error: fetchError } = await admin
    .from('interest_registrations')
    .select('*')
    .eq('id', id)
    .single()

  if (fetchError || !interest) {
    return NextResponse.json({ error: 'Interest registration not found' }, { status: 404 })
  }
  if (interest.converted_user_id) {
    return NextResponse.json({ error: 'This person already has an account' }, { status: 409 })
  }

  const { data: existingProfile } = await admin
    .from('profiles')
    .select('id')
    .eq('email', interest.email)
    .maybeSingle()
  if (existingProfile) {
    return NextResponse.json({ error: 'An account with this email already exists' }, { status: 409 })
  }

  const targetRole: 'farmer' | 'buyer_b2b' = interest.role === 'grower' ? 'farmer' : 'buyer_b2b'

  let farmerFields: { business_name: string; abn: string; address: string; suburb: string; state: string; postcode: string } | null = null
  if (targetRole === 'farmer') {
    const business_name = String(body.business_name || interest.business_name || '').trim()
    const abn = String(body.abn || '').trim()
    const address = String(body.address || '').trim()
    const suburb = String(body.suburb || '').trim()
    const state = String(body.state || '').trim()
    const postcode = String(body.postcode || '').trim()

    if (!business_name) return NextResponse.json({ error: 'Business name is required' }, { status: 400 })
    if (!validateABNFormat(abn)) return NextResponse.json({ error: 'A valid 11-digit ABN is required' }, { status: 400 })
    if (!address || !suburb || !state || !postcode) {
      return NextResponse.json({ error: 'Address, suburb, state, and postcode are required' }, { status: 400 })
    }
    farmerFields = { business_name, abn, address, suburb, state, postcode }
  }

  const tempPassword = generateTempPassword()

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email: interest.email,
    password: tempPassword,
    email_confirm: true,
    user_metadata: { role: targetRole, full_name: interest.full_name },
  })
  if (createError || !created.user) {
    return NextResponse.json({ error: createError?.message || 'Failed to create account' }, { status: 500 })
  }
  const newUserId = created.user.id

  // handle_new_user() only sets id/email/full_name/role — business_name and
  // phone from the interest row still need writing onto the profile here.
  const { error: profileError } = await admin
    .from('profiles')
    .update({
      business_name: interest.business_name || farmerFields?.business_name || null,
      phone: interest.phone || null,
    })
    .eq('id', newUserId)

  if (profileError) {
    await admin.auth.admin.deleteUser(newUserId)
    return NextResponse.json({ error: `Account rolled back: ${profileError.message}` }, { status: 500 })
  }

  if (targetRole === 'farmer' && farmerFields) {
    const { error: farmerError } = await admin.from('farmers').insert({
      user_id: newUserId,
      ...farmerFields,
      status: 'approved',
      approved_at: new Date().toISOString(),
      approved_by: userId,
    })
    if (farmerError) {
      await admin.auth.admin.deleteUser(newUserId)
      return NextResponse.json({ error: `Account rolled back: ${farmerError.message}` }, { status: 500 })
    }
  }

  await admin
    .from('interest_registrations')
    .update({ converted_user_id: newUserId, converted_at: new Date().toISOString(), contacted: true })
    .eq('id', id)

  try {
    await sendApprovalWelcomeEmail({
      to: interest.email,
      fullName: interest.full_name,
      role: targetRole,
      tempPassword,
    })
  } catch (emailError) {
    console.error('[approve interest] welcome email failed to send:', emailError)
    // Account is already created — surface the temp password in the response
    // so the admin can hand it over manually instead of the approval failing.
    return NextResponse.json({
      data: { userId: newUserId, tempPassword, emailSent: false },
      warning: 'Account created, but the welcome email failed to send. Share this temporary password with them directly.',
    })
  }

  return NextResponse.json({ data: { userId: newUserId, tempPassword, emailSent: true } })
}
