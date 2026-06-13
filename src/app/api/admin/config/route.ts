import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient, createAdminClient } from '@/lib/supabase/server'
import { isAdminRole, canEditConfigKey } from '@/lib/utils/permissions'

async function requireAdminWithRole() {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized', status: 401 as const }
  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('profiles')
    .select('role, full_name')
    .eq('id', user.id)
    .single()
  if (!isAdminRole(profile?.role)) return { error: 'Forbidden', status: 403 as const }
  return { userId: user.id, role: profile!.role as string, name: profile!.full_name as string | null, admin }
}

// Apply any scheduled changes whose effective_from has passed
async function applyPendingScheduled(admin: ReturnType<typeof createAdminClient>) {
  const { data: pending } = await admin
    .from('config_history')
    .select('id, key, value')
    .eq('status', 'scheduled')
    .lte('effective_from', new Date().toISOString())

  for (const entry of pending ?? []) {
    await admin
      .from('config')
      .upsert({ key: entry.key, value: entry.value, updated_at: new Date().toISOString() }, { onConflict: 'key' })
    await admin
      .from('config_history')
      .update({ status: 'applied' })
      .eq('id', entry.id)
  }
}

export async function GET() {
  const auth = await requireAdminWithRole()
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const { admin } = auth

  await applyPendingScheduled(admin)

  const [configRes, appliedRes, scheduledRes] = await Promise.all([
    admin.from('config').select('key, value'),
    // Latest applied history entry per key
    admin
      .from('config_history')
      .select('key, set_by_name, created_at')
      .eq('status', 'applied')
      .order('created_at', { ascending: false }),
    // Active scheduled changes
    admin
      .from('config_history')
      .select('id, key, value, effective_from, set_by_name')
      .eq('status', 'scheduled')
      .order('effective_from', { ascending: true }),
  ])

  // Build config map
  const configMap: Record<string, string> = {}
  for (const row of configRes.data ?? []) configMap[row.key] = row.value

  // Build history map — only keep the most-recent applied entry per key
  const lastApplied: Record<string, { set_by_name: string | null; created_at: string }> = {}
  for (const row of appliedRes.data ?? []) {
    if (!lastApplied[row.key]) {
      lastApplied[row.key] = { set_by_name: row.set_by_name, created_at: row.created_at }
    }
  }

  // Build scheduled map — latest scheduled per key
  const scheduled: Record<string, { id: string; value: string; effective_from: string; set_by_name: string | null }> = {}
  for (const row of scheduledRes.data ?? []) {
    if (!scheduled[row.key]) {
      scheduled[row.key] = { id: row.id, value: row.value, effective_from: row.effective_from, set_by_name: row.set_by_name }
    }
  }

  // Also expose as flat array for legacy consumers (membership page etc.)
  const data = Object.entries(configMap).map(([key, value]) => ({ key, value }))

  return NextResponse.json({ data, config: configMap, history: { lastApplied, scheduled } })
}

export async function PATCH(request: NextRequest) {
  const auth = await requireAdminWithRole()
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const { userId, role, name, admin } = auth

  const body = await request.json()
  const { key, value, effective_from } = body

  if (!key || value === undefined || value === null) {
    return NextResponse.json({ error: 'key and value are required' }, { status: 400 })
  }
  if (!canEditConfigKey(key, role)) {
    return NextResponse.json({ error: 'Your role cannot edit this setting' }, { status: 403 })
  }

  const isScheduled = effective_from && new Date(effective_from) > new Date()

  // Fetch current value for the audit record
  const { data: currentRow } = await admin.from('config').select('value').eq('key', key).single()
  const previousValue = currentRow?.value ?? null

  // Supersede any existing scheduled entry for this key
  await admin
    .from('config_history')
    .update({ status: 'superseded' })
    .eq('key', key)
    .eq('status', 'scheduled')

  if (isScheduled) {
    // Schedule only — do not update live config yet
    const { error } = await admin.from('config_history').insert({
      key,
      value: String(value),
      previous_value: previousValue,
      effective_from,
      status: 'scheduled',
      set_by: userId,
      set_by_name: name,
    })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, scheduled: true, effective_from })
  }

  // Apply immediately
  const { error: upsertError } = await admin
    .from('config')
    .upsert({ key, value: String(value), updated_at: new Date().toISOString() }, { onConflict: 'key' })
  if (upsertError) return NextResponse.json({ error: upsertError.message }, { status: 500 })

  await admin.from('config_history').insert({
    key,
    value: String(value),
    previous_value: previousValue,
    effective_from: new Date().toISOString(),
    status: 'applied',
    set_by: userId,
    set_by_name: name,
  })

  return NextResponse.json({ ok: true, scheduled: false })
}

// Cancel a scheduled config change
export async function DELETE(request: NextRequest) {
  const auth = await requireAdminWithRole()
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { history_id } = await request.json()
  if (!history_id) return NextResponse.json({ error: 'history_id required' }, { status: 400 })

  const { error } = await auth.admin
    .from('config_history')
    .update({ status: 'superseded' })
    .eq('id', history_id)
    .eq('status', 'scheduled')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
