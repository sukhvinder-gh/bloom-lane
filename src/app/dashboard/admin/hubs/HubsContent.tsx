'use client'
import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { formatAEST } from '@/lib/utils/timezone'

type HubRow = {
  id: string
  name: string
  region: string | null
  coordinator_id: string | null
  status: 'pending' | 'active' | 'inactive'
  created_at: string
  profiles?: { full_name: string | null; email: string | null } | null
  market_open_day?: string | null
  market_open_time?: string | null
  market_close_time?: string | null
  market_windows?: { day: string; open: string; close: string }[] | null
}

type Coordinator = { id: string; full_name: string | null; email: string | null }

type MemberRecord = {
  id: string
  business_name: string | null
  user_id: string
  profiles: { full_name: string | null; email: string | null } | null
  subscriptions: Array<{ status: string; plan: string; expires_at: string | null }>
}

type ActiveModal =
  | { type: 'members'; hub: HubRow }
  | { type: 'email'; hub: HubRow }
  | { type: 'delete'; hub: HubRow }

const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  pending:  { bg: '#FEF3C7', color: '#92400E' },
  active:   { bg: '#D1FAE5', color: '#065F46' },
  inactive: { bg: '#F1EFE8', color: '#5F5E5A' },
}

const SUB_STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  active:    { bg: '#D1FAE5', color: '#065F46' },
  pending:   { bg: '#FEF3C7', color: '#92400E' },
  cancelled: { bg: '#FEE2E2', color: '#B91C1C' },
  expired:   { bg: '#F1EFE8', color: '#5F5E5A' },
}

// ── ActionsMenu ───────────────────────────────────────────────────────────────
function ActionsMenu({ hub, onEdit, onToggle, onViewMembers, onEmail, onDelete, disabled }: {
  hub: HubRow
  onEdit: () => void
  onToggle: () => void
  onViewMembers: () => void
  onEmail: () => void
  onDelete: () => void
  disabled: boolean
}) {
  const [open, setOpen] = useState(false)
  const [pos, setPos]   = useState({ top: 0, right: 0 })
  const btnRef  = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  function toggle() {
    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect()
      setPos({ top: r.bottom + window.scrollY + 4, right: window.innerWidth - r.right })
    }
    setOpen(o => !o)
  }

  useEffect(() => {
    if (!open) return
    function handle(e: MouseEvent) {
      if (
        menuRef.current && !menuRef.current.contains(e.target as Node) &&
        btnRef.current  && !btnRef.current.contains(e.target as Node)
      ) setOpen(false)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [open])

  const itemStyle: React.CSSProperties = {
    display: 'block', width: '100%', textAlign: 'left',
    padding: '0.75rem 1rem', background: 'none', border: 'none',
    borderBottom: '1px solid var(--border-light)', cursor: 'pointer',
    fontSize: '0.85rem', color: 'var(--text-1)',
  }

  return (
    <>
      <button
        ref={btnRef}
        onClick={toggle}
        disabled={disabled}
        title="Actions"
        style={{ background: 'none', border: '1px solid var(--border-light)', borderRadius: '6px', cursor: 'pointer', padding: '0.3rem 0.65rem', fontSize: '1rem', color: 'var(--text-2)', lineHeight: 1 }}
      >
        ⋯
      </button>
      {open && createPortal(
        <div
          ref={menuRef}
          style={{ position: 'fixed', top: pos.top, right: pos.right, background: 'var(--surface)', border: '1px solid var(--border-light)', borderRadius: '10px', boxShadow: '0 4px 20px rgba(0,0,0,0.14)', zIndex: 9999, minWidth: '200px', overflow: 'hidden' }}
        >
          <button onClick={() => { onViewMembers(); setOpen(false) }} style={itemStyle}>
            👥 View growers
          </button>
          <button onClick={() => { onEdit(); setOpen(false) }} style={itemStyle}>
            ✏️ Edit hub
          </button>
          <button onClick={() => { onEmail(); setOpen(false) }} style={{ ...itemStyle, color: hub.profiles?.email ? 'var(--text-1)' : 'var(--text-3)' }}>
            📧 Email coordinator
          </button>
          <button
            onClick={() => { onToggle(); setOpen(false) }}
            style={{ ...itemStyle, color: hub.status === 'active' ? 'var(--terracotta)' : 'var(--forest)' }}
          >
            {hub.status === 'active' ? '⏸ Deactivate' : '▶ Activate'}
          </button>
          <button
            onClick={() => { onDelete(); setOpen(false) }}
            style={{ ...itemStyle, border: 'none', color: '#B91C1C' }}
          >
            🗑️ Delete hub
          </button>
        </div>,
        document.body
      )}
    </>
  )
}

// ── HubModal (create / edit) ──────────────────────────────────────────────────
function HubModal({ hub, coordinators, onClose, onSave }: {
  hub: HubRow | null
  coordinators: Coordinator[]
  onClose: () => void
  onSave: (hub: HubRow) => void
}) {
  const [name,          setName]          = useState(hub?.name           ?? '')
  const [region,        setRegion]        = useState(hub?.region         ?? '')
  const [coordinatorId, setCoordinatorId] = useState(hub?.coordinator_id ?? '')
  // Existing hubs without a market_windows list fall back to their single
  // legacy window, shown as row 1.
  const [windows, setWindows] = useState<{ day: string; open: string; close: string }[]>(() => {
    if (hub?.market_windows && hub.market_windows.length > 0) return hub.market_windows
    if (hub?.market_open_day && hub.market_open_time && hub.market_close_time) {
      return [{ day: hub.market_open_day, open: hub.market_open_time, close: hub.market_close_time }]
    }
    return []
  })
  const updateWindow = (i: number, patch: Partial<{ day: string; open: string; close: string }>) =>
    setWindows(ws => ws.map((w, idx) => idx === i ? { ...w, ...patch } : w))
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState<string | null>(null)

  const isEdit = hub !== null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true); setError(null)

    const body: Record<string, unknown> = {
      name:               name.trim(),
      region:             region.trim() || null,
      coordinator_id:     coordinatorId || null,
      market_windows:     windows,
    }
    if (isEdit) body.id = hub.id

    const res = await fetch('/api/admin/hubs', {
      method: isEdit ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await res.json()
    if (!res.ok) { setError(data.error || 'Something went wrong'); setSaving(false); return }
    onSave(data.hub)
    onClose()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(2px)' }} />
      <div style={{ position: 'relative', background: 'var(--surface)', borderRadius: '16px', width: '100%', maxWidth: '30rem', boxShadow: '0 8px 40px rgba(0,0,0,0.18)', overflow: 'hidden' }}>
        <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border-light)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', color: 'var(--forest)', fontWeight: 700 }}>
            {isEdit ? 'Edit Hub / Collective' : 'Create Hub / Collective'}
          </h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.1rem', color: 'var(--text-3)', padding: '0.2rem 0.4rem' }}>✕</button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--moss)', marginBottom: '0.4rem' }}>Hub / Collective Name *</label>
            <input className="input" value={name} onChange={e => setName(e.target.value)} required placeholder="e.g. Yarra Valley Growers Collective" style={{ width: '100%' }} autoFocus />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--moss)', marginBottom: '0.4rem' }}>Region</label>
            <input className="input" value={region} onChange={e => setRegion(e.target.value)} placeholder="e.g. Yarra Valley, VIC" style={{ width: '100%' }} />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--moss)', marginBottom: '0.4rem' }}>Coordinator</label>
            <select className="input" value={coordinatorId} onChange={e => setCoordinatorId(e.target.value)} style={{ width: '100%' }}>
              <option value="">— Unassigned —</option>
              {coordinators.map(c => (
                <option key={c.id} value={c.id}>{c.full_name || c.email}</option>
              ))}
            </select>
            {coordinators.length === 0 && (
              <p style={{ fontSize: '0.75rem', color: 'var(--text-3)', marginTop: '0.35rem' }}>
                No coordinator accounts yet. Assign the coordinator role to a user first.
              </p>
            )}
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--moss)', marginBottom: '0.4rem' }}>Ordering Windows</label>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-3)', marginBottom: '0.5rem' }}>
              When buyers can order from growers in this hub (unless a grower overrides it individually). Add as many windows as you need — ordering is open during any of them. With none, the hub stays open at all times.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              {windows.map((w, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr auto', gap: '0.6rem', alignItems: 'center' }}>
                  <select className="input" value={w.day} onChange={e => updateWindow(i, { day: e.target.value })} required>
                    <option value="">Day…</option>
                    {['monday','tuesday','wednesday','thursday','friday','saturday','sunday'].map(d => (
                      <option key={d} value={d}>{d[0].toUpperCase() + d.slice(1)}</option>
                    ))}
                  </select>
                  <input className="input" type="time" value={w.open} onChange={e => updateWindow(i, { open: e.target.value })} required aria-label="Opens" />
                  <input className="input" type="time" value={w.close} onChange={e => updateWindow(i, { close: e.target.value })} required aria-label="Closes" />
                  <button type="button" onClick={() => setWindows(ws => ws.filter((_, idx) => idx !== i))} aria-label="Remove window"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#B91C1C', fontSize: '1rem', padding: '0.25rem 0.4rem' }}>✕</button>
                </div>
              ))}
              <button type="button" onClick={() => setWindows(ws => [...ws, { day: '', open: '08:00', close: '17:00' }])}
                className="btn btn-ghost btn-sm" style={{ alignSelf: 'flex-start' }}>
                + Add ordering window
              </button>
            </div>
          </div>

          {error && (
            <div style={{ padding: '0.75rem 1rem', background: '#FEE2E2', borderRadius: '8px', fontSize: '0.82rem', color: '#B91C1C', fontWeight: 600 }}>
              ⚠ {error}
            </div>
          )}

          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', paddingTop: '0.25rem' }}>
            <button type="button" onClick={onClose} className="btn btn-ghost btn-sm" style={{ minWidth: '5rem' }}>Cancel</button>
            <button type="submit" disabled={saving || !name.trim()} className="btn btn-sm btn-forest" style={{ minWidth: '7.5rem' }}>
              {saving ? '…' : isEdit ? 'Save Changes' : 'Create Hub / Collective'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── ViewMembersModal ──────────────────────────────────────────────────────────
function ViewMembersModal({ hub, onClose }: { hub: HubRow; onClose: () => void }) {
  const [members, setMembers] = useState<MemberRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/admin/hubs/${hub.id}/members`)
      .then(r => r.json())
      .then(d => { setMembers(d.data || []); setLoading(false) })
      .catch(() => { setError('Failed to load members'); setLoading(false) })
  }, [hub.id])

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(2px)' }} />
      <div style={{ position: 'relative', background: 'var(--surface)', borderRadius: '16px', width: '100%', maxWidth: '36rem', maxHeight: '80vh', display: 'flex', flexDirection: 'column', boxShadow: '0 8px 40px rgba(0,0,0,0.18)', overflow: 'hidden' }}>
        <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border-light)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', color: 'var(--forest)', fontWeight: 700, marginBottom: '0.1rem' }}>
              👥 Growers in this hub
            </h2>
            <p style={{ fontSize: '0.78rem', color: 'var(--moss)' }}>{hub.name}</p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.1rem', color: 'var(--text-3)', padding: '0.2rem 0.4rem' }}>✕</button>
        </div>

        <div style={{ overflowY: 'auto', flexGrow: 1, padding: '1rem 1.5rem' }}>
          {loading && <p style={{ color: 'var(--moss)', textAlign: 'center', padding: '2rem 0' }}>Loading…</p>}
          {error   && <p style={{ color: '#B91C1C', textAlign: 'center', padding: '2rem 0' }}>{error}</p>}
          {!loading && !error && members.length === 0 && (
            <p style={{ color: 'var(--moss)', textAlign: 'center', padding: '2rem 0', opacity: 0.6 }}>No growers assigned to this hub yet.</p>
          )}
          {members.map(m => {
            const sub = m.subscriptions?.[0]
            const st  = sub ? (SUB_STATUS_STYLE[sub.status] ?? SUB_STATUS_STYLE.expired) : null
            return (
              <div key={m.id} style={{ padding: '0.85rem 0', borderBottom: '1px solid var(--border-light)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
                <div>
                  <p style={{ fontWeight: 700, color: 'var(--forest)', fontSize: '0.875rem', marginBottom: '0.15rem' }}>
                    {m.business_name || m.profiles?.full_name || '—'}
                  </p>
                  <p style={{ fontSize: '0.75rem', color: 'var(--moss)' }}>{m.profiles?.email || '—'}</p>
                  {sub && <p style={{ fontSize: '0.7rem', color: 'var(--text-3)', marginTop: '0.2rem' }}>Plan: {sub.plan}</p>}
                </div>
                {st && sub && (
                  <span style={{ padding: '3px 10px', borderRadius: '99px', fontSize: '0.7rem', fontWeight: 700, background: st.bg, color: st.color, whiteSpace: 'nowrap', flexShrink: 0 }}>
                    {sub.status.charAt(0).toUpperCase() + sub.status.slice(1)}
                  </span>
                )}
              </div>
            )
          })}
        </div>

        <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid var(--border-light)', textAlign: 'right', flexShrink: 0 }}>
          <button onClick={onClose} className="btn btn-ghost btn-sm">Close</button>
        </div>
      </div>
    </div>
  )
}

// ── EmailCoordinatorModal ─────────────────────────────────────────────────────
function EmailCoordinatorModal({ hub, onClose }: { hub: HubRow; onClose: () => void }) {
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [error,   setError]   = useState<string | null>(null)
  const [sent,    setSent]    = useState(false)

  const coordEmail = hub.profiles?.email

  async function handleSend(e: React.FormEvent) {
    e.preventDefault()
    if (!subject.trim() || !message.trim()) return
    setSending(true); setError(null)
    const res  = await fetch(`/api/admin/hubs/${hub.id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subject: subject.trim(), message: message.trim() }),
    })
    const data = await res.json()
    if (!res.ok) { setError(data.error || 'Failed to send email'); setSending(false); return }
    setSent(true)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(2px)' }} />
      <div style={{ position: 'relative', background: 'var(--surface)', borderRadius: '16px', width: '100%', maxWidth: '32rem', boxShadow: '0 8px 40px rgba(0,0,0,0.18)', overflow: 'hidden' }}>
        <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border-light)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', color: 'var(--forest)', fontWeight: 700, marginBottom: '0.1rem' }}>
              📧 Email Coordinator
            </h2>
            <p style={{ fontSize: '0.78rem', color: 'var(--moss)' }}>{hub.name}</p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.1rem', color: 'var(--text-3)', padding: '0.2rem 0.4rem' }}>✕</button>
        </div>

        {sent ? (
          <div style={{ padding: '2.5rem 1.5rem', textAlign: 'center' }}>
            <div style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>✅</div>
            <p style={{ fontWeight: 700, color: 'var(--forest)', marginBottom: '0.35rem' }}>Email sent!</p>
            <p style={{ fontSize: '0.82rem', color: 'var(--moss)' }}>Message delivered to {coordEmail}</p>
            <button onClick={onClose} className="btn btn-forest btn-sm" style={{ marginTop: '1.25rem' }}>Done</button>
          </div>
        ) : (
          <form onSubmit={handleSend} style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
            {!coordEmail ? (
              <div style={{ padding: '0.875rem 1rem', background: '#FEF3C7', borderRadius: '8px', fontSize: '0.82rem', color: '#92400E', fontWeight: 600 }}>
                ⚠ No coordinator assigned to this hub. Edit the hub to assign one first.
              </div>
            ) : (
              <div style={{ padding: '0.6rem 1rem', background: 'var(--olive)', borderRadius: '8px', fontSize: '0.8rem', color: 'var(--moss)' }}>
                To: <strong>{hub.profiles?.full_name || 'Coordinator'}</strong> — {coordEmail}
              </div>
            )}

            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--moss)', marginBottom: '0.4rem' }}>Subject *</label>
              <input
                className="input"
                value={subject}
                onChange={e => setSubject(e.target.value)}
                required
                disabled={!coordEmail}
                placeholder="e.g. Market update for your hub"
                style={{ width: '100%' }}
                autoFocus
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--moss)', marginBottom: '0.4rem' }}>Message *</label>
              <textarea
                className="input"
                value={message}
                onChange={e => setMessage(e.target.value)}
                required
                disabled={!coordEmail}
                placeholder="Write your message here…"
                rows={5}
                style={{ width: '100%', resize: 'vertical', fontFamily: 'inherit' }}
              />
            </div>

            {error && (
              <div style={{ padding: '0.75rem 1rem', background: '#FEE2E2', borderRadius: '8px', fontSize: '0.82rem', color: '#B91C1C', fontWeight: 600 }}>
                ⚠ {error}
              </div>
            )}

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button type="button" onClick={onClose} className="btn btn-ghost btn-sm">Cancel</button>
              <button type="submit" disabled={sending || !coordEmail || !subject.trim() || !message.trim()} className="btn btn-sm btn-forest" style={{ minWidth: '7rem' }}>
                {sending ? 'Sending…' : 'Send Email'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

// ── DeleteHubModal ────────────────────────────────────────────────────────────
function DeleteHubModal({ hub, onClose, onDeleted }: { hub: HubRow; onClose: () => void; onDeleted: (id: string) => void }) {
  const [deleting, setDeleting] = useState(false)
  const [error,    setError]    = useState<string | null>(null)

  async function handleDelete() {
    setDeleting(true); setError(null)
    const res  = await fetch(`/api/admin/hubs/${hub.id}`, { method: 'DELETE' })
    const data = await res.json()
    if (!res.ok) { setError(data.error || 'Failed to delete hub'); setDeleting(false); return }
    onDeleted(hub.id)
    onClose()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(2px)' }} />
      <div style={{ position: 'relative', background: 'var(--surface)', borderRadius: '16px', width: '100%', maxWidth: '26rem', boxShadow: '0 8px 40px rgba(0,0,0,0.18)', overflow: 'hidden' }}>
        <div style={{ padding: '1.75rem 1.5rem', textAlign: 'center' }}>
          <div style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>🗑️</div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', color: '#B91C1C', fontWeight: 700, marginBottom: '0.5rem' }}>
            Delete Hub
          </h2>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-1)', marginBottom: '0.3rem' }}>
            You're about to permanently delete
          </p>
          <p style={{ fontWeight: 700, color: 'var(--forest)', fontSize: '1rem', marginBottom: '1rem' }}>
            {hub.name}
          </p>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-3)', marginBottom: '0.25rem' }}>
            This action cannot be undone. If any growers are still assigned to this hub, the delete will be blocked.
          </p>

          {error && (
            <div style={{ margin: '1rem 0 0', padding: '0.75rem 1rem', background: '#FEE2E2', borderRadius: '8px', fontSize: '0.82rem', color: '#B91C1C', fontWeight: 600, textAlign: 'left' }}>
              ⚠ {error}
            </div>
          )}
        </div>

        <div style={{ padding: '0 1.5rem 1.5rem', display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
          <button onClick={onClose} className="btn btn-ghost btn-sm" style={{ minWidth: '6rem' }}>Cancel</button>
          <button
            onClick={handleDelete}
            disabled={deleting}
            style={{ minWidth: '8rem', padding: '0.5rem 1.25rem', background: deleting ? '#ccc' : '#B91C1C', color: 'white', border: 'none', borderRadius: '99px', fontWeight: 700, fontSize: '0.85rem', cursor: deleting ? 'not-allowed' : 'pointer' }}
          >
            {deleting ? 'Deleting…' : 'Yes, Delete Hub'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── HubsContent ───────────────────────────────────────────────────────────────
export default function HubsContent({ initialHubs }: { initialHubs: any[] }) {
  const [hubs,         setHubs]         = useState<HubRow[]>(initialHubs)
  const [coordinators, setCoordinators] = useState<Coordinator[]>([])
  const [updating,     setUpdating]     = useState<string | null>(null)
  const [modalHub,     setModalHub]     = useState<HubRow | 'new' | null>(null)
  const [activeModal,  setActiveModal]  = useState<ActiveModal | null>(null)

  useEffect(() => {
    fetch('/api/admin/coordinators')
      .then(r => r.json())
      .then(d => setCoordinators(d.data || []))
  }, [])

  async function toggleStatus(hub: HubRow) {
    const next = hub.status === 'active' ? 'inactive' : 'active'
    setUpdating(hub.id)
    const res  = await fetch('/api/admin/hubs', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: hub.id, status: next }),
    })
    const data = await res.json()
    if (res.ok) setHubs(hs => hs.map(h => h.id === hub.id ? (data.hub ?? { ...h, status: next }) : h))
    setUpdating(null)
  }

  function handleSaved(saved: HubRow) {
    setHubs(hs => {
      const exists = hs.some(h => h.id === saved.id)
      return exists ? hs.map(h => h.id === saved.id ? saved : h) : [saved, ...hs]
    })
  }

  function handleDeleted(id: string) {
    setHubs(hs => hs.filter(h => h.id !== id))
  }

  const pending  = hubs.filter(h => h.status === 'pending')
  const active   = hubs.filter(h => h.status === 'active').length
  const inactive = hubs.filter(h => h.status === 'inactive').length

  return (
    <div className="page-pad" style={{ padding: '2.5rem' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1.75rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 className="type-heading reveal" style={{ color: 'var(--forest)', marginBottom: '0.25rem' }}>Hubs & Collectives</h1>
          <p className="type-label" style={{ color: 'var(--moss)' }}>{hubs.length} hub{hubs.length !== 1 ? 's' : ''} · {active} active · {inactive} inactive</p>
        </div>
        <button
          onClick={() => setModalHub('new')}
          className="btn btn-sm btn-forest"
          style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexShrink: 0 }}
        >
          + Create Hub / Collective
        </button>
      </div>

      {/* Pending alert */}
      {pending.length > 0 && (
        <div style={{ padding: '1rem 1.5rem', background: '#FEF3C7', border: '1px solid #FDE68A', borderRadius: '1rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'flex-start', gap: '0.875rem' }}>
          <span style={{ fontSize: '1.25rem' }}>⏳</span>
          <div>
            <p style={{ fontWeight: 700, color: '#92400E', fontSize: '0.875rem', marginBottom: '0.2rem' }}>
              {pending.length} hub{pending.length > 1 ? 's' : ''} awaiting approval
            </p>
            <p style={{ fontSize: '0.8rem', color: '#92400E', opacity: 0.8 }}>Review and activate below to allow growers to join.</p>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="card reveal" style={{ overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
          <thead>
            <tr style={{ background: 'var(--olive)', borderBottom: '1px solid var(--sage)' }}>
              {['Hub / Collective', 'Region', 'Coordinator', 'Registered', 'Status', 'Actions'].map((h, i) => (
                <th key={i} className="type-label-sm" style={{ padding: '1rem 1.25rem', textAlign: 'left', color: 'var(--moss)', letterSpacing: '0.15em', whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {hubs.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ padding: '3.5rem', textAlign: 'center', color: 'var(--moss)', opacity: 0.5 }}>
                  No hubs yet — create one above
                </td>
              </tr>
            ) : hubs.map(hub => {
              const st = STATUS_STYLE[hub.status] ?? STATUS_STYLE.inactive
              return (
                <tr key={hub.id} className="table-row">
                  <td style={{ padding: '0.875rem 1.25rem' }}>
                    <p style={{ fontWeight: 700, color: 'var(--forest)' }}>{hub.name}</p>
                  </td>
                  <td style={{ padding: '0.875rem 1.25rem', color: 'var(--moss)' }}>
                    {hub.region || <span style={{ opacity: 0.4 }}>—</span>}
                  </td>
                  <td style={{ padding: '0.875rem 1.25rem' }}>
                    {hub.profiles ? (
                      <>
                        <p style={{ fontWeight: 600, color: 'var(--forest)', fontSize: '0.85rem' }}>{hub.profiles.full_name || '—'}</p>
                        <p style={{ fontSize: '0.75rem', color: 'var(--moss)' }}>{hub.profiles.email}</p>
                      </>
                    ) : (
                      <span style={{ fontSize: '0.8rem', color: 'var(--moss)', opacity: 0.45, fontStyle: 'italic' }}>Unassigned</span>
                    )}
                  </td>
                  <td style={{ padding: '0.875rem 1.25rem', fontSize: '0.8rem', color: 'var(--moss)', whiteSpace: 'nowrap' }}>
                    {formatAEST(hub.created_at, 'dd MMM yyyy')}
                  </td>
                  <td style={{ padding: '0.875rem 1.25rem' }}>
                    <span style={{ padding: '3px 10px', borderRadius: '99px', fontSize: '0.7rem', fontWeight: 700, background: st.bg, color: st.color, whiteSpace: 'nowrap' }}>
                      {hub.status.charAt(0).toUpperCase() + hub.status.slice(1)}
                    </span>
                  </td>
                  <td style={{ padding: '0.875rem 1.25rem', textAlign: 'right' }}>
                    <ActionsMenu
                      hub={hub}
                      onEdit={() => setModalHub(hub)}
                      onToggle={() => toggleStatus(hub)}
                      onViewMembers={() => setActiveModal({ type: 'members', hub })}
                      onEmail={() => setActiveModal({ type: 'email', hub })}
                      onDelete={() => setActiveModal({ type: 'delete', hub })}
                      disabled={updating === hub.id}
                    />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Create / Edit modal */}
      {modalHub !== null && (
        <HubModal
          hub={modalHub === 'new' ? null : modalHub}
          coordinators={coordinators}
          onClose={() => setModalHub(null)}
          onSave={handleSaved}
        />
      )}

      {/* Extra action modals */}
      {activeModal?.type === 'members' && (
        <ViewMembersModal hub={activeModal.hub} onClose={() => setActiveModal(null)} />
      )}
      {activeModal?.type === 'email' && (
        <EmailCoordinatorModal hub={activeModal.hub} onClose={() => setActiveModal(null)} />
      )}
      {activeModal?.type === 'delete' && (
        <DeleteHubModal hub={activeModal.hub} onClose={() => setActiveModal(null)} onDeleted={handleDeleted} />
      )}
    </div>
  )
}
