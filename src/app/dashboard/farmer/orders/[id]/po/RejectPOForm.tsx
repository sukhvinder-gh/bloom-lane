'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function RejectPOForm({ orderId, farmerId }: { orderId: string; farmerId: string }) {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function submit() {
    if (!reason.trim()) return
    setLoading(true)
    const res = await fetch(`/api/orders/${orderId}/po/reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason, farmer_id: farmerId }),
    })
    if (res.ok) {
      router.refresh()
    } else {
      alert('Could not submit rejection. Please try again.')
    }
    setLoading(false)
    setOpen(false)
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="btn btn-sm" style={{ background: '#fee2e2', color: '#b91c1c', border: '1px solid #fecaca' }}>
        Reject PO
      </button>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', background: '#fff', border: '1px solid #fecaca', borderRadius: '1rem', padding: '1rem', minWidth: '22rem' }}>
      <p style={{ fontWeight: 700, fontSize: '0.875rem', color: '#b91c1c', marginBottom: '0.25rem' }}>Reject this Purchase Order</p>
      <textarea
        className="input"
        style={{ height: '4rem', resize: 'none', fontSize: '0.85rem' }}
        placeholder="Reason for rejection (e.g. out of stock, cannot fulfil this week)…"
        value={reason}
        onChange={e => setReason(e.target.value)}
      />
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <button onClick={() => setOpen(false)} className="btn btn-ghost btn-sm" style={{ flex: 1 }}>Cancel</button>
        <button
          onClick={submit}
          disabled={loading || !reason.trim()}
          className="btn btn-sm"
          style={{ flex: 1, background: '#b91c1c', color: 'white' }}
        >
          {loading ? 'Submitting…' : 'Confirm rejection'}
        </button>
      </div>
    </div>
  )
}
