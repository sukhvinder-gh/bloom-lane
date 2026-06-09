'use client'
import { useRef, useState } from 'react'

type Props = {
  urls: string[]
  onChange: (urls: string[]) => void
  maxImages?: number
  disabled?: boolean
}

export default function ProductImageUpload({ urls, onChange, maxImages = 5, disabled }: Props) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return
    const remaining = maxImages - urls.length
    const toUpload = Array.from(files).slice(0, remaining)

    setUploading(true)
    setError('')

    const uploaded: string[] = []
    for (const file of toUpload) {
      const fd = new FormData()
      fd.append('file', file)
      try {
        const res = await fetch('/api/upload/product-image', { method: 'POST', body: fd })
        const json = await res.json()
        if (!res.ok) { setError(json.error || 'Upload failed'); break }
        uploaded.push(json.url)
      } catch {
        setError('Upload failed — check your connection')
        break
      }
    }

    if (uploaded.length > 0) onChange([...urls, ...uploaded])
    setUploading(false)
    if (inputRef.current) inputRef.current.value = ''
  }

  function remove(idx: number) {
    onChange(urls.filter((_, i) => i !== idx))
  }

  const canAdd = urls.length < maxImages && !disabled

  return (
    <div>
      <div className="img-grid">
        {urls.map((url, i) => (
          <div key={url} className="img-tile">
            <img src={url} alt={`Product photo ${i + 1}`} />
            {!disabled && (
              <button type="button" className="img-tile-del" onClick={() => remove(i)} title="Remove photo">✕</button>
            )}
          </div>
        ))}
        {canAdd && (
          <button
            type="button"
            className="img-add-btn"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? (
              <span style={{ fontSize: '0.7rem', color: 'var(--text-3)' }}>Uploading…</span>
            ) : (
              <>
                <span style={{ fontSize: '1.5rem', color: 'var(--text-3)', lineHeight: 1 }}>+</span>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-3)', marginTop: '0.25rem' }}>Add photo</span>
              </>
            )}
          </button>
        )}
      </div>

      {error && (
        <p style={{ fontSize: '0.78rem', color: 'var(--terracotta)', marginTop: '0.5rem' }}>{error}</p>
      )}
      <p style={{ fontSize: '0.72rem', color: 'var(--text-3)', marginTop: '0.375rem' }}>
        Up to {maxImages} photos · JPG/PNG · max 5 MB each
      </p>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        style={{ display: 'none' }}
        onChange={e => handleFiles(e.target.files)}
      />
    </div>
  )
}
