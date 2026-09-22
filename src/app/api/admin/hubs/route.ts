import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient, createAdminClient } from '@/lib/supabase/server'
import { isAdminRole } from '@/lib/utils/permissions'
import { sanitizeMarketWindows, type MarketWindow } from '@/lib/utils/marketWindow'
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

  const { name, region, coordinator_id, market_windows } = await request.json()
  if (!name?.trim()) return NextResponse.json({ error: 'Hub name is required' }, { status: 400 })

  const windows = sanitizeMarketWindows(market_windows ?? [])
  if (typeof windows === 'string') return NextResponse.json({ error: windows }, { status: 400 })

  const row = {
    name: name.trim(),
    region: region?.trim() || null,
    coordinator_id: coordinator_id || null,
    ...legacyWindowColumns(windows),
    status: 'active',
  }
  let { data, error } = await check.admin.from('hubs').insert({ ...row, market_windows: windows }).select(HUB_SELECT).single()
  // Migration 037 not applied yet: fall back to saving just the first window.
  if (error && /market_windows/.test(error.message)) {
    ;({ data, error } = await check.admin.from('hubs').insert(row).select(HUB_SELECT).single())
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
  let windows: MarketWindow[] | null = null
  if ('market_windows' in body) {
    const parsed = sanitizeMarketWindows(body.market_windows ?? [])
    if (typeof parsed === 'string') return NextResponse.json({ error: parsed }, { status: 400 })
    windows = parsed
    Object.assign(updates, legacyWindowColumns(parsed))
  }
  if (windows) updates.market_windows = windows
  // Snapshot who approved this and when — a plain text/timestamp pair
  // (migration 038), not a live lookup, so it still reads correctly even if
  // that admin account is later renamed or removed.
  if (isApproval) {
    updates.approved_by_name = check.adminName
    updates.approved_at = new Date().toISOString()
  }

  let { data, error } = await check.admin.from('hubs').update(updates).eq('id', id).select(HUB_SELECT).single()
  // A column from migration 037 or 038 doesn't exist in this database yet —
  // drop whichever keys it's complaining about and retry, rather than
  // failing the whole request over an optional audit/scheduling field.
  while (error && /market_windows|approved_by_name|approved_at/.test(error.message)) {
    const before = Object.keys(updates).length
    for (const col of ['market_windows', 'approved_by_name', 'approved_at']) {
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
