'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { isListingWindowOpen } from '@/lib/utils/timezone'
import { calculateStockSplits, formatPrice, GST_FREE_EXPLANATION } from '@/lib/utils/pricing'
import ProductImageUpload from '@/components/ProductImageUpload'
import ColorTagPicker from '@/components/ColorTagPicker'
import { findSpeciesByCommonName } from '@/lib/data/flowerSpecies'

const CATEGORIES = [{ id: 'flowers_cut', label: '✿ Cut Flowers' }, { id: 'flowers_dried', label: '🌾 Dried Flowers' }, { id: 'flowers_native', label: '🌼 Australian Natives' }, { id: 'foliage', label: '🍃 Foliage' }, { id: 'vegetables', label: '🥦 Vegetables' }, { id: 'herbs', label: '🌿 Herbs' }, { id: 'fruit', label: '🍓 Fruit' }, { id: 'eggs', label: '🥚 Eggs' }, { id: 'honey', label: '🍯 Honey' }, { id: 'other', label: '📦 Other' }]
const UNITS = ['bunch', 'stem', 'kg', 'g', 'each', 'tray', 'box', 'punnet', 'dozen']

export default function NewProductPage() {
  const router = useRouter()
  const listingOpen = isListingWindowOpen()
  const [form, setForm] = useState({ name: '', description: '', category: 'flowers_cut', unit: 'bunch', wholesale_price_dollars: '', markup_pct: '45', stock_total: '', min_order_b2b: '1', b2b_stock_pct: '50', is_gst_free: false, is_listed_this_week: listingOpen, image_urls: [] as string[], color_tags: [] as string[], latin_name: '', stems_per_unit: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const up = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))

  const stockNum = parseInt(form.stock_total) || 0
  const b2bPct = (parseFloat(form.b2b_stock_pct) || 0) / 100
  const splits = calculateStockSplits(stockNum, b2bPct)
  const wholesaleCents = Math.round(parseFloat(form.wholesale_price_dollars || '0') * 100)
  const markupPct = (parseFloat(form.markup_pct) || 0) / 100
  const retailEx = Math.round(wholesaleCents * (1 + markupPct))
  const retailInc = Math.round(form.is_gst_free ? retailEx : retailEx * 1.1)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setLoading(true); setError('')
    const res = await fetch('/api/products', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: form.name, description: form.description, category: form.category, unit: form.unit, wholesale_price: wholesaleCents, b2c_markup_pct: markupPct, stock_total: stockNum, min_order_b2b: parseInt(form.min_order_b2b) || 1, b2b_stock_pct: b2bPct, is_gst_free: form.is_gst_free, is_listed_this_week: form.is_listed_this_week, image_url: form.image_urls[0] || null, image_urls: form.image_urls, color_tags: form.color_tags, latin_name: form.latin_name || null, stems_per_unit: form.unit === 'bunch' && form.stems_per_unit ? parseInt(form.stems_per_unit) : null }) })
    const data = await res.json()
    if (!res.ok) { setError(data.error || 'Failed to create product'); setLoading(false); return }
    router.push('/dashboard/farmer/inventory')
  }

  return (
    <div className="page-pad" style={{ padding: '2.5rem', maxWidth: '42rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2.5rem' }}>
        <Link href="/dashboard/farmer/inventory" className="btn btn-ghost btn-sm">← Back</Link>
        <h1 className="type-heading reveal" style={{ color: 'var(--forest)' }}>Add product</h1>
      </div>

      {error && <div className="badge badge-red reveal" style={{ width: '100%', padding: '1rem', borderRadius: '1rem', justifyContent: 'flex-start', marginBottom: '1.5rem', fontSize: '0.7rem' }}>⚠ {error}</div>}

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

        {/* Details */}
        <div className="card reveal" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <h2 className="type-label-lg" style={{ color: 'var(--forest)' }}>Product details</h2>
          <div><label className="label">Product name *</label><input className="input" placeholder="e.g. Sunflowers — Large Head" value={form.name} onChange={e => up('name', e.target.value)} required /></div>
          <div><label className="label">Description</label><textarea className="input" style={{ height: '5rem', resize: 'none' }} placeholder="Variety, colour, freshness notes…" value={form.description} onChange={e => up('description', e.target.value)} /></div>
          <div className="mg-stack" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div><label className="label">Category *</label><select className="input" value={form.category} onChange={e => up('category', e.target.value)}>{CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}</select></div>
            <div><label className="label">Unit *</label><select className="input" value={form.unit} onChange={e => up('unit', e.target.value)}>{UNITS.map(u => <option key={u} value={u}>{u}</option>)}</select></div>
          </div>
          {form.unit === 'bunch' && (
            <div>
              <label className="label">Stems per bunch</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                <input className="input" style={{ width: '6rem' }} type="number" min="1" placeholder="e.g. 10" value={form.stems_per_unit} onChange={e => up('stems_per_unit', e.target.value)} />
                {[5, 10].map(n => (
                  <button key={n} type="button" onClick={() => up('stems_per_unit', String(n))}
                    style={{ padding: '0.4rem 0.875rem', borderRadius: '99px', border: form.stems_per_unit === String(n) ? '1.5px solid var(--forest)' : '1.5px solid var(--olive)', background: form.stems_per_unit === String(n) ? 'var(--olive)' : 'white', color: 'var(--forest)', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-body)' }}>
                    {n} stems
                  </button>
                ))}
              </div>
              <p style={{ fontSize: '0.75rem', color: 'var(--moss)', marginTop: '0.375rem' }}>We recommend 5 or 10 stems per bunch — makes it easy for buyers to compare prices across growers by the stem.</p>
            </div>
          )}
          <div>
            <label className="label">Latin / botanical name (optional)</label>
            <input className="input" placeholder="e.g. Helianthus annuus" value={form.latin_name} onChange={e => up('latin_name', e.target.value)} />
            {!form.latin_name && findSpeciesByCommonName(form.name) && (
              <button
                type="button"
                onClick={() => up('latin_name', findSpeciesByCommonName(form.name)!.latinName)}
                style={{ marginTop: '0.5rem', padding: '0.3rem 0.75rem', borderRadius: '99px', border: '1px solid var(--olive)', background: 'var(--olive)', color: 'var(--forest)', fontSize: '0.78rem', cursor: 'pointer', fontFamily: 'var(--font-body)' }}
              >
                Use "{findSpeciesByCommonName(form.name)!.latinName}"?
              </button>
            )}
            <p style={{ fontSize: '0.75rem', color: 'var(--moss)', marginTop: '0.375rem' }}>Helps buyers find this listing even if they search by the botanical name.</p>
          </div>
          <div>
            <label className="label">Color</label>
            <ColorTagPicker selected={form.color_tags} onChange={ids => up('color_tags', ids)} />
          </div>
        </div>

        {/* Pricing */}
        <div className="card reveal reveal-d1" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <h2 className="type-label-lg" style={{ color: 'var(--forest)' }}>Pricing</h2>
          <div className="mg-stack" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label className="label">Wholesale price (ex-GST) *</label>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: '1.25rem', top: '50%', transform: 'translateY(-50%)', fontWeight: 700, color: 'var(--moss)' }}>$</span>
                <input className="input" style={{ paddingLeft: '2rem' }} type="number" step="0.01" min="0.01" placeholder="0.00" value={form.wholesale_price_dollars} onChange={e => up('wholesale_price_dollars', e.target.value)} required />
              </div>
            </div>
            <div>
              <label className="label">B2C markup %</label>
              <div style={{ position: 'relative' }}>
                <input className="input" style={{ paddingRight: '2rem' }} type="number" step="1" min="0" max="500" placeholder="45" value={form.markup_pct} onChange={e => up('markup_pct', e.target.value)} />
                <span style={{ position: 'absolute', right: '1.25rem', top: '50%', transform: 'translateY(-50%)', fontWeight: 700, color: 'var(--moss)' }}>%</span>
              </div>
              <p style={{ fontSize: '0.75rem', color: 'var(--moss)', marginTop: '0.375rem' }}>Added on top of your wholesale price for retail buyers. Defaults to 45%.</p>
            </div>
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: '0.875rem', padding: '1rem', background: 'var(--olive)', borderRadius: '0.75rem', cursor: 'pointer' }}>
            <input type="checkbox" checked={form.is_gst_free} onChange={e => up('is_gst_free', e.target.checked)} style={{ width: '1rem', height: '1rem', accentColor: 'var(--forest)' }} />
            <span style={{ fontSize: '0.85rem', color: 'var(--forest)' }}>
              This product is <strong>GST-free</strong> ({GST_FREE_EXPLANATION})
            </span>
          </label>

          {wholesaleCents > 0 && (
            <div className="card-sage" style={{ padding: '1.25rem' }}>
              <p className="type-label-sm" style={{ color: 'var(--forest)', opacity: 0.6, marginBottom: '0.875rem' }}>Price preview</p>
              {[
                { label: 'B2B wholesale (ex-GST)', val: wholesaleCents },
                { label: 'B2B wholesale (inc-GST)', val: form.is_gst_free ? wholesaleCents : Math.round(wholesaleCents * 1.1) },
                { label: `B2C retail (inc-GST, ${form.markup_pct || 0}% markup)`, val: retailInc },
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
          <div className="mg-stack" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div><label className="label">Total stock *</label><input className="input" type="number" min="1" placeholder="e.g. 50" value={form.stock_total} onChange={e => up('stock_total', e.target.value)} required /></div>
            <div><label className="label">Min B2B order</label><input className="input" type="number" min="1" value={form.min_order_b2b} onChange={e => up('min_order_b2b', e.target.value)} /></div>
          </div>
          <div>
            <label className="label">B2B stock reserve %</label>
            <div style={{ position: 'relative' }}>
              <input className="input" style={{ paddingRight: '2rem' }} type="number" step="1" min="0" max="100" placeholder="50" value={form.b2b_stock_pct} onChange={e => up('b2b_stock_pct', e.target.value)} />
              <span style={{ position: 'absolute', right: '1.25rem', top: '50%', transform: 'translateY(-50%)', fontWeight: 700, color: 'var(--moss)' }}>%</span>
            </div>
            <p style={{ fontSize: '0.75rem', color: 'var(--moss)', marginTop: '0.375rem' }}>How much of your stock to hold for wholesale buyers vs retail. The rest goes to retail.</p>
          </div>
          {stockNum > 0 && (
            <div className="mg-stack" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.875rem' }}>
              {[
                { label: 'B2B Wholesale', val: splits.b2b, bg: 'var(--forest)', clr: 'var(--cream)', sub: 'var(--moss)' },
                { label: 'B2C Retail', val: splits.b2c, bg: 'var(--sage)', clr: 'var(--forest)', sub: 'rgba(1,71,46,0.5)' },
              ].map(s => (
                <div key={s.label} style={{ background: s.bg, borderRadius: '1.5rem', padding: '1.5rem', textAlign: 'center' }}>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: '2.5rem', color: s.clr, letterSpacing: '-0.04em' }}>{s.val}</div>
                  <div className="type-label-sm" style={{ color: s.sub, marginTop: '0.25rem' }}>{s.label}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Photos */}
        <div className="card reveal reveal-d3" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <h2 className="type-label-lg" style={{ color: 'var(--forest)' }}>Photos</h2>
          <p style={{ fontSize: '0.8rem', color: 'var(--moss)', lineHeight: 1.6, marginTop: '-0.5rem' }}>
            Use real photos of this exact crop, not stock images — buyers want to see the actual stem length, bloom size, and quality they'll receive.
          </p>
          {form.image_urls.length === 0 && (
            <p style={{ fontSize: '0.78rem', color: '#991b1b', background: '#fee2e2', padding: '0.5rem 0.75rem', borderRadius: '0.5rem' }}>
              No photo yet — listings with a real photo sell better.
            </p>
          )}
          <ProductImageUpload
            urls={form.image_urls}
            onChange={urls => up('image_urls', urls)}
          />
        </div>

        {/* Listing toggle */}
        <div className="card reveal reveal-d4" style={{ padding: '2rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '2rem' }}>
          <div>
            <h2 className="type-label-lg" style={{ color: 'var(--forest)', marginBottom: '0.375rem' }}>List this week</h2>
            <p style={{ fontSize: '0.8rem', color: 'var(--moss)' }}>{listingOpen ? 'Listing window is open — list immediately.' : 'Window closed. Product saved for next cycle.'}</p>
          </div>
          <button type="button" onClick={() => listingOpen && up('is_listed_this_week', !form.is_listed_this_week)} disabled={!listingOpen}
            className={`toggle ${form.is_listed_this_week ? 'toggle-on' : 'toggle-off'}`}
            style={!listingOpen ? { opacity: 0.4, cursor: 'not-allowed' } : {}} />
        </div>

        <div className="mg-stack" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.875rem' }}>
          <Link href="/dashboard/farmer/inventory" className="btn btn-outline" style={{ justifyContent: 'center' }}>Cancel</Link>
          <button type="submit" className="btn btn-forest" disabled={loading}>{loading ? 'Saving…' : 'Save product'}</button>
        </div>
      </form>
    </div>
  )
}
