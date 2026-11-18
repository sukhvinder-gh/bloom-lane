'use client'
import { useState, useEffect, useCallback } from 'react'

type Hub = { id: string; name: string; status: string }
type Checkin = { checkin_type: string; checked_in_at: string } | null
type Row = {
  purchase_order_id: string
  order_number: string
  buyer_name: string
  farmer_name: string
  grower_fulfillment_date: string
  grower_dropoff: Checkin
  buyer_collection: Checkin
}

function todayISO() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function CollectionPointPage() {
  const [hubs, setHubs] = useState<Hub[]>([])
  const [hubId, setHubId] = useState('')
  const [date, setDate] = useState(todayISO())
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/coordinator/hub').then(r => r.json()).then(data => {
      const active = (data.hubs || []).filter((h: Hub) => h.status === 'active')
      setHubs(active)
      if (active.length > 0) setHubId(active[0].id)
    })
  }, [])

  const load = useCallback(() => {
    if (!hubId || !date) return
    setLoading(true)
    fetch(`/api/coordinator/hub/checkins?hub_id=${hubId}&date=${date}`)
      .then(r => r.json())
      .then(data => { setRows(data.data || []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [hubId, date])

  useEffect(() => { load() }, [load])

  async function toggleCheckin(row: Row, checkinType: 'grower_dropoff' | 'buyer_collection') {
    setBusyId(row.purchase_order_id + checkinType)
    setError(null)
    const already = checkinType === 'grower_dropoff' ? row.grower_dropoff : row.buyer_collection
    const res = await fetch('/api/coordinator/hub/checkins', {
      method: already ? 'DELETE' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ purchase_order_id: row.purchase_order_id, checkin_type: checkinType, hub_id: hubId }),
    })
    if (res.ok) {
      load()
    } else {
      const data = await res.json().catch(() => ({}))
      setError(data.error || 'Could not update check-in')
    }
    setBusyId(null)
  }

  if (hubs.length === 0 && !loading) {
    return (
      <div className="page-pad" style={{ padding: '2.5rem', maxWidth: '44rem' }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', color: 'var(--forest)' }}>Collection Point</h1>
        <p style={{ fontSize: '0.875rem', color: 'var(--moss)', marginTop: '0.5rem' }}>You need an active hub before you can track collection point check-ins.</p>
      </div>
    )
  }

  return (
    <div className="page-pad" style={{ padding: '2.5rem', maxWidth: '54rem' }}>
      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', color: 'var(--forest)', marginBottom: '0.25rem' }}>Collection Point</h1>
      <p style={{ fontSize: '0.875rem', color: 'var(--moss)', marginBottom: '1.5rem' }}>
        Growers due to drop off, and buyers due to collect, at your hub on the selected date.
      </p>

      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        {hubs.length > 1 && (
          <select className="input" value={hubId} onChange={e => setHubId(e.target.value)}>
            {hubs.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
          </select>
        )}
        <input className="input" type="date" value={date} onChange={e => setDate(e.target.value)} />
      </div>

      {error && (
        <div style={{ padding: '0.875rem 1rem', background: '#FEE2E2', borderRadius: '0.75rem', fontSize: '0.85rem', color: '#B91C1C', fontWeight: 600, marginBottom: '1rem' }}>
          ⚠ {error}
        </div>
      )}

      {loading ? (
        <p style={{ fontSize: '0.85rem', color: 'var(--moss)' }}>Loading…</p>
      ) : rows.length === 0 ? (
        <p style={{ fontSize: '0.85rem', color: 'var(--moss)' }}>Nothing due for collection at your hub on this date.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {rows.map(row => (
            <div key={row.purchase_order_id} className="card" style={{ padding: '1.25rem 1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
              <div>
                <p style={{ fontWeight: 700, color: 'var(--forest)' }}>{row.farmer_name} → {row.buyer_name}</p>
                <p style={{ fontSize: '0.8rem', color: 'var(--moss)' }}>Order {row.order_number}</p>
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', fontSize: '0.8rem', color: 'var(--forest)' }}>
                  <input type="checkbox" checked={!!row.grower_dropoff} disabled={busyId === row.purchase_order_id + 'grower_dropoff'}
                    onChange={() => toggleCheckin(row, 'grower_dropoff')}
                    style={{ width: '1.05rem', height: '1.05rem', accentColor: 'var(--forest)' }} />
                  Grower dropped off
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', fontSize: '0.8rem', color: 'var(--forest)' }}>
                  <input type="checkbox" checked={!!row.buyer_collection} disabled={busyId === row.purchase_order_id + 'buyer_collection'}
                    onChange={() => toggleCheckin(row, 'buyer_collection')}
                    style={{ width: '1.05rem', height: '1.05rem', accentColor: 'var(--forest)' }} />
                  Buyer collected
                </label>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
