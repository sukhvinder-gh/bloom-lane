// src/app/dashboard/admin/config/page.tsx
// Live platform config editor — changes take effect immediately
'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

interface ConfigRow {
  id: string
  key: string
  value: string
  description: string | null
}

const EDITABLE_CONFIGS = [
  { key: 'markup_pct_b2c',          label: 'B2C Markup %',              hint: 'e.g. 0.45 = 45% over wholesale',   type: 'number' },
  { key: 'delivery_fee_cents',       label: 'Delivery Fee',              hint: 'In cents (2000 = $20.00)',          type: 'number' },
  { key: 'dispute_window_hrs',       label: 'Dispute Window (hours)',    hint: 'Hours after delivery buyer can dispute', type: 'number' },
  { key: 'b2b_stock_pct',            label: 'B2B Stock %',               hint: 'e.g. 0.80 = 80% reserved for B2B', type: 'number' },
  { key: 'commission_rate_default',  label: 'Default Commission Rate',   hint: 'e.g. 0.10 = 10%',                  type: 'number' },
  { key: 'min_order_b2b_cents',      label: 'Min B2B Order (cents)',     hint: '0 = no minimum, 5000 = $50',       type: 'number' },
  { key: 'platform_name',            label: 'Platform Name',             hint: 'Display name across the app',      type: 'text'   },
  { key: 'listing_window_close_time',label: 'Listing Close Time (AEST)', hint: 'e.g. 23:59 (Tuesday)',             type: 'text'   },
  { key: 'market_open_time_aest',    label: 'Market Open Time (AEST)',   hint: 'e.g. 08:00 (Wednesday)',           type: 'text'   },
  { key: 'market_close_time_aest',   label: 'Market Close Time (AEST)',  hint: 'e.g. 20:00 (Wednesday)',           type: 'text'   },
]

export default function AdminConfigPage() {
  const [config, setConfig]     = useState<Record<string, string>>({})
  const [loading, setLoading]   = useState(true)
  const [saving, setSaving]     = useState<string | null>(null)
  const [saved, setSaved]       = useState<string | null>(null)
  const [error, setError]       = useState<string | null>(null)
  const supabase = createClient()

  useEffect(() => {
    async function loadConfig() {
      const { data } = await supabase.from('config').select('key, value')
      if (data) {
        const map: Record<string, string> = {}
        data.forEach((row: any) => { map[row.key] = row.value })
        setConfig(map)
      }
      setLoading(false)
    }
    loadConfig()
  }, [])

  async function handleSave(key: string, value: string) {
    setSaving(key)
    setError(null)
    const { error } = await supabase
      .from('config')
      .update({ value, updated_at: new Date().toISOString() })
      .eq('key', key)

    if (error) {
      setError(`Failed to save ${key}: ${error.message}`)
    } else {
      setSaved(key)
      setTimeout(() => setSaved(null), 2000)
    }
    setSaving(null)
  }

  if (loading) {
    return (
      <div style={{ padding: '2.5rem', fontFamily: 'var(--font-body)', color: 'var(--forest)', opacity: 0.5 }}>
        Loading config...
      </div>
    )
  }

  return (
    <div style={{ padding: '2.5rem', fontFamily: 'var(--font-body)', maxWidth: '48rem' }}>
      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', color: 'var(--forest)', marginBottom: '0.25rem' }}>
        Platform Config
      </h1>
      <p style={{ color: 'var(--forest)', opacity: 0.5, marginBottom: '2rem', fontSize: '0.9rem' }}>
        Changes take effect immediately — no restart required
      </p>

      {error && (
        <div style={{ background: '#fee2e2', color: '#991b1b', padding: '0.75rem 1rem', borderRadius: '0.5rem', marginBottom: '1.5rem', fontSize: '0.875rem' }}>
          {error}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {EDITABLE_CONFIGS.map(cfg => (
          <div key={cfg.key} style={{ background: 'white', borderRadius: '1rem', padding: '1.25rem 1.5rem', border: '1px solid var(--olive)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1.5rem' }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontWeight: 700, color: 'var(--forest)', fontSize: '0.875rem', marginBottom: '0.2rem' }}>
                {cfg.label}
              </label>
              <p style={{ fontSize: '0.75rem', color: 'var(--forest)', opacity: 0.5 }}>{cfg.hint}</p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexShrink: 0 }}>
              <input
                type={cfg.type}
                value={config[cfg.key] ?? ''}
                onChange={e => setConfig(prev => ({ ...prev, [cfg.key]: e.target.value }))}
                style={{
                  width: cfg.type === 'number' ? '9rem' : '14rem',
                  padding: '0.5rem 0.75rem',
                  borderRadius: '0.5rem',
                  border: '1.5px solid var(--sage)',
                  fontFamily: 'var(--font-body)',
                  fontSize: '0.9rem',
                  color: 'var(--forest)',
                  background: 'var(--cream)',
                  outline: 'none',
                }}
              />
              <button
                onClick={() => handleSave(cfg.key, config[cfg.key] ?? '')}
                disabled={saving === cfg.key}
                style={{
                  padding: '0.5rem 1rem',
                  borderRadius: '0.5rem',
                  background: saved === cfg.key ? '#dcfce7' : 'var(--forest)',
                  color: saved === cfg.key ? '#166534' : 'var(--cream)',
                  border: 'none',
                  fontFamily: 'var(--font-body)',
                  fontWeight: 700,
                  fontSize: '0.8rem',
                  cursor: saving === cfg.key ? 'wait' : 'pointer',
                  minWidth: '4.5rem',
                  transition: 'all 0.2s',
                }}
              >
                {saving === cfg.key ? '...' : saved === cfg.key ? '✓ Saved' : 'Save'}
              </button>
            </div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: '2rem', padding: '1rem 1.25rem', background: 'var(--olive)', borderRadius: '0.75rem', fontSize: '0.8rem', color: 'var(--forest)', opacity: 0.7 }}>
        ⚠️ Changing B2C Markup or Stock Split affects all new orders immediately. Existing orders are unaffected.
      </div>
    </div>
  )
}
