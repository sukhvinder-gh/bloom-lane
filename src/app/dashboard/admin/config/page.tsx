'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { roleLabel } from '@/lib/utils/permissions'

const SECTIONS = [
  {
    title: 'Pricing & Commission',
    icon: '💰',
    items: [
      { key: 'markup_pct_b2c',         label: 'B2C Markup %',           hint: 'e.g. 0.45 = 45% over wholesale',        type: 'number' },
      { key: 'commission_rate_default', label: 'Default Commission Rate', hint: 'e.g. 0.10 = 10% platform cut',          type: 'number' },
      { key: 'delivery_fee_cents',      label: 'Delivery Fee',           hint: 'In cents — 2000 = $20.00',               type: 'number' },
      { key: 'min_order_b2b_cents',     label: 'Min B2B Order',          hint: '0 = no minimum, 5000 = $50',             type: 'number' },
    ],
  },
  {
    title: 'Stock Allocation',
    icon: '📦',
    items: [
      { key: 'b2b_stock_pct', label: 'B2B Stock Reserve %', hint: 'e.g. 0.80 = 80% reserved for wholesale', type: 'number' },
    ],
  },
  {
    title: 'Market Schedule',
    icon: '🗓',
    items: [
      { key: 'listing_window_close_time', label: 'Listing Close Time (AEST)', hint: 'e.g. 23:59 (Tuesday night)',   type: 'text' },
      { key: 'market_open_time_aest',     label: 'Market Open Time (AEST)',   hint: 'e.g. 08:00 (Wednesday)',       type: 'text' },
      { key: 'market_close_time_aest',    label: 'Market Close Time (AEST)',  hint: 'e.g. 20:00 (Wednesday)',       type: 'text' },
    ],
  },
  {
    title: 'Buyer Protection',
    icon: '🛡',
    items: [
      { key: 'dispute_window_hrs', label: 'Dispute Window (hours)', hint: 'Hours after delivery the buyer can raise a dispute', type: 'number' },
    ],
  },
  {
    title: 'Platform',
    icon: '⚙',
    items: [
      { key: 'platform_name', label: 'Platform Name', hint: 'Display name shown across the app', type: 'text' },
    ],
  },
]

const ROLE_BADGE: Record<string, string> = {
  super_admin:    'badge-amber',
  platform_admin: 'badge-sage',
  admin:          'badge-olive',
}

export default function AdminConfigPage() {
  const [config, setConfig]   = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState<string | null>(null)
  const [saved, setSaved]     = useState<string | null>(null)
  const [error, setError]     = useState<string | null>(null)

  const [myRole, setMyRole]   = useState('')
  const [admins, setAdmins]   = useState<any[]>([])
  const [newAdminEmail, setNewAdminEmail] = useState('')
  const [newAdminRole, setNewAdminRole]   = useState<'platform_admin' | 'super_admin'>('platform_admin')
  const [promoting, setPromoting] = useState(false)
  const [revoking, setRevoking]   = useState<string | null>(null)
  const [teamMsg, setTeamMsg]     = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  const supabase = createClient()

  useEffect(() => {
    supabase.from('config').select('key, value').then(({ data }) => {
      if (data) {
        const map: Record<string, string> = {}
        data.forEach((row: any) => { map[row.key] = row.value })
        setConfig(map)
      }
      setLoading(false)
    })
    fetch('/api/admin/team').then(r => r.json()).then(d => setAdmins(d.data || []))
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        supabase.from('profiles').select('role').eq('id', user.id).single()
          .then(({ data }) => setMyRole(data?.role || ''))
      }
    })
  }, [])

  const isSuperAdmin = myRole === 'super_admin' || myRole === 'admin'

  async function promoteAdmin(e: React.FormEvent) {
    e.preventDefault()
    setPromoting(true); setTeamMsg(null)
    const res = await fetch('/api/admin/team', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: newAdminEmail, target_role: newAdminRole }),
    })
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
    const res = await fetch('/api/admin/team', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId }),
    })
    const data = await res.json()
    if (!res.ok) {
      setTeamMsg({ type: 'err', text: data.error })
    } else {
      setAdmins(a => a.filter(admin => admin.id !== userId))
      setTeamMsg({ type: 'ok', text: 'Access revoked' })
    }
    setRevoking(null)
  }

  async function handleSave(key: string) {
    setSaving(key); setError(null)
    const res = await fetch('/api/admin/config', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, value: config[key] ?? '' }),
    })
    const json = await res.json()
    if (!res.ok) {
      setError(`Failed to save ${key}: ${json.error || res.statusText}`)
    } else {
      setSaved(key)
      setTimeout(() => setSaved(null), 2000)
    }
    setSaving(null)
  }

  if (loading) {
    return (
      <div className="page-pad" style={{ padding: '2.5rem' }}>
        <div style={{ marginBottom: '2rem' }}>
          <div style={{ width: '12rem', height: '2rem', borderRadius: '0.5rem', background: 'var(--offwhite)', marginBottom: '0.5rem' }} />
          <div style={{ width: '20rem', height: '1rem', borderRadius: '0.5rem', background: 'var(--offwhite)' }} />
        </div>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="card" style={{ padding: '1.25rem 1.5rem', marginBottom: '0.75rem', height: '4rem' }} />
        ))}
      </div>
    )
  }

  return (
    <div className="page-pad" style={{ padding: '2.5rem', maxWidth: '52rem' }}>
      <div style={{ marginBottom: '2rem' }}>
        <h1 className="type-heading reveal" style={{ color: 'var(--navy)', marginBottom: '0.25rem' }}>Platform Config</h1>
        <p className="type-label" style={{ color: 'var(--moss)' }}>Changes take effect immediately — no restart required</p>
      </div>

      {error && (
        <div className="badge badge-red reveal" style={{ width: '100%', padding: '0.875rem 1rem', borderRadius: '0.75rem', marginBottom: '1.5rem', justifyContent: 'flex-start', fontSize: '0.8rem' }}>
          ⚠ {error}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        {SECTIONS.map((section, si) => (
          <div key={section.title} className={`card reveal reveal-d${si + 1}`} style={{ overflow: 'hidden' }}>
            <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid var(--border-light)', display: 'flex', alignItems: 'center', gap: '0.625rem', background: 'var(--offwhite)' }}>
              <span style={{ fontSize: '1.1rem' }}>{section.icon}</span>
              <h2 className="type-label-lg" style={{ color: 'var(--navy)' }}>{section.title}</h2>
              <span style={{ marginLeft: 'auto', fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', background: 'var(--amber-soft)', color: 'var(--amber-new)', padding: '0.1rem 0.5rem', borderRadius: '4px' }}>Super Admin</span>
            </div>
            <div style={{ padding: '0.5rem 0' }}>
              {section.items.map((cfg, i) => (
                <div key={cfg.key} style={{ padding: '1rem 1.5rem', borderTop: i > 0 ? '1px solid var(--border-light)' : undefined, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1.5rem', flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: '10rem' }}>
                    <p style={{ fontWeight: 600, color: 'var(--navy)', fontSize: '0.875rem', marginBottom: '0.15rem' }}>{cfg.label}</p>
                    <p className="type-label-sm" style={{ color: 'var(--moss)' }}>{cfg.hint}</p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', flexShrink: 0 }}>
                    <input
                      type={cfg.type}
                      value={config[cfg.key] ?? ''}
                      onChange={e => setConfig(prev => ({ ...prev, [cfg.key]: e.target.value }))}
                      className="input"
                      style={{ width: cfg.type === 'number' ? '9rem' : '14rem' }}
                    />
                    <button
                      onClick={() => handleSave(cfg.key)}
                      disabled={saving === cfg.key}
                      className={`btn btn-sm ${saved === cfg.key ? '' : 'btn-forest'}`}
                      style={saved === cfg.key ? { background: 'var(--sage-soft)', color: 'var(--sage-new)' } : undefined}
                    >
                      {saving === cfg.key ? '…' : saved === cfg.key ? '✓ Saved' : 'Save'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="reveal" style={{ marginTop: '1.5rem', padding: '1rem 1.25rem', background: 'var(--amber-soft)', border: '1px solid rgba(196,124,43,0.2)', borderRadius: '0.75rem' }}>
        <p className="type-label" style={{ color: 'var(--amber-new)' }}>⚠ Changing B2C Markup or Stock Split affects all new orders immediately. Existing orders are unaffected.</p>
      </div>

      {/* ── Platform Team ── */}
      <div className="card reveal" style={{ overflow: 'hidden', marginTop: '2rem' }}>
        <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid var(--border-light)', display: 'flex', alignItems: 'center', gap: '0.625rem', background: 'var(--offwhite)' }}>
          <span style={{ fontSize: '1.1rem' }}>👤</span>
          <h2 className="type-label-lg" style={{ color: 'var(--navy)' }}>Platform Team</h2>
        </div>

        {/* Role legend */}
        <div style={{ padding: '0.875rem 1.5rem', borderBottom: '1px solid var(--border-light)', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
            <span className="badge badge-amber" style={{ padding: '0.1rem 0.5rem', fontSize: '0.65rem' }}>Super Admin</span>
            <span className="type-label-sm" style={{ color: 'var(--moss)' }}>Full access inc. pricing &amp; config</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
            <span className="badge badge-sage" style={{ padding: '0.1rem 0.5rem', fontSize: '0.65rem' }}>Platform Admin</span>
            <span className="type-label-sm" style={{ color: 'var(--moss)' }}>Manage growers, buyers &amp; inventory</span>
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
                <input
                  type="email"
                  className="input"
                  placeholder="user@example.com"
                  value={newAdminEmail}
                  onChange={e => setNewAdminEmail(e.target.value)}
                  required
                  style={{ width: '100%' }}
                />
              </div>
              <div>
                <select
                  className="input"
                  value={newAdminRole}
                  onChange={e => setNewAdminRole(e.target.value as any)}
                  style={{ minWidth: '11rem' }}
                >
                  <option value="platform_admin">Platform Admin</option>
                  <option value="super_admin">Super Admin</option>
                </select>
              </div>
              <button type="submit" className="btn btn-forest btn-sm" disabled={promoting} style={{ flexShrink: 0, height: '2.5rem' }}>
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
