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
  { href: '/dashboard/admin',          label: 'Overview',  icon: '🏠',  exact: true },
  { href: '/dashboard/admin/farmers',  label: 'Growers',   icon: '🌾' },
  { href: '/dashboard/admin/buyers',   label: 'Buyers',    icon: '👥' },
  { href: '/dashboard/admin/orders',   label: 'Orders',    icon: '📋' },
  { href: '/dashboard/admin/hubs',     label: 'Hubs',      icon: '🏛' },
  { href: '/dashboard/admin/disputes', label: 'Disputes',  icon: '⚖️' },
  { href: '/dashboard/admin/payouts',    label: 'Payouts',    icon: '💳' },
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
      <div style={{ padding: '1.5rem 1.25rem 1.25rem', borderBottom: '1px solid var(--border-light)', flexShrink: 0 }}>
        <Link href="/dashboard/admin" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', textDecoration: 'none' }} onClick={() => setOpen(false)}>
          <span style={{ fontSize: '1.5rem', lineHeight: 1, flexShrink: 0 }}>🌸</span>
          <div>
            <p style={{ fontFamily: 'var(--font-display)', fontSize: '0.95rem', color: 'var(--navy)', fontWeight: 700, lineHeight: 1.2 }}>The Green Guild</p>
            <p style={{ fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-3)', marginTop: '0.1rem' }}>{roleLabel(role)}</p>
          </div>
        </Link>
      </div>

      {/* Nav items */}
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

        {/* Super admin only */}
        {superAdmin && (
          <Link
            href="/dashboard/admin/config"
            onClick={() => setOpen(false)}
            className={`rf-nav-item${isActive('/dashboard/admin/config') ? ' active' : ''}`}
          >
            <span style={{ fontSize: '1rem', flexShrink: 0, opacity: isActive('/dashboard/admin/config') ? 1 : 0.65 }}>⚙️</span>
            Config
            <span style={{ marginLeft: 'auto', fontSize: '0.58rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', background: 'var(--amber-soft)', color: 'var(--amber-new)', padding: '0.15rem 0.45rem', borderRadius: '4px' }}>Super</span>
          </Link>
        )}

        {/* Grower account link for dual-role users */}
        {hasGrowerAccount && (
          <>
            <div style={{ height: '1px', background: 'var(--border-light)', margin: '0.5rem 1.25rem' }} />
            <Link
              href="/dashboard/farmer"
              onClick={() => setOpen(false)}
              className="rf-nav-item"
            >
              <span style={{ fontSize: '1rem', flexShrink: 0, opacity: 0.65 }}>🌱</span>
              My Grower Account
            </Link>
          </>
        )}
      </nav>

      {/* User section */}
      <div style={{ padding: '1rem 1.25rem', borderTop: '1px solid var(--border-light)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', marginBottom: '0.5rem' }}>
          <div style={{ width: '1.875rem', height: '1.875rem', borderRadius: '50%', background: 'var(--bloom)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '0.75rem', fontWeight: 700, flexShrink: 0 }}>
            {userName?.[0]?.toUpperCase() || 'A'}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{userName || 'Admin'}</p>
            <p style={{ fontSize: '0.68rem', color: 'var(--text-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{userEmail}</p>
          </div>
        </div>
        <button
          onClick={() => fetch('/api/auth/signout', { method: 'POST' }).then(() => { window.location.href = '/auth/login' })}
          className="rf-nav-item"
          style={{ padding: '0.375rem 0.75rem', fontSize: '0.75rem', color: 'var(--text-3)', borderLeft: 'none', background: 'none', border: 'none', cursor: 'pointer', width: '100%', textAlign: 'left' }}
        >
          ↗ Sign out
        </button>
      </div>
    </div>
  )

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="desktop-sidebar" style={{ width: '220px', background: 'var(--surface)', borderRight: '1px solid var(--border-light)', height: '100vh', position: 'sticky', top: 0, flexShrink: 0, overflowY: 'auto' }}>
        <SidebarContent />
      </aside>

      {/* Mobile topbar */}
      <div className="mobile-topbar">
        <Link href="/dashboard/admin" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', textDecoration: 'none' }}>
          <span style={{ fontSize: '1.25rem' }}>🌸</span>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: '0.95rem', color: 'var(--navy)', fontWeight: 700 }}>The Green Guild</span>
        </Link>
        <button onClick={() => setOpen(!open)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.375rem', color: 'var(--text-2)', fontSize: '1.3rem', lineHeight: 1 }}>
          {open ? '✕' : '☰'}
        </button>
      </div>

      {/* Mobile drawer */}
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
