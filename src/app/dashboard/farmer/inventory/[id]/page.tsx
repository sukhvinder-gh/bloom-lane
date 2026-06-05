'use client'
import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { isListingWindowOpen } from '@/lib/utils/timezone'
import { calculateStockSplits, formatPrice } from '@/lib/utils/pricing'
import { createClient } from '@/lib/supabase/client'

const CATEGORIES = [
  { id: 'flowers_cut', label: '✿ Cut Flowers' },
  { id: 'flowers_dried', label: '🌾 Dried Flowers' },
  { id: 'foliage', label: '🍃 Foliage' },
  { id: 'vegetables', label: '🥦 Vegetables' },
  { id: 'herbs', label: '🌿 Herbs' },
  { id: 'fruit', label: '🍓 Fruit' },
  { id: 'eggs', label: '🥚 Eggs' },
  { id: 'honey', label: '🍯 Honey' },
  { id: 'other', label: '📦 Other' },
]
const UNITS = ['bunch', 'stem', 'kg', 'g', 'each', 'tray', 'box', 'punnet', 'dozen']

export default function EditProductPage() {
  const router = useRouter()
  const params = useParams()
  const productId = params.id as string
  const listingOpen = isListingWindowOpen()
  const supabase = createClient()

  const [loading, setLoading]   = useState(false)
  const [fetching, setFetching] = useState(true)
  const [error, setError]       = useState('')
  const [notFound, setNotFound] = useState(false)
  const [b2bPct, setB2bPct]     = useState(0.8) // loaded from config

  const [form, setForm] = useState({
    name: '',
    description: '',
    category: 'flowers_cut',
    unit: 'bunch',
    wholesale_price_dollars: '',
    stock_total: '',
    min_order_b2b: '1',
    is_gst_free: false,
    is_listed_this_week: false,
  })

  const up = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))

  // Load b2b split ratio from config
  useEffect(() => {
    supabase.from('config').select('value').eq('key', 'b2b_stock_pct').single()
      .then(({ data }) => { if (data?.value) setB2bPct(parseFloat(data.value)) })
  }, [])

  // Load existing product data
  useEffect(() => {
    async function load() {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('id', productId)
        .single()

      if (error || !data) {
        setNotFound(true)
        setFetching(false)
        return
      }

      setForm({
        name:                    data.name || '',
        description:             data.description || '',
        category:                data.category || 'flowers_cut',
        unit:                    data.unit || 'bunch',
        wholesale_price_dollars: ((data.wholesale_price || 0) / 100).toFixed(2),
        stock_total:             String(data.stock_total || ''),
        min_order_b2b:           String(data.min_order_b2b || '1'),
        is_gst_free:             data.is_gst_free || false,
        is_listed_this_week:     data.is_listed_this_week || false,
      })
      setFetching(false)
    }
    load()
  }, [productId])

  const stockNum      = parseInt(form.stock_total) || 0
  const splits        = calculateStockSplits(stockNum, b2bPct)
  const wholesaleCents = Math.round(parseFloat(form.wholesale_price_dollars || '0') * 100)
  const retailEx      = Math.round(wholesaleCents * 1.45)
  const retailInc     = Math.round(form.is_gst_free ? retailEx : retailEx * 1.1)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const res = await fetch(`/api/products/${productId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name:               form.name,
        description:        form.description,
        category:           form.category,
        unit:               form.unit,
        wholesale_price:    wholesaleCents,
        stock_total:        stockNum,
        min_order_b2b:      parseInt(form.min_order_b2b) || 1,
        is_gst_free:        form.is_gst_free,
        is_listed_this_week: form.is_listed_this_week,
      }),
    })

    const data = await res.json()
    if (!res.ok) {
      setError(data.error || 'Failed to update product')
      setLoading(false)
      return
    }
    router.push('/dashboard/farmer/inventory')
    router.refresh()
  }

  async function handleDelete() {
    if (!confirm('Delete this product? This cannot be undone.')) return
    const res = await fetch(`/api/products/${productId}`, { method: 'DELETE' })
    if (res.ok) {
      router.push('/dashboard/farmer/inventory')
      router.refresh()
    }
  }

  if (fetching) return (
    <div style={{ padding: '2.5rem', color: 'var(--forest)', opacity: 0.5, fontFamily: 'var(--font-body)' }}>
      Loading product...
    </div>
  )

  if (notFound) return (
    <div style={{ padding: '2.5rem', fontFamily: 'var(--font-body)' }}>
      <p style={{ color: 'var(--forest)', opacity: 0.6, marginBottom: '1rem' }}>Product not found.</p>
      <Link href="/dashboard/farmer/inventory" style={{ color: 'var(--forest)', fontWeight: 700 }}>
        ← Back to Inventory
      </Link>
    </div>
  )

  return (
    <div style={{ padding: '2.5rem', maxWidth: '42rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2.5rem', gap: '1rem', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <Link href="/dashboard/farmer/inventory" className="btn btn-ghost btn-sm">← Back</Link>
          <h1 className="type-heading reveal" style={{ color: 'var(--forest)' }}>Edit product</h1>
        </div>
        <button onClick={handleDelete}
          style={{ padding: '0.4rem 1rem', background: '#fee2e2', color: '#991b1b', border: 'none', borderRadius: '0.5rem', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-body)' }}>
          Delete
        </button>
      </div>

      {error && (
        <div className="badge badge-red reveal" style={{ width: '100%', padding: '1rem', borderRadius: '1rem', justifyContent: 'flex-start', marginBottom: '1.5rem', fontSize: '0.7rem' }}>
          ⚠ {error}
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

        {/* Details */}
        <div className="card reveal" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <h2 className="type-label-lg" style={{ color: 'var(--forest)' }}>Product details</h2>
          <div>
            <label className="label">Product name *</label>
            <input className="input" placeholder="e.g. Sunflowers — Large Head" value={form.name} onChange={e => up('name', e.target.value)} required />
          </div>
          <div>
            <label className="label">Description</label>
            <textarea className="input" style={{ height: '5rem', resize: 'none' }} placeholder="Variety, colour, freshness notes…" value={form.description} onChange={e => up('description', e.target.value)} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label className="label">Category *</label>
              <select className="input" value={form.category} onChange={e => up('category', e.target.value)}>
                {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Unit *</label>
              <select className="input" value={form.unit} onChange={e => up('unit', e.target.value)}>
                {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* Pricing */}
        <div className="card reveal reveal-d1" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <h2 className="type-label-lg" style={{ color: 'var(--forest)' }}>Pricing</h2>
          <div>
            <label className="label">Wholesale price (ex-GST) *</label>
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: '1.25rem', top: '50%', transform: 'translateY(-50%)', fontWeight: 700, color: 'var(--moss)' }}>$</span>
              <input className="input" style={{ paddingLeft: '2rem' }} type="number" step="0.01" min="0.01" placeholder="0.00"
                value={form.wholesale_price_dollars} onChange={e => up('wholesale_price_dollars', e.target.value)} required />
            </div>
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: '0.875rem', padding: '1rem', background: 'var(--olive)', borderRadius: '0.75rem', cursor: 'pointer' }}>
            <input type="checkbox" checked={form.is_gst_free} onChange={e => up('is_gst_free', e.target.checked)}
              style={{ width: '1rem', height: '1rem', accentColor: 'var(--forest)' }} />
            <span style={{ fontSize: '0.85rem', color: 'var(--forest)' }}>
              This product is <strong>GST-free</strong> (raw, unprocessed food)
            </span>
          </label>

          {wholesaleCents > 0 && (
            <div className="card-sage" style={{ padding: '1.25rem' }}>
              <p className="type-label-sm" style={{ color: 'var(--forest)', opacity: 0.6, marginBottom: '0.875rem' }}>Price preview</p>
              {[
                { label: 'B2B wholesale (ex-GST)', val: wholesaleCents },
                { label: 'B2B wholesale (inc-GST)', val: form.is_gst_free ? wholesaleCents : Math.round(wholesaleCents * 1.1) },
                { label: 'B2C retail (inc-GST, 45% markup)', val: retailInc },
              ].map(row => (
                <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0', borderBottom: '1px solid rgba(1,71,46,0.1)' }}>
                  <span className="type-label-sm" style={{ color: 'var(--forest)', opacity: 0.65 }}>{row.label}</span>
                  <span style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', color: 'var(--forest)', letterSpacing: '-0.02em' }}>{formatPrice(row.val)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Stock */}
        <div className="card reveal reveal-d2" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <h2 className="type-label-lg" style={{ color: 'var(--forest)' }}>Stock</h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label className="label">Total stock *</label>
              <input className="input" type="number" min="0" placeholder="e.g. 50"
                value={form.stock_total} onChange={e => up('stock_total', e.target.value)} required />
            </div>
            <div>
              <label className="label">Min B2B order</label>
              <input className="input" type="number" min="1"
                value={form.min_order_b2b} onChange={e => up('min_order_b2b', e.target.value)} />
            </div>
          </div>
          {stockNum > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.875rem' }}>
              {[
                { label: 'B2B Wholesale', val: splits.b2b, bg: 'var(--forest)', clr: 'var(--cream)', sub: 'var(--moss)' },
                { label: 'B2C Retail',    val: splits.b2c, bg: 'var(--sage)',   clr: 'var(--forest)', sub: 'rgba(1,71,46,0.5)' },
              ].map(s => (
                <div key={s.label} style={{ background: s.bg, borderRadius: '1.5rem', padding: '1.5rem', textAlign: 'center' }}>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: '2.5rem', color: s.clr, letterSpacing: '-0.04em' }}>{s.val}</div>
                  <div className="type-label-sm" style={{ color: s.sub, marginTop: '0.25rem' }}>{s.label}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Listing toggle */}
        <div className="card reveal reveal-d3" style={{ padding: '2rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '2rem' }}>
          <div>
            <h2 className="type-label-lg" style={{ color: 'var(--forest)', marginBottom: '0.375rem' }}>List this week</h2>
            <p style={{ fontSize: '0.8rem', color: 'var(--moss)' }}>
              {listingOpen ? 'Listing window is open — changes apply immediately.' : 'Window closed. Toggle locked until Sunday midnight AEST.'}
            </p>
          </div>
          <button type="button"
            onClick={() => listingOpen && up('is_listed_this_week', !form.is_listed_this_week)}
            disabled={!listingOpen}
            className={`toggle ${form.is_listed_this_week ? 'toggle-on' : 'toggle-off'}`}
            style={!listingOpen ? { opacity: 0.4, cursor: 'not-allowed' } : {}}
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.875rem' }}>
          <Link href="/dashboard/farmer/inventory" className="btn btn-outline" style={{ justifyContent: 'center' }}>Cancel</Link>
          <button type="submit" className="btn btn-forest" disabled={loading}>
            {loading ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </form>
    </div>
  )
}
