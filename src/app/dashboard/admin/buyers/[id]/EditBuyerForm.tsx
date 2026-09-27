'use client'
import { useState } from 'react'
import Link from 'next/link'
import { formatAEST } from '@/lib/utils/timezone'
import { sanitizeABNInput } from '@/lib/utils/abn'

export default function EditBuyerForm({ buyer: initial }: { buyer: any }) {
  const [buyer, setBuyer] = useState(initial)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  const [form, setFormState] = useState({
    full_name:     initial.full_name     || '',
    phone:         initial.phone         || '',
    business_name: initial.business_name || '',
    abn:           initial.abn           || '',
    abn_verified:  initial.abn_verified  || false,
    role:          initial.role          || 'buyer_b2c',
  })

  function set(key: string, value: unknown) {
    setFormState(f => ({ ...f, [key]: value }))
  }

  async function save() {
    setSaving(true)
    setMsg(null)
    const res = await fetch(`/api/admin/buyers/${initial.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const json = await res.json()
    if (!res.ok) {
      setMsg({ type: 'err', text: json.error || 'Save failed' })
    } else {
      setMsg({ type: 'ok', text: 'Changes saved.' })
      setBuyer(json.data)
      setFormState(f => ({ ...f, abn_verified: json.data.abn_verified, role: json.data.role }))
    }
    setSaving(false)
  }

  const isB2B = form.role === 'buyer_b2b'

  return (
    <div className="page-pad" style={{ maxWidth: '52rem' }}>

      {/* Back + header */}
      <div style={{ marginBottom: '2rem' }}>
        <Link href="/dashboard/admin/buyers" style={{ color: 'var(--moss)', fontSize: '0.85rem', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.375rem', marginBottom: '1rem' }}>
          ← Back to Buyers
        </Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          <div style={{ width: '3rem', height: '3rem', borderRadius: '0.75rem', background: isB2B ? 'var(--navy)' : 'var(--offwhite)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: isB2B ? 'white' : 'var(--navy)', fontFamily: 'var(--font-display)', fontSize: '1.25rem', flexShrink: 0 }}>
            {(buyer.full_name || buyer.email)?.[0]?.toUpperCase()}
          </div>
          <div>
            <h1 className="type-heading" style={{ color: 'var(--navy)', marginBottom: '0.25rem' }}>{buyer.full_name || buyer.email}</h1>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <span className={`badge ${isB2B ? 'badge-sage' : 'badge-cream'}`}>{isB2B ? 'B2B Buyer' : 'B2C Retail'}</span>
              {buyer.abn_verified && <span className="badge badge-sage">✓ ABN Verified</span>}
              <span className="type-label-sm" style={{ color: 'var(--moss)' }}>{buyer.email}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Account (read-only) */}
      <div className="card reveal" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
        <h2 className="type-label-lg" style={{ color: 'var(--navy)', marginBottom: '1rem' }}>Account</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(12rem, 1fr))', gap: '1rem' }}>
          {[
            { label: 'Email',   value: buyer.email },
            { label: 'User ID', value: buyer.id },
            { label: 'Joined',  value: formatAEST(buyer.created_at, 'dd MMM yyyy') },
          ].map(({ label, value }) => (
            <div key={label}>
              <p className="type-label-sm" style={{ color: 'var(--moss)', marginBottom: '0.25rem' }}>{label}</p>
              <p style={{ fontSize: '0.875rem', color: 'var(--navy)', wordBreak: 'break-all' }}>{value || '—'}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Profile details */}
      <div className="card reveal" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
        <h2 className="type-label-lg" style={{ color: 'var(--navy)', marginBottom: '1.25rem' }}>Profile Details</h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>

          <div>
            <label className="type-label-sm" style={{ color: 'var(--moss)', display: 'block', marginBottom: '0.375rem' }}>Full Name</label>
            <input className="input" value={form.full_name} onChange={e => set('full_name', e.target.value)} style={{ width: '100%' }} />
          </div>

          <div>
            <label className="type-label-sm" style={{ color: 'var(--moss)', display: 'block', marginBottom: '0.375rem' }}>Phone</label>
            <input className="input" value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="+61 4xx xxx xxx" style={{ width: '100%' }} />
          </div>

          <div style={{ gridColumn: '1 / -1' }}>
            <label className="type-label-sm" style={{ color: 'var(--moss)', display: 'block', marginBottom: '0.375rem' }}>Business Name</label>
            <input className="input" value={form.business_name} onChange={e => set('business_name', e.target.value)} placeholder="Business or shop name" style={{ width: '100%' }} />
          </div>

        </div>
      </div>

      {/* Buyer type & ABN */}
      <div className="card reveal" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
        <h2 className="type-label-lg" style={{ color: 'var(--navy)', marginBottom: '1.25rem' }}>Buyer Type & ABN</h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>

          {/* Role toggle */}
          <div style={{ gridColumn: '1 / -1' }}>
            <label className="type-label-sm" style={{ color: 'var(--moss)', display: 'block', marginBottom: '0.5rem' }}>Account Type</label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                type="button"
                onClick={() => { set('role', 'buyer_b2b'); if (form.role !== 'buyer_b2b') set('abn_verified', false) }}
                className={`btn btn-sm ${isB2B ? 'btn-forest' : 'btn-ghost'}`}
                style={{ flex: 1 }}
              >
                B2B Buyer
              </button>
              <button
                type="button"
                onClick={() => { set('role', 'buyer_b2c'); set('abn_verified', false) }}
                className={`btn btn-sm ${!isB2B ? 'btn-forest' : 'btn-ghost'}`}
                style={{ flex: 1 }}
              >
                B2C Retail
              </button>
            </div>
            <p className="type-label-sm" style={{ color: 'var(--moss)', marginTop: '0.5rem' }}>
              {isB2B ? 'Buyer pricing and ABN verification required.' : 'Retail pricing, no ABN required.'}
            </p>
          </div>

          <div>
            <label className="type-label-sm" style={{ color: 'var(--moss)', display: 'block', marginBottom: '0.375rem' }}>ABN</label>
            <input className="input" value={form.abn} onChange={e => set('abn', sanitizeABNInput(e.target.value))} placeholder="12 345 678 901" maxLength={11} style={{ width: '100%' }} />
          </div>

          <div>
            <label className="type-label-sm" style={{ color: 'var(--moss)', display: 'block', marginBottom: '0.375rem' }}>ABN Verified</label>
            <button
              type="button"
              onClick={() => set('abn_verified', !form.abn_verified)}
              disabled={!isB2B}
              className={`btn btn-sm ${form.abn_verified ? 'btn-forest' : 'btn-ghost'}`}
              style={{ width: '100%' }}
            >
              {form.abn_verified ? '✓ Verified' : '✕ Not Verified'}
            </button>
            {!isB2B && <p className="type-label-sm" style={{ color: 'var(--moss)', marginTop: '0.25rem' }}>N/A for B2C buyers</p>}
          </div>

          {isB2B && (
            <div style={{ gridColumn: '1 / -1' }}>
              <label className="type-label-sm" style={{ color: 'var(--moss)', display: 'block', marginBottom: '0.375rem' }}>Flower-related business (self-declared at signup)</label>
              {initial.flower_related_business === true && <span className="badge badge-sage">✓ Declared flower-related</span>}
              {initial.flower_related_business === false && <span className="badge" style={{ background: 'var(--olive)', color: 'var(--moss)' }}>Not declared flower-related</span>}
              {initial.flower_related_business == null && <span className="type-label-sm" style={{ color: 'var(--moss)' }}>Not stated (signed up before this was tracked)</span>}
            </div>
          )}

        </div>
      </div>

      {/* Save bar */}
      {msg && (
        <div style={{ marginBottom: '1rem', padding: '0.75rem 1.25rem', borderRadius: '0.75rem', background: msg.type === 'ok' ? 'var(--sage-soft)' : 'var(--bloom-soft)', color: msg.type === 'ok' ? 'var(--sage-new)' : 'var(--bloom)', fontSize: '0.875rem', fontWeight: 500 }}>
          {msg.text}
        </div>
      )}
      <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', paddingBottom: '3rem' }}>
        <Link href="/dashboard/admin/buyers" className="btn btn-ghost">Cancel</Link>
        <button onClick={save} disabled={saving} className="btn btn-forest" style={{ minWidth: '8rem' }}>
          {saving ? 'Saving…' : 'Save Changes'}
        </button>
      </div>

    </div>
  )
}
