import { getSessionUserFromCookie } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import type { ReactNode } from 'react'
import { headers } from 'next/headers'

export default async function MarketplaceLayout({ children }: { children: ReactNode }) {
  const sessionUser = await getSessionUserFromCookie()
  if (!sessionUser) {
    // Preserve the original destination (e.g. ?farmer_id=X from a grower's
    // "Shop their products" link) so it survives the login round-trip
    // instead of dumping every logged-out visitor onto the generic dashboard.
    const h = await headers()
    const search = h.get('x-search') || ''
    redirect(`/auth/login?redirect=${encodeURIComponent(`/marketplace${search}`)}`)
  }
  return <>{children}</>
}
