import { getSessionUserFromCookie, createAdminClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import type { ReactNode } from 'react'

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const sessionUser = await getSessionUserFromCookie()
  if (!sessionUser) redirect('/auth/login')

  const admin = createAdminClient()
  const [profileResult, bgResult] = await Promise.all([
    admin.from('profiles').select('role, full_name').eq('id', sessionUser.id).single(),
    admin.from('config').select('value').eq('key', 'portal_background').maybeSingle(),
  ])

  const profile = profileResult.data
  const portalBg = bgResult.data?.value || ''

  if (!profile?.role) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: 'var(--bg)', fontFamily: 'var(--font-body)' }}>
        <div style={{ textAlign: 'center', padding: '2rem' }}>
          <h2 style={{ fontFamily: 'var(--font-display)', color: 'var(--navy)', fontSize: '1.8rem', marginBottom: '1rem' }}>Account Setup Incomplete</h2>
          <p style={{ color: 'var(--text-2)', marginBottom: '0.5rem' }}>Your account role hasn&apos;t been assigned yet.</p>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-3)', marginBottom: '2rem' }}>{sessionUser.email} · {sessionUser.id}</p>
          <a href="/auth/login" style={{ background: 'var(--navy)', color: 'white', padding: '0.75rem 2rem', borderRadius: '99px', textDecoration: 'none', fontWeight: 700 }}>Back to Login</a>
        </div>
      </div>
    )
  }

  return (
    <div style={{
      background: portalBg || 'var(--bg)',
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundAttachment: 'fixed',
      minHeight: '100vh',
    }}>
      {children}
    </div>
  )
}
