'use client'
import { useState, useRef, useCallback } from 'react'
import Link from 'next/link'
import { COLOR_PALETTE } from '@/lib/data/flowerSpecies'

const CATEGORIES: Record<string, string> = {
  flowers_cut: 'Cut Flowers', flowers_dried: 'Dried Flowers', flowers_native: 'Australian Natives', foliage: 'Foliage',
  vegetables: 'Vegetables', herbs: 'Herbs', fruit: 'Fruit', eggs: 'Eggs', honey: 'Honey', other: 'Other',
}
const VALID_CATEGORIES = Object.keys(CATEGORIES)
const VALID_COLORS: string[] = COLOR_PALETTE.map(c => c.id)
const MAX_COLORS = 6

const TEMPLATE_CSV = `name,category,unit,wholesale_price,markup_pct,stock,min_order,stock_reserve_pct,gst_free,stems_per_unit,colors,description
Mixed Roses,flowers_cut,stem,4.50,45,100,10,50,no,,red; pink,Beautiful mixed roses from our garden
Sunflowers,flowers_cut,stem,3.20,,80,5,,no,,yellow,
Baby's Breath,foliage,bunch,6.00,50,40,1,70,yes,10,white,
Fresh Basil,herbs,bunch,4.00,,60,3,,no,,green,Aromatic sweet basil
`

function parseCSV(text: string): string[][] {
  const lines = text.trim().split(/\r?\n/)
  return lines.map(line => {
    const result: string[] = []
    let current = ''
    let inQuotes = false
    for (let i = 0; i < line.length; i++) {
      if (line[i] === '"') { inQuotes = !inQuotes }
      else if (line[i] === ',' && !inQuotes) { result.push(current.trim()); current = '' }
      else { current += line[i] }
    }
    result.push(current.trim())
    return result
  })
}

type ParsedRow = {
  name: string; category: string; unit: string; wholesale_price: string; markup_pct: string
  stock: string; min_order: string; stock_reserve_pct: string; gst_free: string; stems_per_unit: string; colors: string; description: string
  _errors: string[]
}

function validateRows(rows: string[][]): ParsedRow[] {
  const [header, ...data] = rows
  const col = (name: string) => header.findIndex(h => h.toLowerCase().trim() === name)
  const ci = {
    name: col('name'), category: col('category'), unit: col('unit'), wholesale_price: col('wholesale_price'),
    markup_pct: col('markup_pct'), stock: col('stock'), min_order: col('min_order'), stock_reserve_pct: col('stock_reserve_pct'),
    gst_free: col('gst_free'), stems_per_unit: col('stems_per_unit'), colors: col('colors'), description: col('description'),
  }

  return data.filter(r => r.some(c => c.trim())).map(r => {
    const get = (idx: number) => idx >= 0 ? (r[idx] || '') : ''
    const errors: string[] = []
    const name = get(ci.name)
    const category = get(ci.category).toLowerCase()
    const unit = get(ci.unit)
    const wholesale_price = get(ci.wholesale_price)
    const markup_pct = get(ci.markup_pct)
    const stock = get(ci.stock) || '0'
    const min_order = get(ci.min_order) || '1'
    const stock_reserve_pct = get(ci.stock_reserve_pct)
    const gst_free = get(ci.gst_free)
    const stems_per_unit = get(ci.stems_per_unit)
    const colors = get(ci.colors)
    const description = get(ci.description)

    if (!name.trim()) errors.push('Name required')
    if (!VALID_CATEGORIES.includes(category)) errors.push(`Invalid category "${category}"`)
    if (!unit.trim()) errors.push('Unit required')
    if (isNaN(Number(wholesale_price)) || Number(wholesale_price) <= 0) errors.push('Price must be > 0')
    if (markup_pct.trim() && (isNaN(Number(markup_pct)) || Number(markup_pct) < 0 || Number(markup_pct) > 500)) {
      errors.push('Markup % must be between 0 and 500')
    }
    if (isNaN(Number(stock)) || Number(stock) < 0) errors.push('Stock must be ≥ 0')
    if (stock_reserve_pct.trim() && (isNaN(Number(stock_reserve_pct)) || Number(stock_reserve_pct) < 0 || Number(stock_reserve_pct) > 100)) {
      errors.push('Stock reserve % must be between 0 and 100')
    }
    if (stems_per_unit.trim() && (!Number.isInteger(Number(stems_per_unit)) || Number(stems_per_unit) <= 0)) {
      errors.push('Stems/unit must be a whole number > 0')
    }
    if (colors.trim()) {
      const tags = colors.split(';').map(c => c.trim().toLowerCase()).filter(Boolean)
      const bad = tags.filter(c => !VALID_COLORS.includes(c))
      if (bad.length) errors.push(`Unknown colour "${bad[0]}" — see valid colours`)
      else if (tags.length > MAX_COLORS) errors.push(`Max ${MAX_COLORS} colours`)
    }

    return { name, category, unit, wholesale_price, markup_pct, stock, min_order, stock_reserve_pct, gst_free, stems_per_unit, colors, description, _errors: errors }
  })
}

export default function BulkImportContent() {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [rows, setRows] = useState<ParsedRow[] | null>(null)
  const [fileName, setFileName] = useState('')
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<{ inserted?: number; errors?: any[] } | null>(null)

  function downloadTemplate() {
    const blob = new Blob([TEMPLATE_CSV], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'inventory_template.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  function processFile(file: File) {
    if (!file.name.endsWith('.csv')) return
    setFileName(file.name)
    setResult(null)
    const reader = new FileReader()
    reader.onload = e => {
      const text = e.target?.result as string
      const parsed = parseCSV(text)
      if (parsed.length < 2) return
      setRows(validateRows(parsed))
    }
    reader.readAsText(file)
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) processFile(file)
  }, [])

  async function doImport() {
    if (!rows) return
    const valid = rows.filter(r => r._errors.length === 0)
    if (valid.length === 0) return
    setImporting(true)
    setResult(null)
    try {
      const products = valid.map(r => ({
        name: r.name,
        category: r.category,
        unit: r.unit,
        wholesale_price: parseFloat(r.wholesale_price),
        b2c_markup_pct: r.markup_pct.trim() ? parseFloat(r.markup_pct) / 100 : undefined,
        stock_total: parseInt(r.stock) || 0,
        min_order_b2b: parseInt(r.min_order) || 1,
        b2b_stock_pct: r.stock_reserve_pct.trim() ? parseFloat(r.stock_reserve_pct) / 100 : undefined,
        is_gst_free: ['yes', 'true', '1'].includes(r.gst_free.toLowerCase()),
        stems_per_unit: r.stems_per_unit.trim() ? parseInt(r.stems_per_unit) : undefined,
        color_tags: r.colors.trim() ? r.colors.split(';').map(c => c.trim().toLowerCase()).filter(Boolean) : undefined,
        description: r.description || undefined,
      }))
      const res = await fetch('/api/products/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ products }),
      })
      const data = await res.json()
      if (res.ok) {
        setResult({ inserted: data.inserted })
        setRows(null)
        setFileName('')
      } else if (data.errors) {
        setResult({ errors: data.errors })
      } else {
        setResult({ errors: [{ row: '—', message: data.error || 'Import failed' }] })
      }
    } catch {
      setResult({ errors: [{ row: '—', message: 'Network error' }] })
    } finally {
      setImporting(false)
    }
  }

  const hasErrors = rows?.some(r => r._errors.length > 0)
  const validCount = rows?.filter(r => r._errors.length === 0).length ?? 0

  return (
    <div style={{ padding: '2.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem', flexWrap: 'wrap' }}>
        <Link href="/dashboard/farmer/inventory" style={{ color: 'var(--moss)', textDecoration: 'none', fontSize: '0.875rem' }}>← Back to Inventory</Link>
        <div>
          <h1 className="type-heading" style={{ color: 'var(--forest)', marginBottom: '0.25rem' }}>Bulk Import</h1>
          <p className="type-label" style={{ color: 'var(--moss)' }}>Upload a CSV file to add multiple products at once</p>
        </div>
      </div>

      <div className="mg-stack" style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '1.5rem', alignItems: 'start' }}>
        {/* Left panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Step 1 */}
          <div className="card" style={{ padding: '1.5rem' }}>
            <p style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--forest)', marginBottom: '0.5rem' }}>Step 1 — Download Template</p>
            <p style={{ fontSize: '0.8rem', color: 'var(--moss)', lineHeight: 1.6, marginBottom: '1rem' }}>
              Download the CSV template, fill in your data, then upload it below.
            </p>
            <button onClick={downloadTemplate} className="btn btn-forest" style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
              ↓ inventory_template.csv
            </button>
          </div>

          {/* Required columns */}
          <div className="card" style={{ padding: '1.5rem' }}>
            <p style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--forest)', marginBottom: '0.75rem' }}>Required columns</p>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
              {['name', 'category', 'unit', 'wholesale_price'].map(c => (
                <li key={c} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem' }}>
                  <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: 'var(--forest)', flexShrink: 0 }} />
                  <code style={{ color: 'var(--forest)', fontFamily: 'monospace' }}>{c}</code>
                </li>
              ))}
            </ul>
            <p style={{ fontSize: '0.75rem', color: 'var(--moss)', marginTop: '0.875rem', lineHeight: 1.6 }}>
              Optional: markup_pct (defaults to 45), stock, min_order, stock_reserve_pct (% for wholesale, defaults to 50), gst_free (yes/no), stems_per_unit, colors, description
            </p>
            <p style={{ fontSize: '0.75rem', color: 'var(--moss)', marginTop: '0.5rem', lineHeight: 1.6 }}>
              Categories: {VALID_CATEGORIES.join(', ')}
            </p>
          </div>

          {/* Colours — spelled out separately since the CSV cell has to match
              the platform's own colour filter exactly, not any free text. */}
          <div className="card" style={{ padding: '1.5rem' }}>
            <p style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--forest)', marginBottom: '0.5rem' }}>Colours (optional)</p>
            <p style={{ fontSize: '0.75rem', color: 'var(--moss)', lineHeight: 1.6, marginBottom: '0.75rem' }}>
              Separate multiple colours with a semicolon, e.g. <code style={{ fontFamily: 'monospace' }}>red; pink</code>.
              Up to {MAX_COLORS}. Must match these exactly (lowercase, as shown) so they match the storefront's colour filter:
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem' }}>
              {VALID_COLORS.map(c => (
                <code key={c} style={{ fontFamily: 'monospace', fontSize: '0.75rem', background: 'var(--olive)', color: 'var(--forest)', padding: '0.15rem 0.5rem', borderRadius: '99px' }}>{c}</code>
              ))}
            </div>
          </div>
        </div>

        {/* Right panel — upload + preview */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Step 2 */}
          <div className="card" style={{ padding: '1.5rem' }}>
            <p style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--forest)', marginBottom: '1rem' }}>Step 2 — Upload Your CSV</p>

            <div
              onDragOver={e => { e.preventDefault(); setDragging(true) }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              onClick={() => fileInputRef.current?.click()}
              style={{
                border: `2px dashed ${dragging ? 'var(--forest)' : 'var(--sage)'}`,
                borderRadius: '12px',
                padding: '3rem 2rem',
                textAlign: 'center',
                cursor: 'pointer',
                background: dragging ? 'var(--olive)' : 'transparent',
                transition: 'all 0.15s',
              }}
            >
              <div style={{ fontSize: '2rem', marginBottom: '0.75rem', color: 'var(--moss)' }}>↑</div>
              <p style={{ fontWeight: 600, color: 'var(--forest)', marginBottom: '0.25rem' }}>
                {fileName || 'Drop your CSV here'}
              </p>
              <p style={{ fontSize: '0.8rem', color: 'var(--moss)' }}>or click to browse</p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                style={{ display: 'none' }}
                onChange={e => {
                  const f = e.target.files?.[0]
                  if (f) processFile(f)
                  // Reset so picking the same filename again (e.g. after fixing
                  // errors and re-saving over the same file) still fires onChange —
                  // browsers don't re-fire it if the input's value didn't change.
                  e.target.value = ''
                }}
              />
            </div>
          </div>

          {/* Preview table */}
          {rows && rows.length > 0 && (
            <div className="card" style={{ overflow: 'hidden' }}>
              <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--sage)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <p style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--forest)' }}>
                  {rows.length} row{rows.length !== 1 ? 's' : ''} found
                  {hasErrors && <span style={{ color: 'var(--terracotta)', marginLeft: '0.75rem' }}>⚠ {rows.length - validCount} with errors</span>}
                </p>
                {!hasErrors && (
                  <button
                    onClick={doImport}
                    disabled={importing}
                    className="btn btn-forest btn-sm"
                  >
                    {importing ? 'Importing…' : `Import ${validCount} product${validCount !== 1 ? 's' : ''}`}
                  </button>
                )}
              </div>
              <div style={{ overflowX: 'auto' }}>
                <div className="table-wrap">
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                  <thead>
                    <tr style={{ background: 'var(--olive)', borderBottom: '1px solid var(--sage)' }}>
                      {['Name', 'Category', 'Unit', 'Price', 'Markup %', 'Stock', 'GST Free', 'Stems/Unit', 'Colours', 'Errors'].map(h => (
                        <th key={h} className="type-label-sm" style={{ padding: '0.625rem 0.875rem', textAlign: 'left', color: 'var(--moss)', letterSpacing: '0.1em' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.slice(0, 50).map((r, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid var(--sage)', background: r._errors.length > 0 ? 'rgba(196,80,80,0.04)' : 'transparent' }}>
                        <td style={{ padding: '0.625rem 0.875rem', fontWeight: 600, color: 'var(--forest)' }}>{r.name || <em style={{ color: 'var(--terracotta)' }}>—</em>}</td>
                        <td style={{ padding: '0.625rem 0.875rem', color: VALID_CATEGORIES.includes(r.category) ? 'var(--forest)' : 'var(--terracotta)' }}>{CATEGORIES[r.category] || r.category}</td>
                        <td style={{ padding: '0.625rem 0.875rem', color: 'var(--moss)' }}>{r.unit}</td>
                        <td style={{ padding: '0.625rem 0.875rem', color: 'var(--forest)' }}>${r.wholesale_price}</td>
                        <td style={{ padding: '0.625rem 0.875rem', color: 'var(--moss)' }}>{r.markup_pct || '45 (default)'}</td>
                        <td style={{ padding: '0.625rem 0.875rem', color: 'var(--moss)' }}>{r.stock}</td>
                        <td style={{ padding: '0.625rem 0.875rem', color: 'var(--moss)' }}>{r.gst_free || 'no'}</td>
                        <td style={{ padding: '0.625rem 0.875rem', color: 'var(--moss)' }}>{r.stems_per_unit || '—'}</td>
                        <td style={{ padding: '0.625rem 0.875rem', color: 'var(--moss)' }}>{r.colors || '—'}</td>
                        <td style={{ padding: '0.625rem 0.875rem', color: 'var(--terracotta)', fontSize: '0.75rem' }}>
                          {r._errors.length > 0 ? r._errors.join(', ') : <span style={{ color: 'var(--green)' }}>✓</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
              </div>
              {rows.length > 50 && (
                <p style={{ padding: '0.75rem 1.25rem', fontSize: '0.75rem', color: 'var(--moss)' }}>+ {rows.length - 50} more rows</p>
              )}
              {hasErrors && (
                <div style={{ padding: '1rem 1.25rem', borderTop: '1px solid var(--sage)', background: 'rgba(196,80,80,0.04)' }}>
                  <p style={{ fontSize: '0.8rem', color: 'var(--terracotta)', fontWeight: 600 }}>
                    Fix the errors above before importing. Correct the CSV and re-upload.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Result */}
          {result && (
            <div style={{ padding: '1rem 1.25rem', borderRadius: '10px', background: result.inserted != null ? 'var(--green-soft)' : 'rgba(196,80,80,0.08)', border: `1px solid ${result.inserted != null ? 'var(--green)' : 'var(--terracotta)'}` }}>
              {result.inserted != null ? (
                <p style={{ color: 'var(--green)', fontWeight: 700 }}>✓ Imported {result.inserted} product{result.inserted !== 1 ? 's' : ''} successfully</p>
              ) : (
                <>
                  <p style={{ color: 'var(--terracotta)', fontWeight: 700, marginBottom: '0.5rem' }}>Import errors:</p>
                  {result.errors?.map((e, i) => (
                    <p key={i} style={{ color: 'var(--terracotta)', fontSize: '0.8rem' }}>Row {e.row}: {e.message}</p>
                  ))}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
