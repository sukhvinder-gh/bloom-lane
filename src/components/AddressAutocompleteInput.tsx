'use client'
import { useEffect, useRef, useState } from 'react'

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

type AddressComponent = { longText?: string; shortText?: string; types: string[] }

// Place Autocomplete (New) returns address components with the same type
// strings as the legacy Geocoding API (street_number, route, locality,
// administrative_area_level_1, postal_code), just with longText/shortText
// instead of long_name/short_name.
function partsFromComponents(components: AddressComponent[]): AUAddressResult {
  const part = (type: string, useShort = false) => {
    const c = components.find(c => c.types.includes(type))
    return c ? (useShort ? c.shortText : c.longText) || '' : ''
  }
  return {
    address: [part('street_number'), part('route')].filter(Boolean).join(' '),
    suburb: part('locality') || part('sublocality') || part('postal_town'),
    state: part('administrative_area_level_1', true),
    postcode: part('postal_code'),
  }
}

// A plain street-address input that becomes Google's Place Autocomplete (New)
// widget once NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is configured and "Places API
// (New)" is enabled/billed on that key's project — without either, it just
// stays a normal text input so forms using this still work.
export default function AddressAutocompleteInput({ id, className, style, placeholder, required, maxLength, value, onChange, onSelect }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const onChangeRef = useRef(onChange)
  const onSelectRef = useRef(onSelect)
  const [widgetReady, setWidgetReady] = useState(false)
  onChangeRef.current = onChange
  onSelectRef.current = onSelect

  useEffect(() => {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
    const container = containerRef.current
    if (!apiKey || !container) return
    let cancelled = false
    let el: any = null

    loadGoogleMaps(apiKey).then(() => {
      if (cancelled || !container) return
      const places = (window as any).google?.maps?.places
      if (!places?.PlaceAutocompleteElement) return
      el = new places.PlaceAutocompleteElement({ includedRegionCodes: ['au'], placeholder })
      el.style.width = '100%'
      container.appendChild(el)
      el.addEventListener('gmp-select', async (event: any) => {
        try {
          const place = event.placePrediction.toPlace()
          await place.fetchFields({ fields: ['addressComponents', 'formattedAddress'] })
          const parsed = partsFromComponents(place.addressComponents || [])
          const address = parsed.address || place.formattedAddress || ''
          onChangeRef.current(address)
          onSelectRef.current({ ...parsed, address })
        } catch {
          // Selection didn't resolve to a usable address — leave the field as-is.
        }
      })
      setWidgetReady(true)
    }).catch(() => {
      // No autocomplete this session (key missing/blocked/not enabled yet) —
      // the plain input below just stays a normal text field.
    })

    return () => {
      cancelled = true
      el?.remove()
    }
  }, [])

  return (
    <div ref={containerRef}>
      {!widgetReady && (
        <input
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
      )}
    </div>
  )
}
