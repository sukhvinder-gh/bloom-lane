import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient, createAdminClient } from '@/lib/supabase/server'
import { isAdminRole } from '@/lib/utils/permissions'
import { sanitizeMarketWindows, type MarketWindow } from '@/lib/utils/marketWindow'

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
  const { data: profile } = await admin.from('profiles').select('role').eq('id', user.id).single()
  if (!isAdminRole(profile?.role)) return { error: 'Forbidden', status: 403 as const }
  return { admin }
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

  let { data, error } = await check.admin
    .from('hubs')
    .update(windows ? { ...updates, market_windows: windows } : updates)
    .eq('id', id)
    .select(HUB_SELECT)
    .single()
  // Migration 037 not applied yet: fall back to saving just the first window.
  if (error && windows && /market_windows/.test(error.message)) {
    ;({ data, error } = await check.admin.from('hubs').update(updates).eq('id', id).select(HUB_SELECT).single())
  }

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, hub: data })
}
