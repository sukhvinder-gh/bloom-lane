'use client'
import { useState, useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import type { ReactNode } from 'react'
import { createClient } from '@/lib/supabase/client'

const NAV = [
  { href: '/dashboard/buyer',        label: 'Overview',    icon: '🏠',  exact: true },
  { href: '/dashboard/buyer/orders', label: 'My Orders',   icon: '📋' },
  { href: '/marketplace',            label: 'Marketplace', icon: '🛍️' },
  { href: '/growers',                label: 'Growers',     icon: '🌾' },
]

function BuyerSidebar() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  function isActive(href: string, exact?: boolean) {
    return exact ? pathname === href : pathname.startsWith(href)
  }

  const SidebarContent = () => (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ padding: '1.5rem 1.25rem 1.25rem', borderBottom: '1px solid var(--border-light)', flexShrink: 0 }}>
        <Link href="/dashboard/buyer" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', textDecoration: 'none' }} onClick={() => setOpen(false)}>
          <span style={{ fontSize: '1.5rem', lineHeight: 1, flexShrink: 0 }}>🌸</span>
          <div>
            <p style={{ fontFamily: 'var(--font-display)', fontSize: '0.95rem', color: 'var(--navy)', fontWeight: 700, lineHeight: 1.2 }}>The Green Guild</p>
            <p style={{ fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-3)', marginTop: '0.1rem' }}>Buyer Portal</p>
          </div>
        </Link>
      </div>

      <nav style={{ flex: 1, paddingTop: '0.625rem', paddingBottom: '0.625rem', display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
        {NAV.map(item => {
          const active = isActive(item.href, item.exact)
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className={`rf-nav-item${active ? ' active' : ''}`}
            >
              <span style={{ fontSize: '1rem', flexShrink: 0, opacity: active ? 1 : 0.65 }}>{item.icon}</span>
              {item.label}
            </Link>
          )
        })}
      </nav>

      <div style={{ padding: '1rem 1.25rem', borderTop: '1px solid var(--border-light)', flexShrink: 0 }}>
        <Link href="/auth/logout" className="rf-nav-item" style={{ padding: '0.375rem 0.75rem', fontSize: '0.75rem', color: 'var(--text-3)', borderLeft: 'none' }}>
          ↗ Sign out
        </Link>
      </div>
    </div>
  )

  return (
    <>
      <aside className="desktop-sidebar" style={{ width: '220px', background: 'var(--surface)', borderRight: '1px solid var(--border-light)', height: '100vh', position: 'sticky', top: 0, flexShrink: 0, overflowY: 'auto' }}>
        <SidebarContent />
      </aside>

      <div className="mobile-topbar">
        <Link href="/dashboard/buyer" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', textDecoration: 'none' }}>
          <span style={{ fontSize: '1.25rem' }}>🌸</span>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: '0.95rem', color: 'var(--navy)', fontWeight: 700 }}>The Green Guild</span>
        </Link>
        <button onClick={() => setOpen(!open)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.375rem', color: 'var(--text-2)', fontSize: '1.3rem', lineHeight: 1 }}>
          {open ? '✕' : '☰'}
        </button>
      </div>

      {open && (
        <div className="mobile-only" style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex' }}>
          <div onClick={() => setOpen(false)} style={{ flex: 1, background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(2px)' }} />
          <aside style={{ width: '240px', background: 'var(--surface)', height: '100%', overflowY: 'auto', animation: 'slideInLeft 0.2s ease', flexShrink: 0 }}>
            <SidebarContent />
          </aside>
        </div>
      )}
    </>
  )
}

export default function BuyerLayout({ children }: { children: ReactNode }) {
  const router = useRouter()
  useEffect(() => {
    let mounted = true
    const supabase = createClient()
    // getSession() reads from cookie locally (no extra network call) and refreshes
    // automatically if expired. getUser() always hits the network — unreliable on Azure.
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (mounted && !session) router.replace('/auth/login')
    })
    return () => { mounted = false }
  }, [router])

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg)' }}>
      <BuyerSidebar />
      <main style={{ flex: 1, minWidth: 0, overflow: 'auto' }}>
        {children}
      </main>
    </div>
  )
}
