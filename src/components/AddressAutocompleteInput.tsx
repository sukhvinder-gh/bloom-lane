'use client'
import { useEffect, useRef } from 'react'

export type AUAddressResult = {
  address: string
  suburb: string
  state: string
  postcode: string
}

type Props = {
  id?: string
  className?: string
  style?: React.CSSProperties
  placeholder?: string
  required?: boolean
  maxLength?: number
  value: string
  onChange: (value: string) => void
  onSelect: (result: AUAddressResult) => void
}

// Google's Maps JS SDK is a singleton per page — only ever inject the
// <script> tag once, and have every later mount of this component just wait
// on the same load, instead of re-requesting it per input.
let loadPromise: Promise<void> | null = null

function loadGoogleMaps(apiKey: string): Promise<void> {
  if ((window as any).google?.maps?.places) return Promise.resolve()
  if (loadPromise) return loadPromise
  loadPromise = new Promise((resolve, reject) => {
    const existing = document.getElementById('gmaps-script') as HTMLScriptElement | null
    if (existing) {
      existing.addEventListener('load', () => resolve())
      existing.addEventListener('error', () => reject(new Error('Failed to load Google Maps')))
      return
    }
    const script = document.createElement('script')
    script.id = 'gmaps-script'
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&loading=async`
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Failed to load Google Maps'))
    document.head.appendChild(script)
  })
  return loadPromise
}

// A plain street-address input that becomes a Google Places Autocomplete
// field once NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is configured — without it, it
// silently stays a normal text input so forms using this still work.
export default function AddressAutocompleteInput({ id, className, style, placeholder, required, maxLength, value, onChange, onSelect }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const onChangeRef = useRef(onChange)
  const onSelectRef = useRef(onSelect)
  onChangeRef.current = onChange
  onSelectRef.current = onSelect

  useEffect(() => {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
    const input = inputRef.current
    if (!apiKey || !input) return
    let cancelled = false
    let autocomplete: any = null

    loadGoogleMaps(apiKey).then(() => {
      if (cancelled || !input || !(window as any).google?.maps?.places) return
      const places = (window as any).google.maps.places
      autocomplete = new places.Autocomplete(input, {
        componentRestrictions: { country: 'au' },
        fields: ['address_components', 'formatted_address'],
        types: ['address'],
      })
      autocomplete.addListener('place_changed', () => {
        const place = autocomplete.getPlace()
        const components: Array<{ types: string[]; long_name: string; short_name: string }> = place.address_components || []
        const part = (type: string, useShort = false) => {
          const c = components.find(c => c.types.includes(type))
          return c ? (useShort ? c.short_name : c.long_name) : ''
        }
        const streetAddress = [part('street_number'), part('route')].filter(Boolean).join(' ')
        const suburb = part('locality') || part('sublocality') || part('postal_town')
        const state = part('administrative_area_level_1', true)
        const postcode = part('postal_code')

        onChangeRef.current(streetAddress || place.formatted_address || '')
        onSelectRef.current({ address: streetAddress || place.formatted_address || '', suburb, state, postcode })
      })
    }).catch(() => {
      // No autocomplete this session (key missing/blocked/offline) — the
      // input just behaves as plain free text, which is still a valid form.
    })

    return () => {
      cancelled = true
      if (autocomplete) (window as any).google?.maps?.event?.clearInstanceListeners(autocomplete)
    }
  }, [])

  return (
    <input
      ref={inputRef}
      id={id}
      className={className}
      style={style}
      placeholder={placeholder}
      required={required}
      maxLength={maxLength}
      autoComplete="off"
      value={value}
      onChange={e => onChange(e.target.value)}
    />
  )
}
