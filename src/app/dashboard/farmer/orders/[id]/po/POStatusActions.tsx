'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

type POStatus = 'pending' | 'ready' | 'delivered_to_hub' | 'rejected'

interface StepConfig {
  label: string
  color: string
  bg: string
  next?: { status: string; btnLabel: string; confirmText: string }
}

const STANDARD_STEPS: Record<string, StepConfig> = {
  pending: {
    label: 'Awaiting action',
    color: '#92400e',
    bg: '#fef3c7',
    next: {
      status: 'ready',
      btnLabel: 'Mark items as ready',
      confirmText: 'Confirm that all items are packed and ready for hub drop-off.',
    },
  },
  ready: {
    label: 'Items ready',
    color: '#065f46',
    bg: '#d1fae5',
    next: {
      status: 'delivered_to_hub',
      btnLabel: 'Mark as delivered to hub',
      confirmText: 'Confirm you have physically delivered your items to the hub.',
    },
  },
  delivered_to_hub: {
    label: 'Delivered to hub',
    color: '#1e40af',
    bg: '#dbeafe',
  },
  rejected: {
    label: 'Rejected',
    color: '#b91c1c',
    bg: '#fee2e2',
  },
}

// Farm pickup skips the hub leg — 'ready' means ready for the buyer to
// collect from the farm, and that's the end of the grower's workflow.
const FARM_PICKUP_STEPS: Record<string, StepConfig> = {
  pending: {
    label: 'Awaiting action',
    color: '#92400e',
    bg: '#fef3c7',
    next: {
      status: 'ready',
      btnLabel: 'Mark ready for pickup',
      confirmText: 'Confirm items are packed and ready for the buyer to collect from your farm.',
    },
  },
  ready: {
    label: 'Ready for pickup',
    color: '#065f46',
    bg: '#d1fae5',
  },
  rejected: {
    label: 'Rejected',
    color: '#b91c1c',
    bg: '#fee2e2',
  },
}

export function POStatusActions({
  orderId,
  initialStatus,
  pickupMethod = 'standard',
}: {
  orderId: string
  initialStatus: POStatus
  pickupMethod?: 'standard' | 'farm_pickup'
}) {
  const [status, setStatus] = useState<string>(initialStatus)
  const [confirming, setConfirming] = useState(false)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const STEPS = pickupMethod === 'farm_pickup' ? FARM_PICKUP_STEPS : STANDARD_STEPS
  const config = STEPS[status] ?? { label: status, color: 'var(--forest)', bg: 'var(--olive)' }

  async function advance() {
    if (!config.next) return
    setLoading(true)
    const res = await fetch(`/api/farmer/orders/${orderId}/po-status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: config.next.status }),
    })
    if (res.ok) {
      setStatus(config.next.status)
      setConfirming(false)
      router.refresh()
    } else {
      const data = await res.json().catch(() => ({}))
      alert(data.error || 'Could not update status. Please try again.')
    }
    setLoading(false)
  }

  return (
    <div className="no-print" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
      {/* Status row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.15em', color: 'var(--moss)', fontWeight: 700 }}>
          Your PO status
        </span>
        <span style={{
          padding: '0.3rem 1rem',
          borderRadius: '999px',
          fontSize: '0.8rem',
          fontWeight: 700,
          color: config.color,
          background: config.bg,
        }}>
          {config.label}
        </span>

        {config.next && !confirming && (
          <button
            onClick={() => setConfirming(true)}
            className="btn btn-forest btn-sm"
          >
            {config.next.btnLabel} →
          </button>
        )}
      </div>

      {/* Confirmation card */}
      {confirming && config.next && (
        <div style={{
          background: 'var(--olive)',
          border: '1px solid var(--sage)',
          borderRadius: '1rem',
          padding: '1rem 1.25rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.75rem',
          maxWidth: '30rem',
        }}>
          <p style={{ fontSize: '0.875rem', color: 'var(--forest)', fontWeight: 600 }}>
            {config.next.confirmText}
          </p>
          <div style={{ display: 'flex', gap: '0.625rem' }}>
            <button
              onClick={() => setConfirming(false)}
              className="btn btn-ghost btn-sm"
              style={{ flex: 1 }}
              disabled={loading}
            >
              Cancel
            </button>
            <button
              onClick={advance}
              className="btn btn-forest btn-sm"
              style={{ flex: 1 }}
              disabled={loading}
            >
              {loading ? 'Updating…' : 'Confirm'}
            </button>
          </div>
        </div>
      )}

      {/* Completion note */}
      {status === 'delivered_to_hub' && (
        <p style={{ fontSize: '0.8rem', color: 'var(--moss)', maxWidth: '36rem' }}>
          Your items are confirmed at the hub. The buyer order will advance to &ldquo;Ready for pickup&rdquo; once all growers have delivered.
        </p>
      )}
      {pickupMethod === 'farm_pickup' && status === 'ready' && (
        <p style={{ fontSize: '0.8rem', color: 'var(--moss)', maxWidth: '36rem' }}>
          The buyer has been notified to collect directly from your farm. No hub delivery needed for this order.
        </p>
      )}
    </div>
  )
}
