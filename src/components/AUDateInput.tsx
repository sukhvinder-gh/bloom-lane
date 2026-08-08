'use client'

import { useState } from 'react'

// Chrome/Edge derive the native <input type="date"> display format from the
// OS/browser locale, ignoring the page's `lang` attribute (unlike Firefox) —
// so on a US-locale machine it always shows mm/dd/yyyy no matter what the
// document declares. To force dd/mm/yyyy everywhere regardless of the
// visitor's OS, we hide the native field's own text (color: transparent,
// which doesn't affect the separate calendar-icon pseudo-element) and draw
// our own dd/mm/yyyy label on top. Clicks still hit the real input beneath
// (the overlay has pointer-events: none), so the native picker still works.
function formatDMY(value: string): string {
  if (!value) return ''
  const [y, m, d] = value.split('-')
  if (!y || !m || !d) return ''
  return `${d}/${m}/${y}`
}

type Props = {
  className?: string
  style?: React.CSSProperties
  ariaLabel?: string
  min?: string
  max?: string
} & (
  | { value: string; onChange: (value: string) => void; name?: never; defaultValue?: never }
  // Uncontrolled — for plain <form> GET submission (name/defaultValue), where
  // no React state drives the value; we still need local state to keep the
  // overlay text in sync as the user picks a date.
  | { value?: never; onChange?: never; name: string; defaultValue?: string }
)

export function AUDateInput({ value, onChange, name, defaultValue, className, style, ariaLabel, min, max }: Props) {
  const [uncontrolled, setUncontrolled] = useState(defaultValue || '')
  const current = name !== undefined ? uncontrolled : (value || '')
  const display = formatDMY(current)

  return (
    <div style={{ position: 'relative', display: 'inline-block', width: style?.width }}>
      <input
        type="date"
        name={name}
        value={name !== undefined ? undefined : value}
        defaultValue={name !== undefined ? defaultValue : undefined}
        onChange={e => (name !== undefined ? setUncontrolled(e.target.value) : onChange!(e.target.value))}
        aria-label={ariaLabel}
        min={min}
        max={max}
        className={className}
        style={{ ...style, color: 'transparent' }}
      />
      <span
        aria-hidden="true"
        style={{
          position: 'absolute',
          left: '1rem',
          top: '50%',
          transform: 'translateY(-50%)',
          pointerEvents: 'none',
          fontSize: style?.fontSize,
          fontFamily: 'inherit',
          color: display ? 'var(--forest)' : 'var(--moss)',
        }}
      >
        {display || 'dd/mm/yyyy'}
      </span>
    </div>
  )
}
