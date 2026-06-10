'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import SignOutButton from './SignOutButton'

type NavLink = { href: string; label: string; icon: string }

export default function MobileHeader({
  links,
  userName,
  roleLabel,
  roleStyle,
}: {
  links: NavLink[]
  userName: string | null
  roleLabel: string
  roleStyle: React.CSSProperties
}) {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()

  useEffect(() => { setOpen(false) }, [pathname])

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  function isActive(href: string) {
    if (href === '/dashboard') return pathname === '/dashboard'
    return pathname === href || pathname.startsWith(href + '/')
  }

  return (
    <>
      {/* Top bar — shown on mobile only via CSS */}
      <header className="mobile-topbar">
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', textDecoration: 'none' }}>
          <div style={{ width: '1.75rem', height: '1.75rem', borderRadius: '0.375rem', background: 'var(--navy)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-display)', color: 'white', fontSize: '0.875rem' }}>B</div>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: '1rem', color: 'var(--navy)', fontWeight: 600 }}>The Green Guild</span>
        </Link>
        <button
          onClick={() => setOpen(true)}
          aria-label="Open menu"
          style={{ width: '2.25rem', height: '2.25rem', border: '1.5px solid var(--border)', borderRadius: '8px', background: 'white', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '3px', flexShrink: 0 }}
        >
          <span style={{ width: '14px', height: '1.5px', background: 'var(--navy)', borderRadius: '2px', display: 'block' }} />
          <span style={{ width: '14px', height: '1.5px', background: 'var(--navy)', borderRadius: '2px', display: 'block' }} />
          <span style={{ width: '14px', height: '1.5px', background: 'var(--navy)', borderRadius: '2px', display: 'block' }} />
        </button>
      </header>

      {/* Backdrop */}
      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(30,37,53,0.45)', zIndex: 200, backdropFilter: 'blur(3px)' }}
        >
          {/* Drawer */}
          <nav
            onClick={e => e.stopPropagation()}
            style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 'min(17rem, 82vw)', background: 'white', display: 'flex', flexDirection: 'column', boxShadow: '4px 0 32px rgba(30,37,53,0.18)', animation: 'slideInLeft 0.22s ease' }}
          >
            {/* User info */}
            <div style={{ padding: '1.25rem', borderBottom: '1px solid var(--border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <p style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--navy)', marginBottom: '0.3rem' }}>{userName || '—'}</p>
                <span className="badge" style={roleStyle}>{roleLabel}</span>
              </div>
              <button
                onClick={() => setOpen(false)}
                style={{ width: '2rem', height: '2rem', border: '1px solid var(--border-light)', borderRadius: '8px', background: 'var(--offwhite)', cursor: 'pointer', fontSize: '0.875rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >✕</button>
            </div>

            {/* Nav links */}
            <div style={{ flex: 1, padding: '0.75rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
              {links.map(link => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`nav-item${isActive(link.href) ? ' active' : ''}`}
                >
                  <span style={{ width: '1.25rem', textAlign: 'center', fontSize: '0.9rem' }}>{link.icon}</span>
                  {link.label}
                </Link>
              ))}
              <Link href="/marketplace" className={`nav-item${pathname === '/marketplace' ? ' active' : ''}`}>
                <span style={{ width: '1.25rem', textAlign: 'center' }}>🌿</span>
                Marketplace
              </Link>
            </div>

            {/* Sign out */}
            <div style={{ padding: '0.75rem', borderTop: '1px solid var(--border-light)' }}>
              <SignOutButton />
            </div>
          </nav>
        </div>
      )}
    </>
  )
}
