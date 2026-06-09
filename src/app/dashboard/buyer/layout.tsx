'use client'
import { useState } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import type { ReactNode } from 'react'

const NAV = [
  { href: '/dashboard/buyer',        label: 'Overview',    icon: '◉', exact: true },
  { href: '/dashboard/buyer/orders', label: 'My Orders',   icon: '📦' },
  { href: '/marketplace',            label: 'Marketplace', icon: '🛒' },
  { href: '/growers',                label: 'Growers',     icon: '🌿' },
]

function BuyerSidebar() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  function isActive(href: string, exact?: boolean) {
    return exact ? pathname === href : pathname.startsWith(href)
  }

  const SidebarContent = () => (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ padding: '1.25rem 1rem 1rem', borderBottom: '1px solid var(--border-light)', flexShrink: 0 }}>
        <Link href="/dashboard/buyer" style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', textDecoration: 'none' }} onClick={() => setOpen(false)}>
          <div style={{ width: '2.25rem', height: '2.25rem', borderRadius: '0.625rem', background: 'var(--green)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '1.1rem', flexShrink: 0 }}>B</div>
          <div>
            <p style={{ fontFamily: 'var(--font-display)', fontSize: '0.95rem', color: 'var(--text-1)', fontWeight: 600, lineHeight: 1.1 }}>Bloom Lane</p>
            <p style={{ fontSize: '0.65rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-3)' }}>Buyer Portal</p>
          </div>
        </Link>
      </div>

      <nav style={{ flex: 1, padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.1rem', overflowY: 'auto' }}>
        {NAV.map(item => {
          const active = isActive(item.href, item.exact)
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.75rem',
                padding: '0.6rem 0.875rem', borderRadius: '10px',
                textDecoration: 'none', fontSize: '0.875rem',
                fontWeight: active ? 600 : 500,
                color: active ? 'var(--green)' : 'var(--text-2)',
                background: active ? 'var(--green-soft)' : 'transparent',
                transition: 'all 0.15s',
              }}
            >
              <span style={{ width: '1.25rem', textAlign: 'center', fontSize: '0.9rem', flexShrink: 0 }}>{item.icon}</span>
              {item.label}
            </Link>
          )
        })}
      </nav>

      <div style={{ padding: '0.875rem', borderTop: '1px solid var(--border-light)', flexShrink: 0 }}>
        <Link href="/auth/logout" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 0.75rem', borderRadius: '8px', textDecoration: 'none', fontSize: '0.78rem', color: 'var(--text-3)' }}>
          ↗ Sign out
        </Link>
      </div>
    </div>
  )

  return (
    <>
      <aside className="desktop-sidebar" style={{ width: '232px', background: 'var(--surface)', borderRight: '1px solid var(--border-light)', height: '100vh', position: 'sticky', top: 0, flexShrink: 0, overflowY: 'auto' }}>
        <SidebarContent />
      </aside>

      <div className="mobile-topbar">
        <Link href="/dashboard/buyer" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', textDecoration: 'none' }}>
          <div style={{ width: '1.75rem', height: '1.75rem', borderRadius: '0.4rem', background: 'var(--green)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '0.875rem' }}>B</div>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: '1rem', color: 'var(--text-1)', fontWeight: 600 }}>Bloom Lane</span>
        </Link>
        <button onClick={() => setOpen(!open)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.375rem', color: 'var(--text-2)', fontSize: '1.3rem', lineHeight: 1 }}>
          {open ? '✕' : '☰'}
        </button>
      </div>

      {open && (
        <div className="mobile-only" style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex' }}>
          <div onClick={() => setOpen(false)} style={{ flex: 1, background: 'rgba(26,46,31,0.45)', backdropFilter: 'blur(2px)' }} />
          <aside style={{ width: '240px', background: 'var(--surface)', height: '100%', overflowY: 'auto', animation: 'slideInLeft 0.2s ease', flexShrink: 0 }}>
            <SidebarContent />
          </aside>
        </div>
      )}
    </>
  )
}

export default function BuyerLayout({ children }: { children: ReactNode }) {
  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg)' }}>
      <BuyerSidebar />
      <main style={{ flex: 1, minWidth: 0, overflow: 'auto' }}>
        {children}
      </main>
    </div>
  )
}
