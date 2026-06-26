import { getSessionUserFromCookie } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import type { ReactNode } from 'react'

export default async function MarketplaceLayout({ children }: { children: ReactNode }) {
  const sessionUser = await getSessionUserFromCookie()
  if (!sessionUser) redirect('/auth/login')
  return <>{children}</>
}
