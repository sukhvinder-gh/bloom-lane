import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient, createAdminClient } from '@/lib/supabase/server'
import { isAdminRole } from '@/lib/utils/permissions'
import { sanitizeMarketWindows, sanitizePickupWindows, type MarketWindow } from '@/lib/utils/marketWindow'
import { sendEmail } from '@/lib/email/mailer'

const HUB_SELECT = '*, profiles!hubs_coordinator_id_fkey(full_name, email)'

// The original single-window columns stay populated from the first window so
// anything still reading them (and databases without migration 037) keeps working.
function legacyWindowColumns(windows: MarketWindow[]) {
  const first = windows[0]
  return {
    market_open_day: first?.day ?? null,
    market_open_time: first?.open ?? null,
    market_close_time: first?.close ?? null,
  }
}

async function requireAdmin() {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized', status: 401 as const }
  const admin = createAdminClient()
  const { data: profile } = await admin.from('profiles').select('role, full_name, email').eq('id', user.id).single()
  if (!isAdminRole(profile?.role)) return { error: 'Forbidden', status: 403 as const }
  return { admin, adminName: profile?.full_name || profile?.email || 'an admin' }
}

export async function GET() {
  const check = await requireAdmin()
  if ('error' in check) return NextResponse.json({ error: check.error }, { status: check.status })

  const { data, error } = await check.admin
    .from('hubs')
    .select(HUB_SELECT)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data: data || [] })
}

export async function POST(request: NextRequest) {
  const check = await requireAdmin()
  if ('error' in check) return NextResponse.json({ error: check.error }, { status: check.status })

  const { name, region, coordinator_id, market_windows, pickup_venue_name, pickup_address, pickup_suburb, pickup_state, pickup_postcode, pickup_windows } = await request.json()
  if (!name?.trim()) return NextResponse.json({ error: 'Hub name is required' }, { status: 400 })

  const windows = sanitizeMarketWindows(market_windows ?? [])
  if (typeof windows === 'string') return NextResponse.json({ error: windows }, { status: 400 })
  const pickupWindows = sanitizePickupWindows(pickup_windows ?? [])
  if (typeof pickupWindows === 'string') return NextResponse.json({ error: pickupWindows }, { status: 400 })

  const row = {
    name: name.trim(),
    region: region?.trim() || null,
    coordinator_id: coordinator_id || null,
    ...legacyWindowColumns(windows),
    pickup_venue_name: pickup_venue_name?.trim() || null,
    pickup_address: pickup_address?.trim() || null,
    pickup_suburb: pickup_suburb?.trim() || null,
    pickup_state: pickup_state?.trim() || null,
    pickup_postcode: pickup_postcode?.trim() || null,
    status: 'active',
  }
  const insertRow: Record<string, unknown> = { ...row, market_windows: windows, pickup_windows: pickupWindows }
  let { data, error } = await check.admin.from('hubs').insert(insertRow).select(HUB_SELECT).single()
  // A column from a migration that hasn't been applied yet — drop it and retry
  // rather than failing hub creation entirely over an optional field.
  while (error && /market_windows|pickup_venue_name|pickup_address|pickup_suburb|pickup_state|pickup_postcode|pickup_windows/.test(error.message)) {
    const before = Object.keys(insertRow).length
    for (const col of ['market_windows', 'pickup_venue_name', 'pickup_address', 'pickup_suburb', 'pickup_state', 'pickup_postcode', 'pickup_windows']) {
      if (error.message.includes(col)) delete insertRow[col]
    }
    if (Object.keys(insertRow).length === before) break
    ;({ data, error } = await check.admin.from('hubs').insert(insertRow).select(HUB_SELECT).single())
  }

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, hub: data })
}

export async function PATCH(request: NextRequest) {
  const check = await requireAdmin()
  if ('error' in check) return NextResponse.json({ error: check.error }, { status: check.status })

  const body = await request.json()
  const { id } = body
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  // Needed to spot a pending -> active approval, which emails the coordinator.
  let previousStatus: string | null = null
  if (body.status === 'active') {
    const { data: before } = await check.admin.from('hubs').select('status').eq('id', id).maybeSingle()
    previousStatus = before?.status ?? null
  }

  const isApproval = previousStatus === 'pending' && body.status === 'active'

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (body.status !== undefined)         updates.status         = body.status
  if (body.name  !== undefined)          updates.name           = body.name.trim()
  if (body.region !== undefined)         updates.region         = body.region?.trim() || null
  if ('coordinator_id' in body)          updates.coordinator_id = body.coordinator_id || null
  if (body.pickup_venue_name !== undefined) updates.pickup_venue_name = body.pickup_venue_name?.trim() || null
  if (body.pickup_address !== undefined)  updates.pickup_address  = body.pickup_address?.trim() || null
  if (body.pickup_suburb !== undefined)   updates.pickup_suburb   = body.pickup_suburb?.trim() || null
  if (body.pickup_state !== undefined)    updates.pickup_state    = body.pickup_state?.trim() || null
  if (body.pickup_postcode !== undefined) updates.pickup_postcode = body.pickup_postcode?.trim() || null
  let windows: MarketWindow[] | null = null
  if ('market_windows' in body) {
    const parsed = sanitizeMarketWindows(body.market_windows ?? [])
    if (typeof parsed === 'string') return NextResponse.json({ error: parsed }, { status: 400 })
    windows = parsed
    Object.assign(updates, legacyWindowColumns(parsed))
  }
  if (windows) updates.market_windows = windows
  if ('pickup_windows' in body) {
    const parsedPickup = sanitizePickupWindows(body.pickup_windows ?? [])
    if (typeof parsedPickup === 'string') return NextResponse.json({ error: parsedPickup }, { status: 400 })
    updates.pickup_windows = parsedPickup
  }
  // Snapshot who approved this and when — a plain text/timestamp pair
  // (migration 038), not a live lookup, so it still reads correctly even if
  // that admin account is later renamed or removed.
  if (isApproval) {
    updates.approved_by_name = check.adminName
    updates.approved_at = new Date().toISOString()
  }

  let { data, error } = await check.admin.from('hubs').update(updates).eq('id', id).select(HUB_SELECT).single()
  // A column from a migration that doesn't exist in this database yet —
  // drop whichever keys it's complaining about and retry, rather than
  // failing the whole request over an optional audit/scheduling/pickup field.
  const OPTIONAL_COLS = ['market_windows', 'approved_by_name', 'approved_at', 'pickup_venue_name', 'pickup_address', 'pickup_suburb', 'pickup_state', 'pickup_postcode', 'pickup_windows']
  while (error && OPTIONAL_COLS.some(col => error!.message.includes(col))) {
    const before = Object.keys(updates).length
    for (const col of OPTIONAL_COLS) {
      if (error.message.includes(col)) delete updates[col]
    }
    if (Object.keys(updates).length === before) break // nothing matched — avoid looping forever
    ;({ data, error } = await check.admin.from('hubs').update(updates).eq('id', id).select(HUB_SELECT).single())
  }

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (isApproval) {
    const coord = (data as any).profiles as { full_name: string | null; email: string | null } | null
    if (coord?.email) {
      const site = process.env.NEXT_PUBLIC_SITE_URL || 'https://bloom-lane-app.azurewebsites.net'
      const hubName = String(data.name).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      sendEmail({
        to: coord.email,
        subject: `Your hub "${data.name}" is approved`,
        html: `<p>Hi ${coord.full_name || 'Coordinator'},</p>
<p>Good news — your hub <strong>${hubName}</strong> has been approved and is now active. Growers can start joining it.</p>
<p><a href="${site}/dashboard">Go to your dashboard</a></p>
<p>— The Green Guild</p>`,
      }).catch(() => {})
    }
  }

  return NextResponse.json({ ok: true, hub: data })
}
