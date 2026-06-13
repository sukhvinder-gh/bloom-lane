'use client'
import { useState, useEffect, useRef } from 'react'
import { formatAEST } from '@/lib/utils/timezone'

type HubRow = {
  id: string
  name: string
  region: string | null
  coordinator_id: string | null
  status: 'pending' | 'active' | 'inactive'
  created_at: string
  profiles?: { full_name: string | null; email: string | null } | null
}

type Coordinator = { id: string; full_name: string | null; email: string | null }

const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  pending:  { bg: '#FEF3C7', color: '#92400E' },
  active:   { bg: '#D1FAE5', color: '#065F46' },
  inactive: { bg: '#F1EFE8', color: '#5F5E5A' },
}

// ── ActionsMenu ───────────────────────────────────────────────────────────────
function ActionsMenu({ hub, onEdit, onToggle, disabled }: {
  hub: HubRow
  onEdit: () => void
  onToggle: () => void
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
      {open && (
        <div
          ref={menuRef}
          style={{ position: 'fixed', top: pos.top, right: pos.right, background: 'var(--surface)', border: '1px solid var(--border-light)', borderRadius: '10px', boxShadow: '0 4px 20px rgba(0,0,0,0.14)', zIndex: 1000, minWidth: '190px', overflow: 'hidden' }}
        >
          <button
            onClick={() => { onEdit(); setOpen(false) }}
            style={{ display: 'block', width: '100%', textAlign: 'left', padding: '0.75rem 1rem', background: 'none', border: 'none', borderBottom: '1px solid var(--border-light)', cursor: 'pointer', fontSize: '0.85rem', color: 'var(--text-1)' }}
          >
            ✏️ Edit hub
          </button>
          <button
            onClick={() => { onToggle(); setOpen(false) }}
            style={{ display: 'block', width: '100%', textAlign: 'left', padding: '0.75rem 1rem', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.85rem', color: hub.status === 'active' ? 'var(--terracotta)' : 'var(--forest)' }}
          >
            {hub.status === 'active' ? '⏸ Deactivate' : '▶ Activate'}
          </button>
        </div>
      )}
    </>
  )
}

// ── HubModal ──────────────────────────────────────────────────────────────────
function HubModal({ hub, coordinators, onClose, onSave }: {
  hub: HubRow | null   // null = create mode
  coordinators: Coordinator[]
  onClose: () => void
  onSave: (hub: HubRow) => void
}) {
  const [name,          setName]          = useState(hub?.name           ?? '')
  const [region,        setRegion]        = useState(hub?.region         ?? '')
  const [coordinatorId, setCoordinatorId] = useState(hub?.coordinator_id ?? '')
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState<string | null>(null)

  const isEdit = hub !== null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true); setError(null)

    const body: Record<string, unknown> = {
      name:           name.trim(),
      region:         region.trim() || null,
      coordinator_id: coordinatorId || null,
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
      {/* Backdrop */}
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(2px)' }} />

      {/* Card */}
      <div style={{ position: 'relative', background: 'var(--surface)', borderRadius: '16px', width: '100%', maxWidth: '30rem', boxShadow: '0 8px 40px rgba(0,0,0,0.18)', overflow: 'hidden' }}>
        <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border-light)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', color: 'var(--forest)', fontWeight: 700 }}>
            {isEdit ? 'Edit Hub' : 'Create Hub'}
          </h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.1rem', color: 'var(--text-3)', padding: '0.2rem 0.4rem' }}>✕</button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--moss)', marginBottom: '0.4rem' }}>Hub Name *</label>
            <input
              className="input"
              value={name}
              onChange={e => setName(e.target.value)}
              required
              placeholder="e.g. Yarra Valley Growers Collective"
              style={{ width: '100%' }}
              autoFocus
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--moss)', marginBottom: '0.4rem' }}>Region</label>
            <input
              className="input"
              value={region}
              onChange={e => setRegion(e.target.value)}
              placeholder="e.g. Yarra Valley, VIC"
              style={{ width: '100%' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--moss)', marginBottom: '0.4rem' }}>Coordinator</label>
            <select
              className="input"
              value={coordinatorId}
              onChange={e => setCoordinatorId(e.target.value)}
              style={{ width: '100%' }}
            >
              <option value="">— Unassigned —</option>
              {coordinators.map(c => (
                <option key={c.id} value={c.id}>{c.full_name || c.email}</option>
              ))}
            </select>
            {coordinators.length === 0 && (
              <p style={{ fontSize: '0.75rem', color: 'var(--text-3)', marginTop: '0.35rem' }}>
                No coordinator accounts yet. Assign the coordinator role to a user first from the Buyers or Growers page.
              </p>
            )}
          </div>

          {error && (
            <div style={{ padding: '0.75rem 1rem', background: '#FEE2E2', borderRadius: '8px', fontSize: '0.82rem', color: '#B91C1C', fontWeight: 600 }}>
              ⚠ {error}
            </div>
          )}

          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', paddingTop: '0.25rem' }}>
            <button type="button" onClick={onClose} className="btn btn-ghost btn-sm" style={{ minWidth: '5rem' }}>
              Cancel
            </button>
            <button type="submit" disabled={saving || !name.trim()} className="btn btn-sm btn-forest" style={{ minWidth: '7.5rem' }}>
              {saving ? '…' : isEdit ? 'Save Changes' : 'Create Hub'}
            </button>
          </div>
        </form>
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

  const pending  = hubs.filter(h => h.status === 'pending')
  const active   = hubs.filter(h => h.status === 'active').length
  const inactive = hubs.filter(h => h.status === 'inactive').length

  return (
    <div className="page-pad" style={{ padding: '2.5rem' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1.75rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 className="type-heading reveal" style={{ color: 'var(--forest)', marginBottom: '0.25rem' }}>Hubs & Groups</h1>
          <p className="type-label" style={{ color: 'var(--moss)' }}>{hubs.length} hub{hubs.length !== 1 ? 's' : ''} · {active} active · {inactive} inactive</p>
        </div>
        <button
          onClick={() => setModalHub('new')}
          className="btn btn-sm btn-forest"
          style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexShrink: 0 }}
        >
          + Create Hub
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
              {['Hub / Group', 'Region', 'Coordinator', 'Registered', 'Status', ''].map((h, i) => (
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
                      disabled={updating === hub.id}
                    />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {modalHub !== null && (
        <HubModal
          hub={modalHub === 'new' ? null : modalHub}
          coordinators={coordinators}
          onClose={() => setModalHub(null)}
          onSave={handleSaved}
        />
      )}
    </div>
  )
}
