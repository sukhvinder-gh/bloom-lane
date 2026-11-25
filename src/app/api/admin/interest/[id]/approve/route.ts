import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient, createAdminClient } from '@/lib/supabase/server'
import { isAdminRole } from '@/lib/utils/permissions'
import { validateABNFormat } from '@/lib/utils/abn'
import { sendApprovalWelcomeEmail } from '@/lib/email/sendApprovalWelcomeEmail'
import { grantFreeGrowerMembership } from '@/lib/utils/membership'
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
  // Admin's approve dialog shows this as a ticked-by-default checkbox for
  // grower approvals — opt-in rather than forced, so admin can still hold
  // it back for a specific case, but defaults true if the field is omitted
  // entirely (e.g. a direct API call).
  const grantMembership = body.grant_free_membership !== false

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
    .select('id, role, secondary_role')
    .eq('email', interest.email)
    .maybeSingle()

  // Someone can already have an account by the time admin gets to this row —
  // either because they signed up directly, or (the common case now) because
  // this interest row is a request to add a SECOND role onto an account they
  // already hold. No new user/email is created either way; instead we grant
  // the requested role onto the existing profile. Grower is always treated
  // as the account's primary/default role when both exist — if the account's
  // current primary role is a plain buyer, it gets promoted to 'farmer' and
  // the old buyer role moves into secondary_role; a buyer role being added to
  // an existing grower (or admin/coordinator) account just becomes additive
  // via secondary_role, leaving the primary role untouched.
  if (existingProfile) {
    const currentRole = existingProfile.role || ''
    const currentSecondary = existingProfile.secondary_role || null

    if (interest.role === 'grower') {
      const { data: existingFarmer } = await admin.from('farmers').select('id').eq('user_id', existingProfile.id).maybeSingle()
      const alreadyGrower = !!existingFarmer || currentRole === 'farmer' || currentSecondary === 'farmer'
      if (alreadyGrower) {
        return NextResponse.json({ error: 'This account is already registered as a grower.' }, { status: 409 })
      }

      const business_name = String(body.business_name || interest.business_name || '').trim()
      const abn = String(body.abn || interest.abn || '').trim()
      const address = String(body.address || '').trim()
      const suburb = String(body.suburb || '').trim()
      const state = String(body.state || interest.state || '').trim()
      const postcode = String(body.postcode || interest.postcode || '').trim()

      if (!business_name) return NextResponse.json({ error: 'Business name is required' }, { status: 400 })
      if (!validateABNFormat(abn)) return NextResponse.json({ error: 'A valid 11-digit ABN is required' }, { status: 400 })
      if (!address || !suburb || !state || !postcode) {
        return NextResponse.json({ error: 'Address, suburb, state, and postcode are required' }, { status: 400 })
      }

      const { error: farmerError } = await admin.from('farmers').insert({
        user_id: existingProfile.id,
        business_name, abn, address, suburb, state, postcode,
        status: 'approved',
        approved_at: new Date().toISOString(),
        approved_by: userId,
      })
      if (farmerError) return NextResponse.json({ error: `Could not add grower role: ${farmerError.message}` }, { status: 500 })

      if (grantMembership) {
        const { error: membershipError } = await grantFreeGrowerMembership(admin, existingProfile.id)
        if (membershipError) console.error('[approve interest] free membership grant failed:', membershipError)
      }

      const promoteToPrimary = currentRole === 'buyer_b2b' || currentRole === 'buyer_b2c'
      await admin.from('profiles').update({
        ...(promoteToPrimary ? { role: 'farmer', secondary_role: currentRole } : {}),
        business_name: business_name || undefined,
      }).eq('id', existingProfile.id)
    } else {
      const BUYER_ROLES = ['buyer_b2b', 'buyer_b2c']
      const alreadyBuyer = BUYER_ROLES.includes(currentRole) || BUYER_ROLES.includes(currentSecondary || '')
      if (alreadyBuyer) {
        return NextResponse.json({ error: 'This account is already registered as a buyer.' }, { status: 409 })
      }

      const abn = String(body.abn || interest.abn || '').trim()
      if (abn && !validateABNFormat(abn)) {
        return NextResponse.json({ error: 'ABN must be a valid 11-digit number' }, { status: 400 })
      }

      const updates: Record<string, unknown> = { secondary_role: 'buyer_b2b' }
      if (abn) updates.abn = abn
      await admin.from('profiles').update(updates).eq('id', existingProfile.id)
    }

    await admin
      .from('interest_registrations')
      .update({ converted_user_id: existingProfile.id, converted_at: new Date().toISOString(), contacted: true })
      .eq('id', id)

    return NextResponse.json({
      data: {
        userId: existingProfile.id, tempPassword: null, emailSent: false, addedSecondRole: true,
        membershipGranted: interest.role === 'grower' && grantMembership,
      },
      warning: 'This email already had an account — no new account or welcome email was created. The requested role was added to their existing account instead.',
    })
  }

  const targetRole: 'farmer' | 'buyer_b2b' = interest.role === 'grower' ? 'farmer' : 'buyer_b2b'

  let buyerAbn: string | null = null
  if (targetRole === 'buyer_b2b') {
    const abn = String(body.abn || interest.abn || '').trim()
    if (abn && !validateABNFormat(abn)) {
      return NextResponse.json({ error: 'ABN must be a valid 11-digit number' }, { status: 400 })
    }
    buyerAbn = abn || null
  }

  let farmerFields: { business_name: string; abn: string; address: string; suburb: string; state: string; postcode: string } | null = null
  if (targetRole === 'farmer') {
    const business_name = String(body.business_name || interest.business_name || '').trim()
    const abn = String(body.abn || interest.abn || '').trim()
    const address = String(body.address || '').trim()
    const suburb = String(body.suburb || '').trim()
    const state = String(body.state || interest.state || '').trim()
    const postcode = String(body.postcode || interest.postcode || '').trim()

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
      abn: buyerAbn,
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

    if (grantMembership) {
      const { error: membershipError } = await grantFreeGrowerMembership(admin, newUserId)
      if (membershipError) console.error('[approve interest] free membership grant failed:', membershipError)
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
      data: { userId: newUserId, tempPassword, emailSent: false, membershipGranted: targetRole === 'farmer' && grantMembership },
      warning: 'Account created, but the welcome email failed to send. Share this temporary password with them directly.',
    })
  }

  return NextResponse.json({ data: { userId: newUserId, tempPassword, emailSent: true, membershipGranted: targetRole === 'farmer' && grantMembership } })
}
