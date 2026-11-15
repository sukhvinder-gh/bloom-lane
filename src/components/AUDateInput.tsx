'use client'

import { useState, useRef, useEffect } from 'react'

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

// A native date/datetime-local input's own `.value` is "" until every
// subfield (day, month, year, and for datetime-local, hour+minute) is
// filled — so a controlled `value={value}` re-render mid-edit (the instant
// between finishing the date and starting the time) forces the DOM value
// back to that interim "", wiping what was just typed. Driving the input as
// `defaultValue` and only imperatively syncing `ref.current.value` when
// `value` changes for a reason OTHER than this same input's own onChange
// (guarded by the ref already matching) avoids that reset entirely.
function useExternalValueSync(ref: React.RefObject<HTMLInputElement | null>, value: string | undefined, isControlled: boolean) {
  useEffect(() => {
    if (!isControlled || !ref.current) return
    const next = value || ''
    if (ref.current.value !== next) ref.current.value = next
  }, [ref, value, isControlled])
}

export function AUDateInput({ value, onChange, name, defaultValue, className, style, ariaLabel, min, max }: Props) {
  const { current, handleChange } = useOverlayInput(name, value, defaultValue, onChange)
  const display = formatDMY(current)
  const isControlled = name === undefined
  const inputRef = useRef<HTMLInputElement>(null)
  useExternalValueSync(inputRef, value, isControlled)

  return (
    <div style={{ position: 'relative', display: 'inline-block', width: style?.width }}>
      <input
        ref={inputRef}
        type="date"
        name={name}
        defaultValue={isControlled ? value : defaultValue}
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
  const isControlled = name === undefined
  const inputRef = useRef<HTMLInputElement>(null)
  useExternalValueSync(inputRef, value, isControlled)

  return (
    <div style={{ position: 'relative', display: 'inline-block', width: style?.width }}>
      <input
        ref={inputRef}
        type="datetime-local"
        name={name}
        defaultValue={isControlled ? value : defaultValue}
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
