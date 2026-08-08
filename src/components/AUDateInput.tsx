'use client'

import { useState } from 'react'

// Chrome/Edge derive native <input type="date"/"datetime-local"> display
// format from the OS/browser locale, ignoring the page's `lang` attribute
// (unlike Firefox) — so on a US-locale machine they always show mm/dd/yyyy
// no matter what the document declares. To force dd/mm/yyyy everywhere
// regardless of the visitor's OS, we hide the native field's own text
// (color: transparent, which doesn't affect the separate calendar-icon
// pseudo-element) and draw our own dd/mm/yyyy label on top. Clicks still
// hit the real input beneath (the overlay has pointer-events: none), so
// the native picker still works.
function formatDMY(value: string): string {
  if (!value) return ''
  const [y, m, d] = value.split('-')
  if (!y || !m || !d) return ''
  return `${d}/${m}/${y}`
}

function formatDMYTime(value: string): string {
  if (!value) return ''
  const [datePart, timePart] = value.split('T')
  const dmy = formatDMY(datePart)
  if (!dmy || !timePart) return ''
  const [hStr, mStr] = timePart.split(':')
  let h = parseInt(hStr, 10)
  const suffix = h >= 12 ? 'PM' : 'AM'
  h = h % 12 || 12
  return `${dmy} ${String(h).padStart(2, '0')}:${mStr} ${suffix}`
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

function useOverlayInput(name: string | undefined, value: string | undefined, defaultValue: string | undefined, onChange: ((value: string) => void) | undefined) {
  const [uncontrolled, setUncontrolled] = useState(defaultValue || '')
  const current = name !== undefined ? uncontrolled : (value || '')
  const handleChange = (v: string) => (name !== undefined ? setUncontrolled(v) : onChange!(v))
  return { current, handleChange }
}

export function AUDateInput({ value, onChange, name, defaultValue, className, style, ariaLabel, min, max }: Props) {
  const { current, handleChange } = useOverlayInput(name, value, defaultValue, onChange)
  const display = formatDMY(current)

  return (
    <div style={{ position: 'relative', display: 'inline-block', width: style?.width }}>
      <input
        type="date"
        name={name}
        value={name !== undefined ? undefined : value}
        defaultValue={name !== undefined ? defaultValue : undefined}
        onChange={e => handleChange(e.target.value)}
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

// Same technique as AUDateInput, for type="datetime-local" fields.
export function AUDateTimeInput({ value, onChange, name, defaultValue, className, style, ariaLabel, min, max }: Props) {
  const { current, handleChange } = useOverlayInput(name, value, defaultValue, onChange)
  const display = formatDMYTime(current)

  return (
    <div style={{ position: 'relative', display: 'inline-block', width: style?.width }}>
      <input
        type="datetime-local"
        name={name}
        value={name !== undefined ? undefined : value}
        defaultValue={name !== undefined ? defaultValue : undefined}
        onChange={e => handleChange(e.target.value)}
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
          whiteSpace: 'nowrap',
        }}
      >
        {display || 'dd/mm/yyyy --:-- --'}
      </span>
    </div>
  )
}
