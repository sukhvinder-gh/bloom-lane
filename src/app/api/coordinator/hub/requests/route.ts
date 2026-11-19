import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient, createAdminClient } from '@/lib/supabase/server'
import { isAdminRole } from '@/lib/utils/permissions'
import { sendEmail } from '@/lib/email/mailer'

function escapeHtml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

async function requireCoordinator(hubId: string) {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized', status: 401 as const }

  const admin = createAdminClient()
  const { data: profile } = await admin.from('profiles').select('role').eq('id', user.id).single()
  if (isAdminRole(profile?.role)) return { admin }

  const { data: hub } = await admin.from('hubs').select('id').eq('id', hubId).eq('coordinator_id', user.id).maybeSingle()
  if (!hub) return { error: 'Forbidden', status: 403 as const }
  return { admin }
}

// GET — every grower who's picked this hub as a collection point, pending
// requests first, so the coordinator sees what needs a decision before
// their already-settled ones.
export async function GET(request: NextRequest) {
  const hubId = request.nextUrl.searchParams.get('hub_id') || ''
  if (!hubId) return NextResponse.json({ error: 'hub_id is required' }, { status: 400 })

  const check = await requireCoordinator(hubId)
  if ('error' in check) return NextResponse.json({ error: check.error }, { status: check.status })
  const { admin } = check

  const { data, error } = await admin
    .from('farmer_fulfillment_options')
    .select('id, status, created_at, farmers(business_name, email, region, suburb, state)')
    .eq('hub_id', hubId)
    .eq('type', 'collection_point')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Pending requests need a decision, so they lead; settled ones trail.
  const order: Record<string, number> = { pending: 0, approved: 1, declined: 2 }
  const sorted = [...(data || [])].sort((a: any, b: any) => (order[a.status] ?? 9) - (order[b.status] ?? 9))

  return NextResponse.json({ data: sorted })
}

// PATCH — approve or decline a grower's collection-point request.
export async function PATCH(request: NextRequest) {
  const { hub_id, option_id, status } = await request.json()
  if (!hub_id || !option_id || !['approved', 'declined'].includes(status)) {
    return NextResponse.json({ error: 'hub_id, option_id and a valid status are required' }, { status: 400 })
  }

  const check = await requireCoordinator(hub_id)
  if ('error' in check) return NextResponse.json({ error: check.error }, { status: check.status })
  const { admin } = check

  const { data: hub } = await admin.from('hubs').select('name').eq('id', hub_id).single()

  const { data: updated, error } = await admin
    .from('farmer_fulfillment_options')
    .update({ status })
    .eq('id', option_id)
    .eq('hub_id', hub_id)
    .eq('type', 'collection_point')
    .select('id, farmers(business_name, email)')
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!updated) return NextResponse.json({ error: 'Request not found for this hub' }, { status: 404 })

  const farmerEmail = (updated as any).farmers?.email
  if (farmerEmail) {
    const hubName = hub?.name || 'the hub'
    const subject = status === 'approved'
      ? `${hubName} approved your collection point request`
      : `${hubName} declined your collection point request`
    const html = status === 'approved'
      ? `<p>Good news — <strong>${escapeHtml(hubName)}</strong> has approved your request to use them as a collection point. Buyers can now choose this pickup option on your products.</p>`
      : `<p><strong>${escapeHtml(hubName)}</strong> has declined your request to use them as a collection point. You can pick a different hub, or ask them to reconsider, from your Storefront page.</p>`
    sendEmail({ to: farmerEmail, subject, html }).catch(() => {})
  }

  return NextResponse.json({ ok: true })
}
