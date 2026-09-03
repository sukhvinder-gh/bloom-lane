// src/app/dashboard/farmer/storefront/page.tsx
'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import SingleImageUpload from '@/components/SingleImageUpload'

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
    logo_url: null as string | null,
    banner_url: null as string | null,
    brand_color: '#01472e',
    suburb: '',
    state: 'VIC',
    postcode: '',
    address: '',
    abn: '',
    region: '',
    growing_practices: '',
    seasonal_specialties: '',
    sustainability: '',
    offers_farm_pickup: false,
    market_open_day_override: '',
    market_open_time_override: '',
    market_close_time_override: '',
  })

  type FulfillmentOption = {
    id?: string
    type: 'pickup' | 'delivery'
    day_of_week: string
    start_time: string
    end_time: string
    cost_cents: number
    max_distance_km: string
    notes: string
  }
  const [fulfillmentOptions, setFulfillmentOptions] = useState<FulfillmentOption[]>([])
  const [savingOptions, setSavingOptions] = useState(false)

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
        business_name:        data.business_name || '',
        bio:                  data.bio || '',
        logo_url:             data.logo_url || null,
        banner_url:           data.banner_url || null,
        brand_color:          data.brand_color || '#01472e',
        suburb:               data.suburb || '',
        state:                data.state || 'VIC',
        postcode:             data.postcode || '',
        address:              data.address || '',
        abn:                  data.abn || '',
        region:               data.region || '',
        growing_practices:    data.growing_practices || '',
        seasonal_specialties: (data.seasonal_specialties || []).join(', '),
        sustainability:       (data.sustainability || []).join(', '),
        offers_farm_pickup:   data.offers_farm_pickup || false,
        market_open_day_override:   data.market_open_day_override || '',
        market_open_time_override:  data.market_open_time_override || '',
        market_close_time_override: data.market_close_time_override || '',
      })

      const { data: options } = await supabase
        .from('farmer_fulfillment_options')
        .select('*')
        .eq('farmer_id', data.id)
        .order('created_at', { ascending: true })

      setFulfillmentOptions((options || []).map((o: any) => ({
        id: o.id,
        type: o.type,
        day_of_week: o.day_of_week || '',
        start_time: o.start_time || '',
        end_time: o.end_time || '',
        cost_cents: o.cost_cents || 0,
        max_distance_km: o.max_distance_km != null ? String(o.max_distance_km) : '',
        notes: o.notes || '',
      })))
    }
    setLoading(false)
  }

  function addFulfillmentOption(type: 'pickup' | 'delivery') {
    setFulfillmentOptions(opts => [...opts, {
      type, day_of_week: 'wednesday', start_time: '09:00', end_time: '17:00',
      cost_cents: 0, max_distance_km: '', notes: '',
    }])
  }

  function updateFulfillmentOption(index: number, patch: Partial<FulfillmentOption>) {
    setFulfillmentOptions(opts => opts.map((o, i) => i === index ? { ...o, ...patch } : o))
  }

  function removeFulfillmentOption(index: number) {
    setFulfillmentOptions(opts => opts.filter((_, i) => i !== index))
  }

  async function saveFulfillmentOptions() {
    if (!farmer) return
    setSavingOptions(true)
    setError(null)

    // Simplest consistent approach: replace the full set rather than diffing
    // inserts/updates/deletes individually.
    await supabase.from('farmer_fulfillment_options').delete().eq('farmer_id', farmer.id)
    if (fulfillmentOptions.length > 0) {
      const { error: insertErr } = await supabase.from('farmer_fulfillment_options').insert(
        fulfillmentOptions.map(o => ({
          farmer_id: farmer.id,
          type: o.type,
          day_of_week: o.day_of_week || null,
          start_time: o.start_time || null,
          end_time: o.end_time || null,
          cost_cents: o.cost_cents || 0,
          max_distance_km: o.type === 'delivery' && o.max_distance_km ? parseInt(o.max_distance_km) : null,
          notes: o.notes || null,
        }))
      )
      if (insertErr) setError(insertErr.message)
    }
    setSavingOptions(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
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
        business_name:        form.business_name,
        bio:                  form.bio,
        logo_url:             form.logo_url,
        banner_url:           form.banner_url,
        brand_color:          form.brand_color,
        suburb:               form.suburb,
        state:                form.state,
        postcode:             form.postcode,
        address:              form.address,
        region:               form.region || null,
        growing_practices:    form.growing_practices || null,
        seasonal_specialties: form.seasonal_specialties ? form.seasonal_specialties.split(',').map(s => s.trim()).filter(Boolean) : [],
        sustainability:       form.sustainability ? form.sustainability.split(',').map(s => s.trim()).filter(Boolean) : [],
        offers_farm_pickup:   form.offers_farm_pickup,
        market_open_day_override:   form.market_open_day_override || null,
        market_open_time_override:  form.market_open_time_override || null,
        market_close_time_override: form.market_close_time_override || null,
        updated_at:           new Date().toISOString(),
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
          : 'Set up your farm profile to start selling on The Green Guild'}
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
        <div style={{ height: '4rem', background: form.brand_color, position: 'relative', overflow: 'hidden' }}>
          {form.banner_url && <img src={form.banner_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
        </div>
        <div style={{ padding: '1.25rem', background: 'white', display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
          <div style={{ width: '2.75rem', height: '2.75rem', borderRadius: '0.75rem', background: form.brand_color, flexShrink: 0, overflow: 'hidden', marginTop: '-2rem', border: '3px solid white', boxShadow: '0 2px 8px rgba(0,0,0,0.12)' }}>
            {form.logo_url && <img src={form.logo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
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

        {/* Logo + farm/owner photo — only once the account is approved, same
            requirement the upload endpoint itself enforces for every image
            upload on the platform. */}
        {farmer && farmer.status === 'approved' ? (
          <>
            <SingleImageUpload
              label="Logo"
              shape="square"
              url={form.logo_url}
              onChange={url => setForm(f => ({ ...f, logo_url: url }))}
            />
            <SingleImageUpload
              label="Farm / Owner Photo"
              shape="wide"
              url={form.banner_url}
              onChange={url => setForm(f => ({ ...f, banner_url: url }))}
            />
          </>
        ) : farmer && (
          <p style={{ fontSize: '0.8rem', color: 'var(--forest)', opacity: 0.6, background: 'var(--olive)', padding: '0.75rem 1rem', borderRadius: '0.625rem' }}>
            🖼 Logo and farm/owner photo uploads become available once your account is approved.
          </p>
        )}

        {/* Region */}
        <div>
          <label style={{ display: 'block', fontWeight: 700, color: 'var(--forest)', fontSize: '0.875rem', marginBottom: '0.35rem' }}>Region</label>
          <input style={inputStyle} value={form.region} onChange={e => setForm(f => ({ ...f, region: e.target.value }))} placeholder="e.g. Yarra Valley, Mornington Peninsula" />
          <p style={{ fontSize: '0.75rem', color: 'var(--forest)', opacity: 0.5, marginTop: '0.3rem' }}>Shown publicly on your grower profile to help buyers find you</p>
        </div>

        {/* Growing practices */}
        <div>
          <label style={{ display: 'block', fontWeight: 700, color: 'var(--forest)', fontSize: '0.875rem', marginBottom: '0.35rem' }}>Growing Practices</label>
          <textarea
            value={form.growing_practices}
            onChange={e => setForm(f => ({ ...f, growing_practices: e.target.value }))}
            rows={3}
            placeholder="Describe how you grow — soil health, pest management, water use, certifications…"
            style={{ ...inputStyle, resize: 'vertical' }}
          />
        </div>

        {/* Seasonal specialties */}
        <div>
          <label style={{ display: 'block', fontWeight: 700, color: 'var(--forest)', fontSize: '0.875rem', marginBottom: '0.35rem' }}>Seasonal Specialties</label>
          <input style={inputStyle} value={form.seasonal_specialties} onChange={e => setForm(f => ({ ...f, seasonal_specialties: e.target.value }))} placeholder="e.g. Spring tulips, Summer dahlias, Autumn natives" />
          <p style={{ fontSize: '0.75rem', color: 'var(--forest)', opacity: 0.5, marginTop: '0.3rem' }}>Comma-separated list of your seasonal or specialty offerings</p>
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

        {/* Farm pickup */}
        {farmer && (
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.875rem', padding: '1rem', background: 'var(--olive)', borderRadius: '0.75rem', cursor: 'pointer' }}>
            <input type="checkbox" checked={form.offers_farm_pickup} onChange={e => setForm(f => ({ ...f, offers_farm_pickup: e.target.checked }))} style={{ width: '1.1rem', height: '1.1rem', accentColor: 'var(--forest)', flexShrink: 0 }} />
            <span style={{ fontSize: '0.85rem', color: 'var(--forest)' }}>
              Offer <strong>farm pickup</strong> at the address above — buyers can choose to collect your items directly from your farm instead of via the hub or delivery.
            </span>
          </label>
        )}

        {/* ABN / GST — read-only here, edited on the Membership page */}
        {farmer && (
          <div style={{ padding: '1rem', background: 'var(--olive)', borderRadius: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            <p style={{ fontWeight: 700, color: 'var(--forest)', fontSize: '0.8rem' }}>ABN &amp; GST status</p>
            <p style={{ fontSize: '0.85rem', color: 'var(--forest)' }}>
              ABN: {farmer.abn || 'Not set'} {farmer.abn_verified ? '✓ Verified' : '· Not verified'}
            </p>
            <p style={{ fontSize: '0.85rem', color: 'var(--forest)' }}>
              {farmer.gst_registered ? 'GST registered' : 'Not registered for GST'}
            </p>
            <p style={{ fontSize: '0.72rem', color: 'var(--forest)', opacity: 0.6 }}>
              Edit these on the Membership page.
            </p>
          </div>
        )}

        {/* Market-open override */}
        {farmer && (
          <div style={{ padding: '1rem', background: 'var(--olive)', borderRadius: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            <p style={{ fontWeight: 700, color: 'var(--forest)', fontSize: '0.8rem' }}>Ordering window override (optional)</p>
            <p style={{ fontSize: '0.75rem', color: 'var(--forest)', opacity: 0.6 }}>
              By default your hub's ordering window applies. Set all three fields to override it just for your farm — leave blank to use the hub's schedule.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.6rem' }}>
              <select
                value={form.market_open_day_override}
                onChange={e => setForm(f => ({ ...f, market_open_day_override: e.target.value }))}
                style={inputStyle}
              >
                <option value="">No override</option>
                {['monday','tuesday','wednesday','thursday','friday','saturday','sunday'].map(d => (
                  <option key={d} value={d}>{d[0].toUpperCase() + d.slice(1)}</option>
                ))}
              </select>
              <input type="time" style={inputStyle} value={form.market_open_time_override} onChange={e => setForm(f => ({ ...f, market_open_time_override: e.target.value }))} />
              <input type="time" style={inputStyle} value={form.market_close_time_override} onChange={e => setForm(f => ({ ...f, market_close_time_override: e.target.value }))} />
            </div>
          </div>
        )}

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

      {/* Pickup / delivery options */}
      {farmer && (
        <div style={{ background: 'white', borderRadius: 'var(--r-card)', padding: '1.75rem', border: '1px solid var(--olive)', marginTop: '1.5rem' }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.3rem', color: 'var(--forest)', marginBottom: '0.25rem' }}>
            Pickup &amp; Delivery Options
          </h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--forest)', opacity: 0.6, marginBottom: '1.25rem' }}>
            Days, times, costs, and rules buyers see on your products and public profile.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {fulfillmentOptions.map((opt, i) => (
              <div key={i} style={{ padding: '1rem', background: 'var(--olive)', borderRadius: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 700, color: 'var(--forest)', fontSize: '0.85rem' }}>
                    {opt.type === 'pickup' ? '🚜 Farm pickup' : '🚚 Delivery'}
                  </span>
                  <button onClick={() => removeFulfillmentOption(i)} style={{ background: 'none', border: 'none', color: '#dc2626', fontSize: '0.78rem', cursor: 'pointer', textDecoration: 'underline' }}>
                    Remove
                  </button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.6rem' }}>
                  <select value={opt.day_of_week} onChange={e => updateFulfillmentOption(i, { day_of_week: e.target.value })} style={inputStyle}>
                    {['monday','tuesday','wednesday','thursday','friday','saturday','sunday'].map(d => (
                      <option key={d} value={d}>{d[0].toUpperCase() + d.slice(1)}</option>
                    ))}
                  </select>
                  <input type="time" style={inputStyle} value={opt.start_time} onChange={e => updateFulfillmentOption(i, { start_time: e.target.value })} />
                  <input type="time" style={inputStyle} value={opt.end_time} onChange={e => updateFulfillmentOption(i, { end_time: e.target.value })} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: opt.type === 'delivery' ? '1fr 1fr' : '1fr', gap: '0.6rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--forest)', opacity: 0.7, marginBottom: '0.25rem' }}>Cost ($)</label>
                    <input
                      type="number" min={0} step={0.5} style={inputStyle}
                      value={opt.cost_cents / 100}
                      onChange={e => updateFulfillmentOption(i, { cost_cents: Math.round(parseFloat(e.target.value || '0') * 100) })}
                    />
                  </div>
                  {opt.type === 'delivery' && (
                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--forest)', opacity: 0.7, marginBottom: '0.25rem' }}>Max distance (km)</label>
                      <input
                        type="number" min={0} style={inputStyle}
                        value={opt.max_distance_km}
                        onChange={e => updateFulfillmentOption(i, { max_distance_km: e.target.value })}
                      />
                    </div>
                  )}
                </div>
                <input
                  style={inputStyle}
                  placeholder="Related rules (optional) — e.g. 48 hours notice required"
                  value={opt.notes}
                  onChange={e => updateFulfillmentOption(i, { notes: e.target.value })}
                />
              </div>
            ))}

            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button onClick={() => addFulfillmentOption('pickup')} className="btn btn-ghost btn-sm">+ Add pickup option</button>
              <button onClick={() => addFulfillmentOption('delivery')} className="btn btn-ghost btn-sm">+ Add delivery option</button>
            </div>

            <button
              onClick={saveFulfillmentOptions}
              disabled={savingOptions}
              style={{
                marginTop: '0.5rem', padding: '0.75rem', borderRadius: '0.75rem',
                background: 'var(--forest)', color: 'var(--cream)', border: 'none',
                fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: '0.9rem',
                cursor: savingOptions ? 'wait' : 'pointer',
              }}
            >
              {savingOptions ? 'Saving...' : 'Save Pickup & Delivery Options'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
