'use client'
import { COLOR_PALETTE } from '@/lib/data/flowerSpecies'

export default function ColorTagPicker({ selected, onChange }: { selected: string[]; onChange: (ids: string[]) => void }) {
  function toggle(id: string) {
    onChange(selected.includes(id) ? selected.filter(c => c !== id) : [...selected, id])
  }

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.625rem' }}>
      {COLOR_PALETTE.map(c => {
        const active = selected.includes(c.id)
        return (
          <button
            key={c.id}
            type="button"
            onClick={() => toggle(c.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.5rem',
              padding: '0.4rem 0.75rem 0.4rem 0.4rem',
              borderRadius: '99px',
              border: active ? '1.5px solid var(--forest)' : '1.5px solid var(--olive)',
              background: active ? 'var(--olive)' : 'white',
              cursor: 'pointer',
              fontSize: '0.8rem',
              fontWeight: active ? 700 : 500,
              color: 'var(--forest)',
              fontFamily: 'var(--font-body)',
            }}
          >
            <span style={{
              width: '1.1rem', height: '1.1rem', borderRadius: '50%',
              background: c.swatch, border: '1px solid rgba(0,0,0,0.15)', flexShrink: 0,
            }} />
            {c.label}
          </button>
        )
      })}
    </div>
  )
}
