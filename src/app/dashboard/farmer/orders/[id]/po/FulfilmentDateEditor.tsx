'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

// Native <input type="datetime-local"> renders its date portion in whatever
// format the browser's OS locale uses (MM/DD/YYYY on a US-locale machine) —
// there's no HTML/CSS way to force that widget into dd/mm/yyyy, so the date
// and time are split into two plain inputs we format and parse ourselves.
function toDateParts(iso: string | null): { date: string; time: string } {
  if (!iso) return { date: '', time: '' }
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return {
    date: `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
  }
}

function parseDateParts(date: string, time: string): Date | null {
  const dateMatch = date.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  const timeMatch = time.trim().match(/^(\d{1,2}):(\d{2})$/)
  if (!dateMatch || !timeMatch) return null
  const [, dd, mm, yyyy] = dateMatch
  const [, hh, min] = timeMatch
  const d = new Date(Number(yyyy), Number(mm) - 1, Number(dd), Number(hh), Number(min))
  if (d.getMonth() !== Number(mm) - 1 || d.getDate() !== Number(dd)) return null // rejects e.g. 31/02
  return d
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
  const [parts, setParts] = useState(() => toDateParts(initialDate))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  async function save() {
    const parsed = parseDateParts(parts.date, parts.time)
    if (!parsed) { setError('Enter a valid date (DD/MM/YYYY) and time (HH:MM)'); return }
    setSaving(true)
    setError(null)
    const res = await fetch(`/api/farmer/orders/${orderId}/fulfillment-date`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ grower_fulfillment_date: parsed.toISOString() }),
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
    <span className="no-print" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
      <input
        type="text"
        className="input"
        placeholder="DD/MM/YYYY"
        value={parts.date}
        onChange={e => setParts(p => ({ ...p, date: e.target.value }))}
        style={{ fontSize: '0.8rem', padding: '0.25rem 0.5rem', width: '7rem' }}
      />
      <input
        type="text"
        className="input"
        placeholder="HH:MM"
        value={parts.time}
        onChange={e => setParts(p => ({ ...p, time: e.target.value }))}
        style={{ fontSize: '0.8rem', padding: '0.25rem 0.5rem', width: '4.5rem' }}
      />
      <button onClick={save} disabled={saving} className="btn btn-sm" style={{ padding: '0.15rem 0.6rem', fontSize: '0.75rem' }}>
        {saving ? 'Saving…' : 'Save'}
      </button>
      <button onClick={() => { setEditing(false); setError(null) }} className="btn btn-ghost btn-sm" style={{ padding: '0.15rem 0.6rem', fontSize: '0.75rem' }}>
        Cancel
      </button>
      {error && <span style={{ fontSize: '0.7rem', color: '#b91c1c', width: '100%' }}>{error}</span>}
    </span>
  )
}
