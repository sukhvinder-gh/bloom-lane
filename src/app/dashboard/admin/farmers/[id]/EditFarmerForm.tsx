'use client'
import { useState } from 'react'
import Link from 'next/link'
import { validateABNFormat, sanitizeABNInput } from '@/lib/utils/abn'

const STATUS_BADGE: Record<string, string> = {
  pending_approval: 'badge badge-amber',
  approved:         'badge badge-sage',
  suspended:        'badge badge-red',
}
const STATUS_LABEL: Record<string, string> = {
  pending_approval: '⏳ Pending Approval',
  approved:         '✓ Approved',
  suspended:        '✕ Suspended',
}

export default function EditFarmerForm({ farmer: initial, requesterRole }: { farmer: any; requesterRole?: string }) {
  const [farmer, setFarmer] = useState(initial)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  const [form, setFormState] = useState({
    business_name:       initial.business_name || '',
    bio:                 initial.bio || '',
    suburb:              initial.suburb || '',
    state:               initial.state || '',
    region:              initial.region || '',
    growing_practices:   initial.growing_practices || '',
    seasonal_specialties:(initial.seasonal_specialties || []).join(', '),
    sustainability:      (initial.sustainability || []).join(', '),
    brand_color:         initial.brand_color || '#1e2535',
    banner_url:          initial.banner_url || '',
    logo_url:            initial.logo_url || '',
    commission_rate:     String(Math.round((initial.commission_rate ?? 0.1) * 100)),
    abn:                 initial.abn || '',
    abn_verified:        initial.abn_verified || false,
  })

  function set(key: string, value: unknown) {
    setFormState(f => ({ ...f, [key]: value }))
  }

  async function save() {
    setMsg(null)
    // Only gate on ABN format when it's actually being changed — a farmer
    // with a pre-existing bad ABN (e.g. entered before this check existed)
    // shouldn't be unable to save an unrelated field like their bio.
    // Stripe rejects a malformed ABN outright when this farmer later
    // connects payouts, so catching it here beats a confusing stripe_error
    // redirect on the payouts page.
    if (form.abn.trim() && form.abn !== (initial.abn || '') && !validateABNFormat(form.abn)) {
      setMsg({ type: 'err', text: 'That ABN doesn’t look valid — it should be exactly 11 digits and pass the ABN checksum.' })
      return
    }
    setSaving(true)
    // Commission is no longer set per grower — it comes from Admin > Config.
    const { commission_rate: _unused, ...formFields } = form
    const payload = {
      ...formFields,
      seasonal_specialties: form.seasonal_specialties.split(',').map((s: string) => s.trim()).filter(Boolean),
      sustainability:        form.sustainability.split(',').map((s: string) => s.trim()).filter(Boolean),
    }
    const res = await fetch(`/api/admin/farmers/${initial.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const json = await res.json()
    if (!res.ok) {
      setMsg({ type: 'err', text: json.error || 'Save failed' })
    } else {
      setMsg({ type: 'ok', text: 'Changes saved.' })
      setFarmer(json.data)
    }
    setSaving(false)
  }

  async function updateStatus(status: 'approved' | 'suspended') {
    setSaving(true)
    setMsg(null)
    const res = await fetch(`/api/admin/farmers/${initial.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    const json = await res.json()
    if (res.ok) {
      setFarmer((f: any) => ({ ...f, status: json.data.status }))
      setMsg({ type: 'ok', text: `Status updated to ${status}.` })
    } else {
      setMsg({ type: 'err', text: json.error || 'Update failed' })
    }
    setSaving(false)
  }

  return (
    <div className="page-pad" style={{ maxWidth: '56rem' }}>

      {/* Back + header */}
      <div style={{ marginBottom: '2rem' }}>
        <Link href="/dashboard/admin/farmers" style={{ color: 'var(--moss)', fontSize: '0.85rem', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.375rem', marginBottom: '1rem' }}>
          ← Back to Growers
        </Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          <div style={{ width: '3rem', height: '3rem', borderRadius: '0.75rem', background: farmer.brand_color || 'var(--navy)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontFamily: 'var(--font-display)', fontSize: '1.25rem', flexShrink: 0 }}>
            {farmer.business_name?.[0]}
          </div>
          <div>
            <h1 className="type-heading" style={{ color: 'var(--navy)', marginBottom: '0.25rem' }}>{farmer.business_name}</h1>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <span className={STATUS_BADGE[farmer.status] || 'badge'}>{STATUS_LABEL[farmer.status] || farmer.status}</span>
              <span className="type-label-sm" style={{ color: 'var(--moss)' }}>{farmer.profiles?.email}</span>
            </div>
          </div>
          <div style={{ flex: 1 }} />
          {farmer.status === 'pending_approval' && (
            <button onClick={() => updateStatus('approved')} disabled={saving} className="btn btn-forest btn-sm">✓ Approve</button>
          )}
          {farmer.status === 'approved' && (
            <button onClick={() => updateStatus('suspended')} disabled={saving} className="btn btn-sm" style={{ background: 'var(--bloom-soft)', color: 'var(--bloom)', border: 'none' }}>Suspend</button>
          )}
          {farmer.status === 'suspended' && (
            <button onClick={() => updateStatus('approved')} disabled={saving} className="btn btn-outline btn-sm">Reinstate</button>
          )}
        </div>
      </div>

      {/* Account info (read-only) */}
      <div className="card reveal" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
        <h2 className="type-label-lg" style={{ color: 'var(--navy)', marginBottom: '1rem' }}>Account</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(12rem, 1fr))', gap: '1rem' }}>
          {[
            { label: 'Full Name',  value: farmer.profiles?.full_name },
            { label: 'Email',      value: farmer.profiles?.email },
            { label: 'Phone',      value: farmer.profiles?.phone },
          ].map(({ label, value }) => (
            <div key={label}>
              <p className="type-label-sm" style={{ color: 'var(--moss)', marginBottom: '0.25rem' }}>{label}</p>
              <p style={{ fontSize: '0.875rem', color: 'var(--navy)' }}>{value || '—'}</p>
            </div>
          ))}
          <div>
            <p className="type-label-sm" style={{ color: 'var(--moss)', marginBottom: '0.25rem' }}>Stripe</p>
            <span className={`badge ${farmer.stripe_onboarding_complete ? 'badge-sage' : 'badge-amber'}`}>
              {farmer.stripe_onboarding_complete ? '✓ Connected' : '⏳ Pending'}
            </span>
          </div>
        </div>
      </div>

      {/* Business Details */}
      <div className="card reveal" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
        <h2 className="type-label-lg" style={{ color: 'var(--navy)', marginBottom: '1.25rem' }}>Business Details</h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>

          <div style={{ gridColumn: '1 / -1' }}>
            <label className="type-label-sm" style={{ color: 'var(--moss)', display: 'block', marginBottom: '0.375rem' }}>Business Name</label>
            <input className="input" value={form.business_name} onChange={e => set('business_name', e.target.value)} style={{ width: '100%' }} />
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
              className={`btn btn-sm ${form.abn_verified ? 'btn-forest' : 'btn-ghost'}`}
              style={{ width: '100%' }}
            >
              {form.abn_verified ? '✓ Verified' : '✕ Not Verified'}
            </button>
          </div>

          <div>
            <label className="type-label-sm" style={{ color: 'var(--moss)', display: 'block', marginBottom: '0.375rem' }}>Commission Rate</label>
            <p style={{ fontSize: '0.8rem', color: 'var(--moss)', lineHeight: 1.6 }}>
              Set platform-wide in Admin &gt; Config, not per grower: the Default Commission Rate for Hub Members, and the Free Grower Listing Commission for growers on that plan.
            </p>
          </div>

          <div>
            <label className="type-label-sm" style={{ color: 'var(--moss)', display: 'block', marginBottom: '0.375rem' }}>Brand Colour</label>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <input type="color" value={form.brand_color} onChange={e => set('brand_color', e.target.value)} style={{ width: '3rem', height: '2.5rem', border: '1px solid var(--border-light)', borderRadius: '0.5rem', cursor: 'pointer', padding: '0.125rem', flexShrink: 0 }} />
              <input className="input" value={form.brand_color} onChange={e => set('brand_color', e.target.value)} style={{ flex: 1 }} />
            </div>
          </div>

        </div>
      </div>

      {/* Profile / Storefront */}
      <div className="card reveal" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
        <h2 className="type-label-lg" style={{ color: 'var(--navy)', marginBottom: '1.25rem' }}>Profile / Storefront</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

          <div>
            <label className="type-label-sm" style={{ color: 'var(--moss)', display: 'block', marginBottom: '0.375rem' }}>Bio</label>
            <textarea className="input" value={form.bio} onChange={e => set('bio', e.target.value)} rows={3} style={{ width: '100%', resize: 'vertical' }} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(9rem, 1fr))', gap: '1rem' }}>
            <div>
              <label className="type-label-sm" style={{ color: 'var(--moss)', display: 'block', marginBottom: '0.375rem' }}>Suburb</label>
              <input className="input" value={form.suburb} onChange={e => set('suburb', e.target.value)} style={{ width: '100%' }} />
            </div>
            <div>
              <label className="type-label-sm" style={{ color: 'var(--moss)', display: 'block', marginBottom: '0.375rem' }}>State</label>
              <input className="input" value={form.state} onChange={e => set('state', e.target.value)} placeholder="VIC" style={{ width: '100%' }} />
            </div>
            <div>
              <label className="type-label-sm" style={{ color: 'var(--moss)', display: 'block', marginBottom: '0.375rem' }}>Region</label>
              <input className="input" value={form.region} onChange={e => set('region', e.target.value)} placeholder="Yarra Valley" style={{ width: '100%' }} />
            </div>
          </div>

          <div>
            <label className="type-label-sm" style={{ color: 'var(--moss)', display: 'block', marginBottom: '0.375rem' }}>Growing Practices</label>
            <textarea className="input" value={form.growing_practices} onChange={e => set('growing_practices', e.target.value)} rows={3} style={{ width: '100%', resize: 'vertical' }} />
          </div>

          <div>
            <label className="type-label-sm" style={{ color: 'var(--moss)', display: 'block', marginBottom: '0.375rem' }}>
              Seasonal Specialties <span style={{ fontWeight: 400, opacity: 0.6 }}>(comma-separated)</span>
            </label>
            <input className="input" value={form.seasonal_specialties} onChange={e => set('seasonal_specialties', e.target.value)} placeholder="Tulips in Spring, Dahlias in Autumn" style={{ width: '100%' }} />
          </div>

          <div>
            <label className="type-label-sm" style={{ color: 'var(--moss)', display: 'block', marginBottom: '0.375rem' }}>Banner URL</label>
            <input className="input" value={form.banner_url} onChange={e => set('banner_url', e.target.value)} placeholder="https://..." style={{ width: '100%' }} />
          </div>

          <div>
            <label className="type-label-sm" style={{ color: 'var(--moss)', display: 'block', marginBottom: '0.375rem' }}>Logo URL</label>
            <input className="input" value={form.logo_url} onChange={e => set('logo_url', e.target.value)} placeholder="https://..." style={{ width: '100%' }} />
          </div>

        </div>
      </div>

      {/* Save bar */}
      {msg && (
        <div style={{ marginBottom: '1rem', padding: '0.75rem 1.25rem', borderRadius: '0.75rem', background: msg.type === 'ok' ? 'var(--sage)' : 'var(--bloom-soft)', color: msg.type === 'ok' ? 'var(--forest)' : 'var(--bloom)', fontSize: '0.875rem', fontWeight: 500 }}>
          {msg.text}
        </div>
      )}
      <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', paddingBottom: '3rem' }}>
        <Link href="/dashboard/admin/farmers" className="btn btn-ghost">Cancel</Link>
        <button onClick={save} disabled={saving} className="btn btn-forest" style={{ minWidth: '8rem' }}>
          {saving ? 'Saving…' : 'Save Changes'}
        </button>
      </div>

    </div>
  )
}
