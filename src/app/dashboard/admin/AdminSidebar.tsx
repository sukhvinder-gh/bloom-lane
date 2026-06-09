'use client'
import { useState } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { isSuperAdminRole, roleLabel } from '@/lib/utils/permissions'

type Props = {
  role: string
  userName: string
  userEmail: string
  hasGrowerAccount: boolean
}

const NAV = [
  { href: '/dashboard/admin',          label: 'Overview',  icon: '◉',  exact: true },
  { href: '/dashboard/admin/farmers',  label: 'Growers',   icon: '🌿' },
  { href: '/dashboard/admin/buyers',   label: 'Buyers',    icon: '🛒' },
  { href: '/dashboard/admin/orders',   label: 'Orders',    icon: '📦' },
  { href: '/dashboard/admin/disputes', label: 'Disputes',  icon: '🛡' },
  { href: '/dashboard/admin/payouts',  label: 'Payouts',   icon: '💸' },
]

export default function AdminSidebar({ role, userName, userEmail, hasGrowerAccount }: Props) {
  const pathname   = usePathname()
  const [open, setOpen] = useState(false)
  const superAdmin = isSuperAdminRole(role)

  function isActive(href: string, exact?: boolean) {
    return exact ? pathname === href : pathname.startsWith(href)
  }

  const SidebarContent = () => (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>

      {/* Brand */}
      <div style={{ padding: '1.25rem 1rem 1rem', borderBottom: '1px solid var(--border-light)', flexShrink: 0 }}>
        <Link href="/dashboard/admin" style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', textDecoration: 'none' }} onClick={() => setOpen(false)}>
          <div style={{ width: '2.25rem', height: '2.25rem', borderRadius: '0.625rem', background: 'var(--green)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-display)', color: 'white', fontSize: '1.1rem', flexShrink: 0 }}>B</div>
          <div>
            <p style={{ fontFamily: 'var(--font-display)', fontSize: '0.95rem', color: 'var(--text-1)', fontWeight: 600, lineHeight: 1.1 }}>Bloom Lane</p>
            <p style={{ fontSize: '0.65rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-3)' }}>{roleLabel(role)}</p>
          </div>
        </Link>
      </div>

      {/* Nav items */}
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

        {/* Super admin only */}
        {superAdmin && (
          <Link
            href="/dashboard/admin/config"
            onClick={() => setOpen(false)}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.75rem',
              padding: '0.6rem 0.875rem', borderRadius: '10px',
              textDecoration: 'none', fontSize: '0.875rem',
              fontWeight: isActive('/dashboard/admin/config') ? 600 : 500,
              color: isActive('/dashboard/admin/config') ? 'var(--green)' : 'var(--text-2)',
              background: isActive('/dashboard/admin/config') ? 'var(--green-soft)' : 'transparent',
              transition: 'all 0.15s',
            }}
          >
            <span style={{ width: '1.25rem', textAlign: 'center', fontSize: '0.9rem', flexShrink: 0 }}>⚙</span>
            Config
            <span style={{ marginLeft: 'auto', fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', background: 'var(--amber-soft)', color: 'var(--amber-new)', padding: '0.1rem 0.4rem', borderRadius: '4px' }}>Super</span>
          </Link>
        )}

        {/* Grower account link for dual-role users */}
        {hasGrowerAccount && (
          <>
            <div style={{ height: '1px', background: 'var(--border-light)', margin: '0.625rem 0.25rem' }} />
            <Link
              href="/dashboard/farmer"
              onClick={() => setOpen(false)}
              style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.6rem 0.875rem', borderRadius: '10px', textDecoration: 'none', fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-2)', transition: 'all 0.15s' }}
            >
              <span style={{ width: '1.25rem', textAlign: 'center', fontSize: '0.9rem', flexShrink: 0 }}>🌾</span>
              My Grower Account
            </Link>
          </>
        )}
      </nav>

      {/* User section */}
      <div style={{ padding: '0.875rem', borderTop: '1px solid var(--border-light)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', padding: '0.75rem', borderRadius: '12px', background: 'var(--surface-2)' }}>
          <div style={{ width: '2rem', height: '2rem', borderRadius: '50%', background: 'var(--green)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '0.8rem', fontWeight: 700, flexShrink: 0 }}>
            {userName?.[0]?.toUpperCase() || 'A'}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{userName || 'Admin'}</p>
            <p style={{ fontSize: '0.68rem', color: 'var(--text-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{userEmail}</p>
          </div>
        </div>
        <Link href="/auth/logout" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 0.75rem', borderRadius: '8px', textDecoration: 'none', fontSize: '0.78rem', color: 'var(--text-3)', marginTop: '0.25rem' }}>
          ↗ Sign out
        </Link>
      </div>
    </div>
  )

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="desktop-sidebar" style={{ width: '232px', background: 'var(--surface)', borderRight: '1px solid var(--border-light)', height: '100vh', position: 'sticky', top: 0, flexShrink: 0, overflowY: 'auto' }}>
        <SidebarContent />
      </aside>

      {/* Mobile topbar */}
      <div className="mobile-topbar">
        <Link href="/dashboard/admin" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', textDecoration: 'none' }}>
          <div style={{ width: '1.75rem', height: '1.75rem', borderRadius: '0.4rem', background: 'var(--green)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '0.875rem' }}>B</div>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: '1rem', color: 'var(--text-1)', fontWeight: 600 }}>Bloom Lane</span>
        </Link>
        <button onClick={() => setOpen(!open)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.375rem', color: 'var(--text-2)', fontSize: '1.3rem', lineHeight: 1 }}>
          {open ? '✕' : '☰'}
        </button>
      </div>

      {/* Mobile drawer overlay */}
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
