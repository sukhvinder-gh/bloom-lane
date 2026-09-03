'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { isSuperAdminRole, canEditConfigKey, roleLabel } from '@/lib/utils/permissions'
import { AUDateInput } from '@/components/AUDateInput'

// ── Section / item definitions ───────────────────────────────────────────────

type SectionTier = 'super_admin' | 'platform_admin'
type ConfigItem  = { key: string; label: string; hint: string; type: 'number' | 'text' }

const SECTIONS: { title: string; icon: string; tier: SectionTier; items: ConfigItem[] }[] = [
  {
    title: 'Pricing & Commission', icon: '💰', tier: 'super_admin',
    items: [
      { key: 'markup_pct_b2c',         label: 'B2C Markup %',            hint: 'e.g. 0.45 = 45% over wholesale',       type: 'number' },
      { key: 'commission_rate_default', label: 'Default Commission Rate',  hint: 'e.g. 0.10 = 10% platform cut',         type: 'number' },
      { key: 'delivery_fee_cents',      label: 'Delivery Fee',            hint: 'In cents — 2000 = $20.00',              type: 'number' },
      { key: 'min_order_b2b_cents',     label: 'Min B2B Order',           hint: '0 = no minimum, 5000 = $50',            type: 'number' },
    ],
  },
  {
    title: 'Grower Memberships', icon: '🌿', tier: 'super_admin',
    items: [
      { key: 'hub_membership_monthly_cents',  label: 'Hub Membership — Monthly',         hint: 'In cents — 6000 = $60.00',  type: 'number' },
      { key: 'hub_membership_seasonal_cents', label: 'Hub Membership — Seasonal (3 mo)', hint: 'In cents — 15000 = $150.00', type: 'number' },
      { key: 'hub_membership_annual_cents',   label: 'Hub Membership — Annual',          hint: 'In cents — 48000 = $480.00', type: 'number' },
      { key: 'wholesale_commission_pct',      label: 'Free Grower Listing Commission',   hint: 'e.g. 0.15 = 15% per order',  type: 'number' },
    ],
  },
  {
    title: 'Florist Memberships', icon: '💐', tier: 'super_admin',
    items: [
      { key: 'personal_shopper_weekly_cents',  label: 'Personal Shopper — Weekly',  hint: 'In cents — 0 = not offered', type: 'number' },
      { key: 'personal_shopper_monthly_cents', label: 'Personal Shopper — Monthly', hint: 'In cents — 0 = not offered', type: 'number' },
      { key: 'personal_shopper_annual_cents',  label: 'Personal Shopper — Annual',  hint: 'In cents — 0 = not offered', type: 'number' },
    ],
  },
  {
    title: 'Coordinator', icon: '🏛', tier: 'super_admin',
    items: [
      { key: 'coordinator_registration_cents', label: 'Hub Registration Fee', hint: 'In cents — 0 = free registration', type: 'number' },
    ],
  },
  {
    title: 'Stock Allocation', icon: '📦', tier: 'platform_admin',
    items: [
      { key: 'b2b_stock_pct', label: 'B2B Stock Reserve %', hint: 'e.g. 0.80 = 80% reserved for wholesale', type: 'number' },
    ],
  },
  {
    // Market open/close time is deliberately NOT here — it varies per hub and
    // can be overridden per farm (see Hub management + grower storefront),
    // so a single global open/close time no longer makes sense. Listing
    // close time is still genuinely global: every grower submits stock for
    // the same weekly cycle regardless of which hub they belong to.
    title: 'Listing Schedule', icon: '🗓', tier: 'platform_admin',
    items: [
      { key: 'listing_window_close_time', label: 'Listing Close Time (AEST)', hint: 'e.g. 23:59 (Tuesday night)',   type: 'text' },
    ],
  },
  {
    title: 'Buyer Protection', icon: '🛡', tier: 'platform_admin',
    items: [
      { key: 'dispute_window_hrs', label: 'Dispute Window (hours)', hint: 'Hours after delivery the buyer can raise a dispute', type: 'number' },
    ],
  },
  {
    // Fallback only — a hub or farm with its own market-close schedule set
    // (Hub management / grower storefront) always takes priority over this.
    // This exists so an order still gets an automatic date even before any
    // schedule has been configured, rather than needing a per-order admin
    // hand-edit.
    title: 'Fulfilment Scheduling', icon: '🌾', tier: 'platform_admin',
    items: [
      { key: 'default_harvest_lead_days', label: 'Default Harvest Lead Time (days)', hint: 'Used only when a farm/hub has no market schedule set — days from order placement to auto-set "grower fulfils by"', type: 'number' },
    ],
  },
  {
    title: 'Platform', icon: '⚙', tier: 'super_admin',
    items: [
      { key: 'platform_name', label: 'Platform Name', hint: 'Display name shown across the app', type: 'text' },
    ],
  },
]

const TIER_BADGE: Record<SectionTier, { label: string; bg: string; color: string }> = {
  super_admin:    { label: 'Super Admin',    bg: 'var(--amber-soft)', color: 'var(--amber-new)' },
  platform_admin: { label: 'Platform Admin', bg: 'var(--sage-soft)',  color: 'var(--sage-new)'  },
}

// ── Types ────────────────────────────────────────────────────────────────────

type HistoryMeta = {
  lastApplied: Record<string, { set_by_name: string | null; created_at: string }>
  scheduled:   Record<string, { id: string; value: string; effective_from: string; set_by_name: string | null }>
}

// ── ConfigRow ─────────────────────────────────────────────────────────────────

function ConfigRow({
  cfg, value, history, canEdit, onSave, onCancelScheduled,
}: {
  cfg: ConfigItem
  value: string
  history: HistoryMeta
  canEdit: boolean
  onSave: (key: string, value: string, effectiveFrom: string | null) => Promise<void>
  onCancelScheduled: (historyId: string, key: string) => Promise<void>
}) {
  const [inputValue, setInputValue]   = useState(value)
  const [scheduleDate, setScheduleDate] = useState('')
  const [showSchedule, setShowSchedule] = useState(false)
  const [saving, setSaving]           = useState(false)
  const [flash, setFlash]             = useState<'saved' | 'scheduled' | null>(null)
  const [cancelling, setCancelling]   = useState(false)

  // Keep input in sync if parent refreshes the value (e.g. after scheduled apply)
  useEffect(() => { setInputValue(value) }, [value])

  const audit     = history.lastApplied[cfg.key]
  const scheduled = history.scheduled[cfg.key]
  const isDirty   = inputValue !== value || (showSchedule && scheduleDate)

  async function handleSave() {
    if (!isDirty) return
    setSaving(true)
    const effectiveFrom = showSchedule && scheduleDate ? new Date(scheduleDate).toISOString() : null
    await onSave(cfg.key, inputValue, effectiveFrom)
    setSaving(false)
    setFlash(effectiveFrom && new Date(effectiveFrom) > new Date() ? 'scheduled' : 'saved')
    setShowSchedule(false)
    setScheduleDate('')
    setTimeout(() => setFlash(null), 2500)
  }

  async function handleCancelScheduled() {
    if (!scheduled) return
    setCancelling(true)
    await onCancelScheduled(scheduled.id, cfg.key)
    setCancelling(false)
  }

  const todayISO = new Date().toISOString().slice(0, 10)

  return (
    <div style={{ padding: '1.1rem 1.5rem', borderTop: 'none' }}>
      {/* Main row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1.25rem', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: '10rem' }}>
          <p style={{ fontWeight: 600, color: 'var(--navy)', fontSize: '0.875rem', marginBottom: '0.15rem' }}>{cfg.label}</p>
          <p style={{ fontSize: '0.75rem', color: 'var(--moss)', letterSpacing: '0.02em', textTransform: 'uppercase', fontWeight: 600 }}>{cfg.hint}</p>
        </div>

        {canEdit ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0, flexWrap: 'wrap' }}>
            <input
              type={cfg.type}
              value={inputValue}
              onChange={e => setInputValue(e.target.value)}
              className="input"
              style={{ width: cfg.type === 'number' ? '8.5rem' : '13rem' }}
            />
            <button
              onClick={() => setShowSchedule(s => !s)}
              title="Schedule for later"
              style={{ background: showSchedule ? 'var(--amber-soft)' : 'none', border: '1px solid var(--border-light)', borderRadius: '6px', cursor: 'pointer', padding: '0.35rem 0.5rem', fontSize: '0.85rem', color: showSchedule ? 'var(--amber-new)' : 'var(--text-3)', lineHeight: 1, transition: 'all 0.1s' }}
            >
              ⏱
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !isDirty}
              className={`btn btn-sm ${flash === 'saved' ? '' : flash === 'scheduled' ? '' : 'btn-navy'}`}
              style={
                flash === 'saved'      ? { background: 'var(--sage-soft)', color: 'var(--sage-new)', minWidth: '5rem' } :
                flash === 'scheduled'  ? { background: 'var(--amber-soft)', color: 'var(--amber-new)', minWidth: '5rem' } :
                { minWidth: '5rem' }
              }
            >
              {saving ? '…' : flash === 'saved' ? '✓ Saved' : flash === 'scheduled' ? '⏱ Scheduled' : isDirty && showSchedule && scheduleDate ? 'Schedule' : 'Save'}
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', flexShrink: 0 }}>
            <input
              type={cfg.type}
              value={inputValue}
              readOnly
              className="input"
              style={{ width: cfg.type === 'number' ? '8.5rem' : '13rem', opacity: 0.6, cursor: 'not-allowed', background: 'var(--offwhite)' }}
            />
            <span style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.06em', color: 'var(--amber-new)', background: 'var(--amber-soft)', padding: '0.2rem 0.5rem', borderRadius: '4px', whiteSpace: 'nowrap' }}>
              🔒 Super Admin
            </span>
          </div>
        )}
      </div>

      {/* Schedule date picker */}
      {canEdit && showSchedule && (
        <div style={{ marginTop: '0.6rem', display: 'flex', alignItems: 'center', gap: '0.625rem', paddingLeft: '0.125rem' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--moss)', fontWeight: 600 }}>Effective from</span>
          <AUDateInput
            value={scheduleDate}
            min={todayISO}
            onChange={setScheduleDate}
            className="input"
            style={{ width: '9.5rem', fontSize: '0.8rem' }}
            ariaLabel="Effective from date"
          />
          {scheduleDate && new Date(scheduleDate) <= new Date() && (
            <span style={{ fontSize: '0.72rem', color: 'var(--amber-new)' }}>Today or past → applies immediately</span>
          )}
        </div>
      )}

      {/* Audit trail */}
      {audit && (
        <p style={{ fontSize: '0.7rem', color: 'var(--moss)', opacity: 0.7, marginTop: '0.4rem', paddingLeft: '0.125rem' }}>
          Last changed
          {audit.set_by_name ? ` by ${audit.set_by_name}` : ''}
          {' · '}
          {new Date(audit.created_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}
        </p>
      )}

      {/* Scheduled change */}
      {scheduled && (
        <div style={{ marginTop: '0.5rem', display: 'inline-flex', alignItems: 'center', gap: '0.625rem', background: 'var(--amber-soft)', border: '1px solid rgba(196,124,43,0.2)', borderRadius: '6px', padding: '0.35rem 0.75rem' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--amber-new)', fontWeight: 600 }}>
            ⏱ → {scheduled.value} from {new Date(scheduled.effective_from).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}
            {scheduled.set_by_name ? ` · set by ${scheduled.set_by_name}` : ''}
          </span>
          {canEdit && (
            <button
              onClick={handleCancelScheduled}
              disabled={cancelling}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.75rem', color: 'var(--amber-new)', padding: '0 0.2rem', opacity: cancelling ? 0.5 : 1 }}
              title="Cancel this scheduled change"
            >
              ✕
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ── Portal Background ─────────────────────────────────────────────────────────

const BG_PRESETS = [
  { id: 'none',    label: 'Default', value: '' },
  { id: 'forest',  label: 'Forest',  value: 'linear-gradient(160deg, #091510 0%, #0e2318 35%, #142b1b 60%, #0b1d12 100%)' },
  { id: 'ocean',   label: 'Ocean',   value: 'linear-gradient(160deg, #060c18 0%, #0a1929 35%, #0c2240 60%, #07101e 100%)' },
  { id: 'dusk',    label: 'Dusk',    value: 'linear-gradient(160deg, #140b22 0%, #2d1040 35%, #1e1530 60%, #0e0918 100%)' },
  { id: 'ember',   label: 'Ember',   value: 'linear-gradient(160deg, #1a0a05 0%, #2d1505 35%, #3d1d08 60%, #1a0d05 100%)' },
  { id: 'slate',   label: 'Slate',   value: 'linear-gradient(160deg, #0d1117 0%, #161b22 50%, #0d1117 100%)' },
  { id: 'bloom',   label: 'Bloom',   value: 'linear-gradient(160deg, #1f0a10 0%, #3d0f1e 35%, #2a0c18 60%, #180810 100%)' },
  { id: 'sage',    label: 'Sage',    value: '#e8f0e8' },
  { id: 'sky',     label: 'Sky',     value: '#e8f0fe' },
  { id: 'neutral', label: 'Neutral', value: '#f5f5f7' },
  { id: 'white',   label: 'White',   value: '#ffffff' },
]

const ROLE_BADGE: Record<string, string> = {
  super_admin:    'badge-amber',
  platform_admin: 'badge-sage',
  admin:          'badge-olive',
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function AdminConfigPage() {
  const [config,  setConfig]  = useState<Record<string, string>>({})
  const [history, setHistory] = useState<HistoryMeta>({ lastApplied: {}, scheduled: {} })
  const [loading, setLoading] = useState(true)
  const [myRole,  setMyRole]  = useState('')
  const [bgSaved, setBgSaved] = useState(false)

  const [admins,       setAdmins]       = useState<any[]>([])
  const [newAdminEmail, setNewAdminEmail] = useState('')
  const [newAdminRole,  setNewAdminRole]  = useState<'platform_admin' | 'super_admin'>('platform_admin')
  const [promoting,    setPromoting]    = useState(false)
  const [revoking,     setRevoking]     = useState<string | null>(null)
  const [teamMsg,      setTeamMsg]      = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  const supabase = createClient()

  const loadConfig = useCallback(async () => {
    const res  = await fetch('/api/admin/config')
    const data = await res.json()
    setConfig(data.config ?? {})
    setHistory(data.history ?? { lastApplied: {}, scheduled: {} })
  }, [])

  useEffect(() => {
    Promise.all([
      loadConfig(),
      fetch('/api/admin/team').then(r => r.json()).then(d => setAdmins(d.data || [])),
      supabase.auth.getUser().then(({ data: { user } }) => {
        if (user) supabase.from('profiles').select('role').eq('id', user.id).single()
          .then(({ data }) => setMyRole(data?.role || ''))
      }),
    ]).finally(() => setLoading(false))
  }, [])

  const isSuperAdmin = isSuperAdminRole(myRole)

  async function handleSave(key: string, value: string, effectiveFrom: string | null) {
    const body: Record<string, unknown> = { key, value }
    if (effectiveFrom) body.effective_from = effectiveFrom
    const res  = await fetch('/api/admin/config', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const data = await res.json()
    if (res.ok) {
      // If applied immediately, update local state
      if (!data.scheduled) setConfig(prev => ({ ...prev, [key]: String(value) }))
      // Refresh history
      await loadConfig()
    }
  }

  async function handleCancelScheduled(historyId: string, key: string) {
    await fetch('/api/admin/config', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ history_id: historyId }),
    })
    setHistory(prev => ({
      ...prev,
      scheduled: Object.fromEntries(Object.entries(prev.scheduled).filter(([k]) => k !== key)),
    }))
  }

  async function handleBgSave(value: string) {
    setConfig(prev => ({ ...prev, portal_background: value }))
    await fetch('/api/admin/config', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: 'portal_background', value }),
    })
    setBgSaved(true)
    setTimeout(() => setBgSaved(false), 2000)
    await loadConfig()
  }

  async function promoteAdmin(e: React.FormEvent) {
    e.preventDefault()
    setPromoting(true); setTeamMsg(null)
    const res  = await fetch('/api/admin/team', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: newAdminEmail, target_role: newAdminRole }) })
    const data = await res.json()
    if (!res.ok) {
      setTeamMsg({ type: 'err', text: data.error })
    } else {
      setAdmins(a => [...a, data.user])
      setNewAdminEmail('')
      setTeamMsg({ type: 'ok', text: `${data.user.full_name || data.user.email} added as ${roleLabel(data.user.role)}` })
    }
    setPromoting(false)
  }

  async function revokeAdmin(userId: string) {
    setRevoking(userId); setTeamMsg(null)
    const res  = await fetch('/api/admin/team', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user_id: userId }) })
    const data = await res.json()
    if (!res.ok) {
      setTeamMsg({ type: 'err', text: data.error })
    } else {
      setAdmins(a => a.filter(admin => admin.id !== userId))
      setTeamMsg({ type: 'ok', text: 'Access revoked' })
    }
    setRevoking(null)
  }

  if (loading) return (
    <div className="page-pad" style={{ padding: '2.5rem' }}>
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="card" style={{ padding: '1.25rem 1.5rem', marginBottom: '0.75rem', height: '4rem' }} />
      ))}
    </div>
  )

  return (
    <div className="page-pad" style={{ padding: '2.5rem', maxWidth: '52rem' }}>
      <div style={{ marginBottom: '2rem' }}>
        <h1 className="type-heading reveal" style={{ color: 'var(--navy)', marginBottom: '0.25rem' }}>Platform Config</h1>
        <p className="type-label" style={{ color: 'var(--moss)' }}>
          Changes take effect immediately · Schedule future-dated changes with ⏱ · Audit trail recorded per change
        </p>
      </div>

      {/* Role legend */}
      <div className="reveal" style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '1.75rem', padding: '0.875rem 1.25rem', background: 'var(--offwhite)', borderRadius: '0.875rem', border: '1px solid var(--border-light)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.08em', background: 'var(--amber-soft)', color: 'var(--amber-new)', padding: '0.15rem 0.5rem', borderRadius: '4px' }}>Super Admin</span>
          <span className="type-label-sm" style={{ color: 'var(--moss)' }}>Pricing, commissions, platform identity</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.08em', background: 'var(--sage-soft)', color: 'var(--sage-new)', padding: '0.15rem 0.5rem', borderRadius: '4px' }}>Platform Admin</span>
          <span className="type-label-sm" style={{ color: 'var(--moss)' }}>Operations, schedule, buyer protection</span>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
          <span style={{ fontSize: '0.75rem' }}>⏱</span>
          <span className="type-label-sm" style={{ color: 'var(--moss)' }}>= schedule for a future date</span>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        {SECTIONS.map((section, si) => {
          const badge      = TIER_BADGE[section.tier]
          const userCanEdit = canEditConfigKey(section.items[0]?.key ?? '', myRole)

          return (
            <div key={section.title} className={`card reveal reveal-d${si + 1}`} style={{ overflow: 'hidden' }}>
              {/* Section header */}
              <div style={{ padding: '0.875rem 1.5rem', borderBottom: '1px solid var(--border-light)', display: 'flex', alignItems: 'center', gap: '0.625rem', background: userCanEdit ? 'var(--offwhite)' : '#FAFAF7' }}>
                <span style={{ fontSize: '1.1rem', opacity: userCanEdit ? 1 : 0.6 }}>{section.icon}</span>
                <h2 className="type-label-lg" style={{ color: userCanEdit ? 'var(--navy)' : 'var(--moss)' }}>{section.title}</h2>
                {!userCanEdit && <span style={{ fontSize: '0.75rem' }}>🔒</span>}
                <span style={{ marginLeft: 'auto', fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', background: badge.bg, color: badge.color, padding: '0.15rem 0.5rem', borderRadius: '4px' }}>
                  {badge.label}
                </span>
              </div>

              {/* Items */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                {section.items.map((cfg, i) => (
                  <div key={cfg.key} style={{ borderTop: i > 0 ? '1px solid var(--border-light)' : undefined }}>
                    <ConfigRow
                      cfg={cfg}
                      value={config[cfg.key] ?? ''}
                      history={history}
                      canEdit={canEditConfigKey(cfg.key, myRole)}
                      onSave={handleSave}
                      onCancelScheduled={handleCancelScheduled}
                    />
                  </div>
                ))}
              </div>

              {/* Market Schedule — cron alignment warning */}
              {section.title === 'Market Schedule' && (
                <div style={{ padding: '0.875rem 1.25rem', background: '#FEF3C7', borderTop: '1px solid #FDE68A', display: 'flex', gap: '0.625rem', alignItems: 'flex-start' }}>
                  <span style={{ fontSize: '1rem', flexShrink: 0 }}>⚠️</span>
                  <p style={{ fontSize: '0.78rem', color: '#92400E', lineHeight: 1.55, margin: 0 }}>
                    <strong>These values update the marketplace UI display only.</strong> The automated jobs that lock listings on Tuesday and send buyer notifications on Wednesday run on fixed cron schedules in code. To change when automation fires, a developer must update the Inngest cron expressions and redeploy.
                  </p>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Warning note */}
      <div className="reveal" style={{ marginTop: '1.5rem', padding: '1rem 1.25rem', background: 'var(--amber-soft)', border: '1px solid rgba(196,124,43,0.2)', borderRadius: '0.75rem' }}>
        <p className="type-label" style={{ color: 'var(--amber-new)' }}>
          ⚠ B2C Markup and Stock Split changes affect all new orders immediately. Use ⏱ to schedule off-peak.
        </p>
      </div>

      {/* ── Portal Background ── */}
      <div className="card reveal" style={{ overflow: 'hidden', marginTop: '1.5rem' }}>
        <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid var(--border-light)', display: 'flex', alignItems: 'center', gap: '0.625rem', background: 'var(--offwhite)' }}>
          <span style={{ fontSize: '1.1rem' }}>🎨</span>
          <h2 className="type-label-lg" style={{ color: 'var(--navy)' }}>Portal Background</h2>
          <span style={{ marginLeft: 'auto', fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.08em', background: 'var(--sage-soft)', color: 'var(--sage-new)', padding: '0.15rem 0.5rem', borderRadius: '4px' }}>Platform Admin</span>
          {bgSaved && <span style={{ fontSize: '0.75rem', color: 'var(--sage-new)', fontWeight: 600 }}>✓ Saved</span>}
        </div>
        <div style={{ padding: '1.5rem' }}>
          <p className="type-label-sm" style={{ color: 'var(--moss)', marginBottom: '1.25rem' }}>
            Background for all portal dashboards. Takes effect on next page load.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(76px, 1fr))', gap: '0.875rem' }}>
            {BG_PRESETS.map(preset => {
              const active = (config['portal_background'] ?? '') === preset.value
              return (
                <button
                  key={preset.id}
                  onClick={() => handleBgSave(preset.value)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.375rem' }}
                >
                  <div style={{ width: '100%', aspectRatio: '1.6', borderRadius: '8px', background: preset.value || '#f5f5f7', border: `2px solid ${active ? 'var(--bloom)' : 'transparent'}`, outline: `2px solid ${active ? 'var(--bloom-soft)' : 'transparent'}`, outlineOffset: '1px', position: 'relative', boxShadow: '0 1px 4px rgba(0,0,0,0.15)', transition: 'all 0.12s' }}>
                    {active && (
                      <div style={{ position: 'absolute', top: '3px', right: '3px', width: '14px', height: '14px', borderRadius: '50%', background: 'var(--bloom)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '8px', color: 'white', fontWeight: 700 }}>✓</div>
                    )}
                  </div>
                  <span style={{ fontSize: '0.7rem', color: active ? 'var(--bloom)' : 'var(--text-secondary)', fontWeight: active ? 700 : 400, textAlign: 'center', whiteSpace: 'nowrap' }}>{preset.label}</span>
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* ── Platform Team ── */}
      <div className="card reveal" style={{ overflow: 'hidden', marginTop: '2rem' }}>
        <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid var(--border-light)', display: 'flex', alignItems: 'center', gap: '0.625rem', background: 'var(--offwhite)' }}>
          <span style={{ fontSize: '1.1rem' }}>👤</span>
          <h2 className="type-label-lg" style={{ color: 'var(--navy)' }}>Platform Team</h2>
          <span style={{ marginLeft: 'auto', fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.08em', background: 'var(--amber-soft)', color: 'var(--amber-new)', padding: '0.15rem 0.5rem', borderRadius: '4px' }}>Super Admin</span>
        </div>

        {/* Role legend */}
        <div style={{ padding: '0.875rem 1.5rem', borderBottom: '1px solid var(--border-light)', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
            <span className="badge badge-amber" style={{ padding: '0.1rem 0.5rem', fontSize: '0.65rem' }}>Super Admin</span>
            <span className="type-label-sm" style={{ color: 'var(--moss)' }}>Full access inc. pricing & config</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
            <span className="badge badge-sage" style={{ padding: '0.1rem 0.5rem', fontSize: '0.65rem' }}>Platform Admin</span>
            <span className="type-label-sm" style={{ color: 'var(--moss)' }}>Operations — no pricing changes</span>
          </div>
        </div>

        {/* Current team */}
        <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border-light)' }}>
          <p className="type-label-sm" style={{ color: 'var(--moss)', marginBottom: '0.875rem' }}>Current Team</p>
          {admins.length === 0 ? (
            <p className="type-label" style={{ color: 'var(--moss)' }}>Loading…</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {admins.map(admin => (
                <div key={admin.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem 1rem', borderRadius: '0.75rem', background: 'var(--offwhite)', gap: '1rem' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.15rem' }}>
                      <p style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--navy)' }}>{admin.full_name || '—'}</p>
                      <span className={`badge ${ROLE_BADGE[admin.role] || 'badge-olive'}`} style={{ padding: '0.1rem 0.5rem', fontSize: '0.65rem' }}>
                        {roleLabel(admin.role)}
                      </span>
                    </div>
                    <p className="type-label-sm" style={{ color: 'var(--moss)' }}>{admin.email}</p>
                  </div>
                  {isSuperAdmin && (
                    <button
                      onClick={() => revokeAdmin(admin.id)}
                      disabled={revoking === admin.id}
                      className="btn btn-ghost btn-sm"
                      style={{ color: 'var(--bloom)', borderColor: 'var(--bloom-mid)', flexShrink: 0 }}
                    >
                      {revoking === admin.id ? '…' : 'Revoke'}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Add new member */}
        {isSuperAdmin && (
          <div style={{ padding: '1.25rem 1.5rem' }}>
            <p className="type-label-sm" style={{ color: 'var(--moss)', marginBottom: '0.875rem' }}>Add Team Member</p>
            {teamMsg && (
              <div className={`badge ${teamMsg.type === 'ok' ? 'badge-sage' : 'badge-red'}`}
                style={{ width: '100%', padding: '0.75rem 1rem', borderRadius: '0.75rem', marginBottom: '1rem', justifyContent: 'flex-start', fontSize: '0.8rem' }}>
                {teamMsg.type === 'ok' ? '✓' : '⚠'} {teamMsg.text}
              </div>
            )}
            <form onSubmit={promoteAdmin} style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div style={{ flex: 1, minWidth: '14rem' }}>
                <input type="email" className="input" placeholder="user@example.com" value={newAdminEmail} onChange={e => setNewAdminEmail(e.target.value)} required style={{ width: '100%' }} />
              </div>
              <div>
                <select className="input" value={newAdminRole} onChange={e => setNewAdminRole(e.target.value as any)} style={{ minWidth: '11rem' }}>
                  <option value="platform_admin">Platform Admin</option>
                  <option value="super_admin">Super Admin</option>
                </select>
              </div>
              <button type="submit" className="btn btn-navy btn-sm" disabled={promoting} style={{ flexShrink: 0, height: '2.5rem' }}>
                {promoting ? '…' : 'Add to Team'}
              </button>
            </form>
            <p className="type-label-sm" style={{ color: 'var(--moss)', marginTop: '0.625rem' }}>
              The user must already have a The Green Guild account.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
