// src/lib/utils/abn.ts
// Australian Business Number validation
// Uses ABR (Australian Business Register) API for live verification
// Falls back to format-only validation if API is unavailable

/**
 * Validate ABN format (11 digits, passes checksum)
 * Reference: https://abr.business.gov.au/Help/AbnFormat
 */
export function validateABNFormat(abn: string): boolean {
  // Strip spaces and non-digits
  const cleaned = abn.replace(/\D/g, '')

  if (cleaned.length !== 11) return false

  // ABN checksum algorithm
  const weights = [10, 1, 3, 5, 7, 9, 11, 13, 15, 17, 19]

  // Subtract 1 from first digit
  const digits = cleaned.split('').map(Number)
  digits[0] -= 1

  const sum = digits.reduce((total, digit, index) => total + digit * weights[index], 0)

  return sum % 89 === 0
}

/**
 * Format ABN for display: XX XXX XXX XXX
 */
export function formatABN(abn: string): string {
  const cleaned = abn.replace(/\D/g, '')
  if (cleaned.length !== 11) return abn
  return `${cleaned.slice(0, 2)} ${cleaned.slice(2, 5)} ${cleaned.slice(5, 8)} ${cleaned.slice(8, 11)}`
}

export interface ABRLookupResult {
  abn: string
  businessName: string
  entityType: string
  status: 'Active' | 'Cancelled' | 'Not found'
  gstRegistered: boolean
  postcode?: string
  state?: string
}

/**
 * Live ABN lookup via ABR API
 * Returns null if API unavailable (fallback: mark as pending)
 * 
 * NOTE: You need a free ABR GUID from: https://abr.business.gov.au/Tools/WebServices
 * Set NEXT_PUBLIC_ABR_GUID in .env
 */
export async function lookupABN(abn: string): Promise<ABRLookupResult | null> {
  const cleaned = abn.replace(/\D/g, '')
  const guid = process.env.ABR_GUID

  if (!guid) {
    console.warn('ABR_GUID not set — ABN verification will be format-only')
    return null
  }

  try {
    const url = `https://abr.business.gov.au/json/AbnDetails.aspx?abn=${cleaned}&callback=callback&guid=${guid}`

    const response = await fetch(url, {
      signal: AbortSignal.timeout(5000), // 5s timeout
    })

    if (!response.ok) throw new Error(`ABR API error: ${response.status}`)

    // ABR returns JSONP, strip callback wrapper
    const text = await response.text()
    const jsonStr = text.replace(/^callback\(/, '').replace(/\);?$/, '')
    const data = JSON.parse(jsonStr)

    if (!data.Abn || data.Message) {
      return {
        abn: cleaned,
        businessName: '',
        entityType: '',
        status: 'Not found',
        gstRegistered: false,
      }
    }

    return {
      abn: data.Abn,
      businessName: data.EntityName || data.MainName?.OrganisationName || '',
      entityType: data.EntityTypeName || '',
      status: data.AbnStatus === 'Active' ? 'Active' : 'Cancelled',
      gstRegistered: !!data.Gst,
      postcode: data.AddressPostcode,
      state: data.AddressState,
    }
  } catch (error) {
    console.error('ABR API unavailable:', error)
    return null // triggers pending fallback
  }
}

/**
 * Full ABN verification flow:
 * 1. Validate format
 * 2. Try live ABR lookup
 * 3. If API down → mark as 'pending' (don't block signup)
 */
export async function verifyABN(abn: string): Promise<{
  isValid: boolean
  status: 'verified' | 'pending' | 'failed'
  businessName?: string
  gstRegistered?: boolean
  error?: string
}> {
  if (!validateABNFormat(abn)) {
    return { isValid: false, status: 'failed', error: 'Invalid ABN format' }
  }

  const result = await lookupABN(abn)

  // API unavailable → allow signup but mark pending
  if (result === null) {
    return {
      isValid: true,
      status: 'pending',
      error: 'ABN queued for verification — you can proceed',
    }
  }

  if (result.status === 'Not found') {
    return { isValid: false, status: 'failed', error: 'ABN not found in ABR' }
  }

  if (result.status === 'Cancelled') {
    return { isValid: false, status: 'failed', error: 'ABN is cancelled' }
  }

  return {
    isValid: true,
    status: 'verified',
    businessName: result.businessName,
    gstRegistered: result.gstRegistered,
  }
}
