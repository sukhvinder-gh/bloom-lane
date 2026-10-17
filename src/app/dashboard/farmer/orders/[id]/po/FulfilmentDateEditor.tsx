'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

// Converts an ISO timestamp to the value <input type="datetime-local">
// expects — local wall-clock, no timezone/seconds.
function toInputValue(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function FulfilmentDateEditor({
  orderId,
  initialDate,
  displayValue,
}: {
  orderId: string
  initialDate: string | null
  displayValue: string
}) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(() => toInputValue(initialDate))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  async function save() {
    if (!value) { setError('Pick a date and time'); return }
    setSaving(true)
    setError(null)
    const res = await fetch(`/api/farmer/orders/${orderId}/fulfillment-date`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ grower_fulfillment_date: new Date(value).toISOString() }),
    })
    setSaving(false)
    if (res.ok) {
      setEditing(false)
      router.refresh()
    } else {
      const body = await res.json().catch(() => ({}))
      setError(body.error || 'Could not save — please try again')
    }
  }

  if (!editing) {
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
        <span style={{ fontSize: '0.8rem', color: 'var(--forest)', fontWeight: 600, whiteSpace: 'nowrap' }}>{displayValue}</span>
        <button
          onClick={() => setEditing(true)}
          className="btn btn-ghost btn-sm no-print"
          style={{ padding: '0.1rem 0.5rem', fontSize: '0.7rem' }}
        >
          Edit
        </button>
      </span>
    )
  }

  return (
    <span className="no-print" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
      <input
        type="datetime-local"
        className="input"
        value={value}
        onChange={e => setValue(e.target.value)}
        style={{ fontSize: '0.8rem', padding: '0.25rem 0.5rem', width: 'auto' }}
      />
      <button onClick={save} disabled={saving} className="btn btn-sm" style={{ padding: '0.15rem 0.6rem', fontSize: '0.75rem' }}>
        {saving ? 'Saving…' : 'Save'}
      </button>
      <button onClick={() => { setEditing(false); setError(null) }} className="btn btn-ghost btn-sm" style={{ padding: '0.15rem 0.6rem', fontSize: '0.75rem' }}>
        Cancel
      </button>
      {error && <span style={{ fontSize: '0.7rem', color: '#b91c1c' }}>{error}</span>}
    </span>
  )
}
