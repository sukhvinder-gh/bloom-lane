'use client'
import { useState, useRef, useCallback } from 'react'
import Link from 'next/link'

const CATEGORIES: Record<string, string> = {
  flowers_cut: 'Cut Flowers', flowers_dried: 'Dried Flowers', flowers_native: 'Australian Natives', foliage: 'Foliage',
  vegetables: 'Vegetables', herbs: 'Herbs', fruit: 'Fruit', eggs: 'Eggs', honey: 'Honey', other: 'Other',
}
const VALID_CATEGORIES = Object.keys(CATEGORIES)

const TEMPLATE_CSV = `name,category,unit,wholesale_price,stock,min_order,gst_free,description
Mixed Roses,flowers_cut,stem,4.50,100,10,no,Beautiful mixed roses from our garden
Sunflowers,flowers_cut,stem,3.20,80,5,no,
Baby's Breath,foliage,bunch,6.00,40,1,yes,
Fresh Basil,herbs,bunch,4.00,60,3,no,Aromatic sweet basil
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
  name: string; category: string; unit: string; wholesale_price: string
  stock: string; min_order: string; gst_free: string; description: string
  _errors: string[]
}

function validateRows(rows: string[][]): ParsedRow[] {
  const [header, ...data] = rows
  const col = (name: string) => header.findIndex(h => h.toLowerCase().trim() === name)
  const ci = { name: col('name'), category: col('category'), unit: col('unit'), wholesale_price: col('wholesale_price'), stock: col('stock'), min_order: col('min_order'), gst_free: col('gst_free'), description: col('description') }

  return data.filter(r => r.some(c => c.trim())).map(r => {
    const get = (idx: number) => idx >= 0 ? (r[idx] || '') : ''
    const errors: string[] = []
    const name = get(ci.name)
    const category = get(ci.category).toLowerCase()
    const unit = get(ci.unit)
    const wholesale_price = get(ci.wholesale_price)
    const stock = get(ci.stock) || '0'
    const min_order = get(ci.min_order) || '1'
    const gst_free = get(ci.gst_free)
    const description = get(ci.description)

    if (!name.trim()) errors.push('Name required')
    if (!VALID_CATEGORIES.includes(category)) errors.push(`Invalid category "${category}"`)
    if (!unit.trim()) errors.push('Unit required')
    if (isNaN(Number(wholesale_price)) || Number(wholesale_price) <= 0) errors.push('Price must be > 0')
    if (isNaN(Number(stock)) || Number(stock) < 0) errors.push('Stock must be ≥ 0')

    return { name, category, unit, wholesale_price, stock, min_order, gst_free, description, _errors: errors }
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
        stock_total: parseInt(r.stock) || 0,
        min_order_b2b: parseInt(r.min_order) || 1,
        is_gst_free: ['yes', 'true', '1'].includes(r.gst_free.toLowerCase()),
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

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '1.5rem', alignItems: 'start' }}>
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
              Optional: stock, min_order, gst_free (yes/no), description
            </p>
            <p style={{ fontSize: '0.75rem', color: 'var(--moss)', marginTop: '0.5rem', lineHeight: 1.6 }}>
              Categories: {VALID_CATEGORIES.join(', ')}
            </p>
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
                onChange={e => { const f = e.target.files?.[0]; if (f) processFile(f) }}
              />
            </div>
          </div>

          {/* Preview table */}
          {rows && rows.length > 0 && (
            <div className="card" style={{ overflow: 'hidden' }}>
              <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--sage)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <p style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--forest)' }}>
                  {rows.length} row{rows.length !== 1 ? 's' : ''} parsed
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
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                  <thead>
                    <tr style={{ background: 'var(--olive)', borderBottom: '1px solid var(--sage)' }}>
                      {['Name', 'Category', 'Unit', 'Price', 'Stock', 'GST Free', 'Errors'].map(h => (
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
                        <td style={{ padding: '0.625rem 0.875rem', color: 'var(--moss)' }}>{r.stock}</td>
                        <td style={{ padding: '0.625rem 0.875rem', color: 'var(--moss)' }}>{r.gst_free || 'no'}</td>
                        <td style={{ padding: '0.625rem 0.875rem', color: 'var(--terracotta)', fontSize: '0.75rem' }}>
                          {r._errors.length > 0 ? r._errors.join(', ') : <span style={{ color: 'var(--green)' }}>✓</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
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
