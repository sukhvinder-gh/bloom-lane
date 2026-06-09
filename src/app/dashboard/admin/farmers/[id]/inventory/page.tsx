'use client'
import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { formatPrice } from '@/lib/utils/pricing'
import ProductImageUpload from '@/components/ProductImageUpload'

const CATEGORIES = [
  { id: 'flowers_cut', label: '✿ Cut Flowers' }, { id: 'flowers_dried', label: '🌾 Dried Flowers' },
  { id: 'foliage', label: '🍃 Foliage' }, { id: 'vegetables', label: '🥦 Vegetables' },
  { id: 'herbs', label: '🌿 Herbs' }, { id: 'fruit', label: '🍓 Fruit' },
  { id: 'eggs', label: '🥚 Eggs' }, { id: 'honey', label: '🍯 Honey' }, { id: 'other', label: '📦 Other' },
]
const UNITS = ['bunch', 'stem', 'kg', 'g', 'each', 'tray', 'box', 'punnet', 'dozen']

const BLANK = {
  name: '', description: '', category: 'flowers_cut', unit: 'bunch',
  wholesale_price_dollars: '', stock_total: '', min_order_b2b: '1',
  is_gst_free: false, is_listed_this_week: false, image_url: '', image_urls: [] as string[],
}

export default function AdminFarmerInventoryPage() {
  const params = useParams()
  const farmerId = params.id as string

  const [products, setProducts]   = useState<any[]>([])
  const [loading, setLoading]     = useState(true)
  const [farmerName, setFarmerName] = useState('')
  const [showForm, setShowForm]   = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm]           = useState(BLANK)
  const [saving, setSaving]       = useState(false)
  const [msg, setMsg]             = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [deleting, setDeleting]   = useState<string | null>(null)

  const up = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))

  useEffect(() => {
    fetch(`/api/admin/farmers/${farmerId}/products`)
      .then(r => r.json())
      .then(d => { setProducts(d.data || []); setLoading(false) })
      .catch(() => setLoading(false))

    fetch(`/api/admin/farmers/${farmerId}`)
      .then(r => r.json())
      .then(d => setFarmerName(d.data?.business_name || ''))
  }, [farmerId])

  function startAdd() {
    setForm(BLANK)
    setEditingId(null)
    setShowForm(true)
    setMsg(null)
  }

  function startEdit(p: any) {
    setForm({
      name: p.name || '',
      description: p.description || '',
      category: p.category || 'flowers_cut',
      unit: p.unit || 'bunch',
      wholesale_price_dollars: ((p.wholesale_price || 0) / 100).toFixed(2),
      stock_total: String(p.stock_total || ''),
      min_order_b2b: String(p.min_order_b2b || '1'),
      is_gst_free: p.is_gst_free || false,
      is_listed_this_week: p.is_listed_this_week || false,
      image_url: p.image_url || '',
      image_urls: p.image_urls || [],
    })
    setEditingId(p.id)
    setShowForm(true)
    setMsg(null)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true); setMsg(null)

    const wholesaleCents = Math.round(parseFloat(form.wholesale_price_dollars || '0') * 100)
    const imageUrls = form.image_urls.length > 0 ? form.image_urls : (form.image_url ? [form.image_url] : [])
    const primaryUrl = imageUrls[0] || form.image_url || undefined

    const payload = {
      name: form.name,
      description: form.description,
      category: form.category,
      unit: form.unit,
      wholesale_price: wholesaleCents,
      stock_total: parseInt(form.stock_total) || 0,
      min_order_b2b: parseInt(form.min_order_b2b) || 1,
      is_gst_free: form.is_gst_free,
      is_listed_this_week: form.is_listed_this_week,
      image_url: primaryUrl || null,
      image_urls: imageUrls,
    }

    let res: Response
    if (editingId) {
      res = await fetch(`/api/admin/farmers/${farmerId}/products`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId: editingId, ...payload }),
      })
    } else {
      res = await fetch(`/api/admin/farmers/${farmerId}/products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
    }

    const json = await res.json()
    if (!res.ok) {
      setMsg({ type: 'err', text: json.error || 'Save failed' })
    } else {
      setMsg({ type: 'ok', text: editingId ? 'Product updated.' : 'Product added.' })
      if (editingId) {
        setProducts(ps => ps.map(p => p.id === editingId ? json.data : p))
      } else {
        setProducts(ps => [json.data, ...ps])
      }
      setShowForm(false)
      setEditingId(null)
    }
    setSaving(false)
  }

  async function handleDelete(productId: string) {
    if (!confirm('Remove this product? It will be deactivated and removed from listings.')) return
    setDeleting(productId)
    const res = await fetch(`/api/admin/farmers/${farmerId}/products`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId }),
    })
    if (res.ok) {
      setProducts(ps => ps.filter(p => p.id !== productId))
    }
    setDeleting(null)
  }

  const wholesaleCents = Math.round(parseFloat(form.wholesale_price_dollars || '0') * 100)

  return (
    <div className="page-pad" style={{ padding: '2.5rem', maxWidth: '56rem' }}>

      {/* Header */}
      <div style={{ marginBottom: '2rem' }}>
        <Link href={`/dashboard/admin/farmers/${farmerId}`} style={{ color: 'var(--moss)', fontSize: '0.85rem', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.375rem', marginBottom: '1rem' }}>
          ← Back to Grower Profile
        </Link>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', flexWrap: 'wrap' }}>
          <div>
            <h1 className="type-heading reveal" style={{ color: 'var(--navy)', marginBottom: '0.25rem' }}>
              Inventory — {farmerName || 'Grower'}
            </h1>
            <p className="type-label" style={{ color: 'var(--moss)' }}>
              Admin override — listing window restrictions do not apply
            </p>
          </div>
          <button onClick={startAdd} className="btn btn-forest btn-sm">+ Add Product</button>
        </div>
      </div>

      {/* Add/Edit form */}
      {showForm && (
        <div className="card reveal" style={{ padding: '1.75rem', marginBottom: '2rem' }}>
          <h2 className="type-label-lg" style={{ color: 'var(--navy)', marginBottom: '1.25rem' }}>
            {editingId ? 'Edit Product' : 'New Product'}
          </h2>

          {msg && (
            <div style={{ marginBottom: '1rem', padding: '0.75rem 1rem', borderRadius: '0.625rem', fontSize: '0.8rem', fontWeight: 600, background: msg.type === 'ok' ? 'var(--green-soft)' : 'var(--terra-soft)', color: msg.type === 'ok' ? 'var(--green)' : 'var(--terracotta)' }}>
              {msg.text}
            </div>
          )}

          <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div style={{ gridColumn: '1 / -1' }}>
                <label className="type-label-sm" style={{ color: 'var(--moss)', display: 'block', marginBottom: '0.375rem' }}>Product Name *</label>
                <input className="input" value={form.name} onChange={e => up('name', e.target.value)} required style={{ width: '100%' }} />
              </div>
              <div>
                <label className="type-label-sm" style={{ color: 'var(--moss)', display: 'block', marginBottom: '0.375rem' }}>Category</label>
                <select className="input" value={form.category} onChange={e => up('category', e.target.value)} style={{ width: '100%' }}>
                  {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                </select>
              </div>
              <div>
                <label className="type-label-sm" style={{ color: 'var(--moss)', display: 'block', marginBottom: '0.375rem' }}>Unit</label>
                <select className="input" value={form.unit} onChange={e => up('unit', e.target.value)} style={{ width: '100%' }}>
                  {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label className="type-label-sm" style={{ color: 'var(--moss)', display: 'block', marginBottom: '0.375rem' }}>Description</label>
                <textarea className="input" value={form.description} onChange={e => up('description', e.target.value)} rows={2} style={{ width: '100%', resize: 'vertical' }} />
              </div>
              <div>
                <label className="type-label-sm" style={{ color: 'var(--moss)', display: 'block', marginBottom: '0.375rem' }}>Wholesale Price (ex-GST) *</label>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: '0.875rem', top: '50%', transform: 'translateY(-50%)', fontWeight: 700, color: 'var(--moss)' }}>$</span>
                  <input className="input" style={{ paddingLeft: '1.5rem', width: '100%' }} type="number" step="0.01" min="0.01" placeholder="0.00"
                    value={form.wholesale_price_dollars} onChange={e => up('wholesale_price_dollars', e.target.value)} required />
                </div>
                {wholesaleCents > 0 && (
                  <p className="type-label-sm" style={{ color: 'var(--moss)', marginTop: '0.25rem' }}>
                    B2C retail ≈ {formatPrice(Math.round(wholesaleCents * 1.45 * (form.is_gst_free ? 1 : 1.1)))} inc-GST
                  </p>
                )}
              </div>
              <div>
                <label className="type-label-sm" style={{ color: 'var(--moss)', display: 'block', marginBottom: '0.375rem' }}>Total Stock *</label>
                <input className="input" type="number" min="0" value={form.stock_total} onChange={e => up('stock_total', e.target.value)} required style={{ width: '100%' }} />
              </div>
              <div>
                <label className="type-label-sm" style={{ color: 'var(--moss)', display: 'block', marginBottom: '0.375rem' }}>Min B2B Order</label>
                <input className="input" type="number" min="1" value={form.min_order_b2b} onChange={e => up('min_order_b2b', e.target.value)} style={{ width: '100%' }} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', paddingTop: '1.5rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.85rem', color: 'var(--navy)' }}>
                  <input type="checkbox" checked={form.is_gst_free} onChange={e => up('is_gst_free', e.target.checked)} style={{ width: '1rem', height: '1rem', accentColor: 'var(--green)' }} />
                  GST-free
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.85rem', color: 'var(--navy)' }}>
                  <input type="checkbox" checked={form.is_listed_this_week} onChange={e => up('is_listed_this_week', e.target.checked)} style={{ width: '1rem', height: '1rem', accentColor: 'var(--green)' }} />
                  Listed this week
                </label>
              </div>
            </div>

            {/* Photo upload */}
            <div>
              <label className="type-label-sm" style={{ color: 'var(--moss)', display: 'block', marginBottom: '0.5rem' }}>Product Photos</label>
              <ProductImageUpload
                urls={form.image_urls.length > 0 ? form.image_urls : (form.image_url ? [form.image_url] : [])}
                onChange={urls => { up('image_urls', urls); up('image_url', urls[0] || '') }}
              />
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => { setShowForm(false); setEditingId(null) }} className="btn btn-ghost">Cancel</button>
              <button type="submit" disabled={saving} className="btn btn-forest" style={{ minWidth: '7rem' }}>
                {saving ? 'Saving…' : editingId ? 'Update' : 'Add Product'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Product list */}
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="card" style={{ padding: '1.25rem', height: '5rem' }} />
          ))}
        </div>
      ) : products.length === 0 ? (
        <div className="card" style={{ padding: '4rem', textAlign: 'center' }}>
          <p style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>📋</p>
          <p className="type-label" style={{ color: 'var(--moss)', marginBottom: '1rem' }}>No products yet</p>
          <button onClick={startAdd} className="btn btn-forest btn-sm">Add first product</button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {products.map(p => (
            <div key={p.id} className="card" style={{ padding: '1.25rem 1.5rem', display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
              {/* Thumbnail */}
              {(p.image_url || (p.image_urls && p.image_urls[0])) ? (
                <img src={p.image_url || p.image_urls[0]} alt={p.name}
                  style={{ width: '3.5rem', height: '3.5rem', borderRadius: '0.625rem', objectFit: 'cover', flexShrink: 0 }} />
              ) : (
                <div style={{ width: '3.5rem', height: '3.5rem', borderRadius: '0.625rem', background: 'var(--green-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.25rem', flexShrink: 0 }}>🌿</div>
              )}

              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--navy)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</p>
                <p className="type-label-sm" style={{ color: 'var(--moss)' }}>
                  {formatPrice(p.wholesale_price)} wholesale · {p.stock_total} {p.unit}s in stock
                </p>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
                <span className={`badge ${p.is_listed_this_week ? 'badge-sage' : 'badge-olive'}`}>
                  {p.is_listed_this_week ? 'Listed' : 'Unlisted'}
                </span>
                <button onClick={() => startEdit(p)} className="btn btn-ghost btn-sm">Edit</button>
                <button
                  onClick={() => handleDelete(p.id)}
                  disabled={deleting === p.id}
                  className="btn btn-sm"
                  style={{ background: 'var(--terra-soft)', color: 'var(--terracotta)', border: 'none' }}
                >
                  {deleting === p.id ? '…' : 'Remove'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
