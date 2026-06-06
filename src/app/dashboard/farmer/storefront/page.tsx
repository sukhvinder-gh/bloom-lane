// src/app/dashboard/farmer/storefront/page.tsx
'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function FarmerStorefrontPage() {
  const supabase = createClient()
  const router = useRouter()

  const [farmer, setFarmer]   = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState(false)
  const [saved, setSaved]     = useState(false)
  const [error, setError]     = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  const [form, setForm] = useState({
    business_name: '',
    bio: '',
    brand_color: '#01472e',
    suburb: '',
    state: 'VIC',
    postcode: '',
    address: '',
    abn: '',
  })

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data } = await supabase
      .from('farmers')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (data) {
      setFarmer(data)
      setForm({
        business_name: data.business_name || '',
        bio:           data.bio || '',
        brand_color:   data.brand_color || '#01472e',
        suburb:        data.suburb || '',
        state:         data.state || 'VIC',
        postcode:      data.postcode || '',
        address:       data.address || '',
        abn:           data.abn || '',
      })
    }
    setLoading(false)
  }

  async function handleCreate() {
    setCreating(true)
    setError(null)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    // Validate required fields
    if (!form.business_name || !form.abn || !form.address || !form.suburb || !form.postcode) {
      setError('Please fill in all required fields: Business Name, ABN, Address, Suburb, Postcode')
      setCreating(false)
      return
    }

    const { data, error } = await supabase
      .from('farmers')
      .insert({
        user_id:       user.id,
        business_name: form.business_name,
        bio:           form.bio,
        brand_color:   form.brand_color,
        address:       form.address,
        suburb:        form.suburb,
        state:         form.state,
        postcode:      form.postcode,
        abn:           form.abn,
        abn_verified:  false,
        abn_verification_status: 'pending',
        status:        'pending_approval',
        commission_rate: 0.10,
      })
      .select()
      .single()

    if (error) {
      setError(error.message)
      setCreating(false)
    } else {
      // Hard navigation — forces Server Component to re-fetch farmer record
      // setFarmer alone won't update the /dashboard/farmer Server Component cache
      router.push('/dashboard/farmer')
      router.refresh()
    }
  }

  async function handleSave() {
    if (!farmer) return
    setSaving(true)
    setError(null)

    const { error } = await supabase
      .from('farmers')
      .update({
        business_name: form.business_name,
        bio:           form.bio,
        brand_color:   form.brand_color,
        suburb:        form.suburb,
        state:         form.state,
        postcode:      form.postcode,
        address:       form.address,
        updated_at:    new Date().toISOString(),
      })
      .eq('id', farmer.id)

    if (error) {
      setError(error.message)
    } else {
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    }
    setSaving(false)
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '0.625rem 0.75rem',
    borderRadius: '0.5rem',
    border: '1.5px solid var(--sage)',
    fontFamily: 'var(--font-body)',
    fontSize: '0.9rem',
    color: 'var(--forest)',
    background: 'var(--cream)',
    boxSizing: 'border-box' as const,
  }

  if (loading) return (
    <div className="page-pad" style={{ padding: '2.5rem', color: 'var(--forest)', opacity: 0.5, fontFamily: 'var(--font-body)' }}>
      Loading...
    </div>
  )

  return (
    <div className="page-pad" style={{ padding: '2.5rem', fontFamily: 'var(--font-body)', maxWidth: '42rem' }}>
      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', color: 'var(--forest)', marginBottom: '0.25rem' }}>
        {farmer ? 'Storefront' : 'Create Farmer Profile'}
      </h1>
      <p style={{ color: 'var(--forest)', opacity: 0.5, marginBottom: '2rem', fontSize: '0.9rem' }}>
        {farmer
          ? `Status: ${farmer.status === 'approved' ? '✅ Approved' : farmer.status === 'pending_approval' ? '⏳ Pending admin approval' : '🚫 ' + farmer.status}`
          : 'Set up your farm profile to start selling on Bloom Lane'}
      </p>

      {/* Pending approval notice */}
      {farmer?.status === 'pending_approval' && (
        <div style={{ background: '#fef9c3', border: '1px solid #fbbf24', borderRadius: '0.75rem', padding: '1rem 1.25rem', marginBottom: '1.5rem', fontSize: '0.875rem', color: '#92400e' }}>
          ⏳ Your farmer account is pending admin approval. You can update your profile details below while you wait.
        </div>
      )}

      {error && (
        <div style={{ background: '#fee2e2', color: '#991b1b', padding: '0.75rem 1rem', borderRadius: '0.5rem', marginBottom: '1.5rem', fontSize: '0.875rem' }}>
          {error}
        </div>
      )}

      {/* Live preview card */}
      <div style={{ marginBottom: '2rem', borderRadius: 'var(--r-card)', overflow: 'hidden', border: '1px solid var(--olive)' }}>
        <div style={{ height: '4rem', background: form.brand_color }} />
        <div style={{ padding: '1.25rem', background: 'white' }}>
          <p style={{ fontFamily: 'var(--font-display)', fontSize: '1.2rem', color: form.brand_color }}>
            {form.business_name || 'Your Farm Name'}
          </p>
          <p style={{ fontSize: '0.8rem', color: 'var(--forest)', opacity: 0.5, marginTop: '0.2rem' }}>
            {[form.suburb, form.state, form.postcode].filter(Boolean).join(' ')}
          </p>
          <p style={{ fontSize: '0.875rem', color: 'var(--forest)', marginTop: '0.5rem', opacity: 0.7 }}>
            {form.bio || 'Your farm description will appear here...'}
          </p>
        </div>
      </div>

      <div style={{ background: 'white', borderRadius: 'var(--r-card)', padding: '1.75rem', border: '1px solid var(--olive)', display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>

        {/* Business Name */}
        <div>
          <label style={{ display: 'block', fontWeight: 700, color: 'var(--forest)', fontSize: '0.875rem', marginBottom: '0.35rem' }}>
            Farm / Business Name <span style={{ color: '#dc2626' }}>*</span>
          </label>
          <input style={inputStyle} value={form.business_name} onChange={e => setForm(f => ({ ...f, business_name: e.target.value }))} placeholder="e.g. Green Valley Farms" />
        </div>

        {/* ABN — only shown when creating */}
        {!farmer && (
          <div>
            <label style={{ display: 'block', fontWeight: 700, color: 'var(--forest)', fontSize: '0.875rem', marginBottom: '0.35rem' }}>
              ABN <span style={{ color: '#dc2626' }}>*</span>
            </label>
            <input style={inputStyle} value={form.abn} onChange={e => setForm(f => ({ ...f, abn: e.target.value }))} placeholder="e.g. 51 824 753 556" />
            <p style={{ fontSize: '0.75rem', color: 'var(--forest)', opacity: 0.5, marginTop: '0.3rem' }}>
              Your ABN will be verified with the Australian Business Register
            </p>
          </div>
        )}

        {/* Bio */}
        <div>
          <label style={{ display: 'block', fontWeight: 700, color: 'var(--forest)', fontSize: '0.875rem', marginBottom: '0.35rem' }}>Bio</label>
          <textarea
            value={form.bio}
            onChange={e => setForm(f => ({ ...f, bio: e.target.value }))}
            rows={3}
            placeholder="Tell buyers about your farm — what you grow, your story, your values"
            style={{ ...inputStyle, resize: 'vertical' }}
          />
        </div>

        {/* Brand colour */}
        <div>
          <label style={{ display: 'block', fontWeight: 700, color: 'var(--forest)', fontSize: '0.875rem', marginBottom: '0.35rem' }}>Brand Colour</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <input type="color" value={form.brand_color} onChange={e => setForm(f => ({ ...f, brand_color: e.target.value }))}
              style={{ width: '3rem', height: '2.5rem', border: '1.5px solid var(--sage)', borderRadius: '0.5rem', cursor: 'pointer', padding: '0.1rem' }} />
            <span style={{ fontSize: '0.85rem', color: 'var(--forest)', opacity: 0.6 }}>{form.brand_color}</span>
          </div>
        </div>

        {/* Address */}
        <div>
          <label style={{ display: 'block', fontWeight: 700, color: 'var(--forest)', fontSize: '0.875rem', marginBottom: '0.35rem' }}>
            Street Address {!farmer && <span style={{ color: '#dc2626' }}>*</span>}
          </label>
          <input style={inputStyle} value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} placeholder="123 Farm Road" />
        </div>

        {/* Suburb / State / Postcode */}
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '0.75rem' }}>
          <div>
            <label style={{ display: 'block', fontWeight: 700, color: 'var(--forest)', fontSize: '0.875rem', marginBottom: '0.35rem' }}>
              Suburb {!farmer && <span style={{ color: '#dc2626' }}>*</span>}
            </label>
            <input style={inputStyle} value={form.suburb} onChange={e => setForm(f => ({ ...f, suburb: e.target.value }))} placeholder="Melbourne" />
          </div>
          <div>
            <label style={{ display: 'block', fontWeight: 700, color: 'var(--forest)', fontSize: '0.875rem', marginBottom: '0.35rem' }}>State</label>
            <select value={form.state} onChange={e => setForm(f => ({ ...f, state: e.target.value }))} style={inputStyle}>
              {['VIC','NSW','QLD','SA','WA','TAS','NT','ACT'].map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontWeight: 700, color: 'var(--forest)', fontSize: '0.875rem', marginBottom: '0.35rem' }}>
              Postcode {!farmer && <span style={{ color: '#dc2626' }}>*</span>}
            </label>
            <input style={inputStyle} value={form.postcode} onChange={e => setForm(f => ({ ...f, postcode: e.target.value }))} placeholder="3000" maxLength={4} />
          </div>
        </div>

        {/* Submit */}
        <button
          onClick={farmer ? handleSave : handleCreate}
          disabled={saving || creating}
          style={{
            marginTop: '0.25rem',
            width: '100%',
            padding: '0.75rem',
            borderRadius: '0.75rem',
            background: saved ? '#dcfce7' : 'var(--forest)',
            color: saved ? '#166534' : 'var(--cream)',
            border: 'none',
            fontFamily: 'var(--font-body)',
            fontWeight: 700,
            fontSize: '0.95rem',
            cursor: (saving || creating) ? 'wait' : 'pointer',
            transition: 'all 0.2s',
          }}
        >
          {creating ? 'Creating profile...' : saving ? 'Saving...' : saved ? '✓ Saved' : farmer ? 'Save Changes' : 'Create Farmer Profile'}
        </button>
      </div>
    </div>
  )
}
