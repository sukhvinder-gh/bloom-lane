'use client'
import { useRef, useState } from 'react'

// Single-photo variant of ProductImageUpload — for one-off fields like a
// farm logo or banner/owner photo, where the value is one URL, not an array.
type Props = {
  url: string | null
  onChange: (url: string | null) => void
  label: string
  shape?: 'square' | 'wide'
  disabled?: boolean
}

export default function SingleImageUpload({ url, onChange, label, shape = 'square', disabled }: Props) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleFile(files: FileList | null) {
    const file = files?.[0]
    if (!file) return

    setUploading(true)
    setError('')
    const fd = new FormData()
    fd.append('file', file)
    try {
      const res = await fetch('/api/upload/product-image', { method: 'POST', body: fd })
      const json = await res.json()
      if (!res.ok) { setError(json.error || 'Upload failed') } else { onChange(json.url) }
    } catch {
      setError('Upload failed — check your connection')
    }
    setUploading(false)
    if (inputRef.current) inputRef.current.value = ''
  }

  const boxStyle: React.CSSProperties = shape === 'square'
    ? { width: '6rem', height: '6rem', borderRadius: '1rem' }
    : { width: '100%', height: '8rem', borderRadius: '0.75rem' }

  return (
    <div>
      <label style={{ display: 'block', fontWeight: 700, color: 'var(--forest)', fontSize: '0.875rem', marginBottom: '0.5rem' }}>{label}</label>
      <div style={{ display: 'flex', alignItems: shape === 'square' ? 'center' : 'flex-start', gap: '1rem', flexWrap: 'wrap' }}>
        <div style={{ ...boxStyle, position: 'relative', flexShrink: 0, overflow: 'hidden', background: 'var(--olive)', border: '1.5px dashed var(--sage)' }}>
          {url ? (
            <img src={url} alt={label} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
          ) : (
            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', opacity: 0.4 }}>🖼</div>
          )}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button type="button" onClick={() => inputRef.current?.click()} disabled={disabled || uploading} className="btn btn-outline btn-sm">
              {uploading ? 'Uploading…' : url ? 'Replace photo' : 'Upload photo'}
            </button>
            {url && !disabled && (
              <button type="button" onClick={() => onChange(null)} className="btn btn-ghost btn-sm" style={{ color: '#dc2626' }}>
                Remove
              </button>
            )}
          </div>
          <p style={{ fontSize: '0.72rem', color: 'var(--text-3)' }}>JPG/PNG · max 5 MB</p>
          {error && <p style={{ fontSize: '0.75rem', color: '#dc2626' }}>{error}</p>}
        </div>
      </div>
      <input ref={inputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => handleFile(e.target.files)} />
    </div>
  )
}
