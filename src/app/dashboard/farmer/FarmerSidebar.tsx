'use client'
import { useState } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { isAdminRole } from '@/lib/utils/permissions'

type Props = {
  role: string
  userName: string
  userEmail: string
  businessName: string
  farmerId: string | null
  farmerStatus: string | null
}

const NAV = [
  { href: '/dashboard/farmer',             label: 'Overview',    icon: '◉',  exact: true },
  { href: '/dashboard/farmer/inventory',   label: 'Inventory',   icon: '📋' },
  { href: '/dashboard/farmer/orders',      label: 'Orders',      icon: '📦' },
  { href: '/dashboard/farmer/storefront',  label: 'My Storefront', icon: '🏪' },
  { href: '/dashboard/farmer/payouts',     label: 'Payouts',     icon: '💰' },
]

export default function FarmerSidebar({ role, userName, userEmail, businessName, farmerId, farmerStatus }: Props) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const isAdmin = isAdminRole(role)

  function isActive(href: string, exact?: boolean) {
    return exact ? pathname === href : pathname.startsWith(href)
  }

  const SidebarContent = () => (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>

      {/* Brand */}
      <div style={{ padding: '1.25rem 1rem 1rem', borderBottom: '1px solid var(--border-light)', flexShrink: 0 }}>
        <Link href="/dashboard/farmer" style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', textDecoration: 'none' }} onClick={() => setOpen(false)}>
          <div style={{ width: '2.25rem', height: '2.25rem', borderRadius: '0.625rem', background: 'var(--green)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-display)', color: 'white', fontSize: '1.1rem', flexShrink: 0 }}>B</div>
          <div>
            <p style={{ fontFamily: 'var(--font-display)', fontSize: '0.95rem', color: 'var(--text-1)', fontWeight: 600, lineHeight: 1.1 }}>Bloom Lane</p>
            <p style={{ fontSize: '0.65rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-3)' }}>Grower Portal</p>
          </div>
        </Link>

        {/* Farm status badge */}
        {farmerStatus && (
          <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border-light)' }}>
            <p style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-1)', marginBottom: '0.25rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{businessName || userName}</p>
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
              padding: '0.15rem 0.625rem', borderRadius: '99px', fontSize: '0.65rem', fontWeight: 700,
              background: farmerStatus === 'approved' ? 'var(--green-soft)' : farmerStatus === 'suspended' ? 'var(--terra-soft)' : 'var(--amber-soft)',
              color: farmerStatus === 'approved' ? 'var(--green)' : farmerStatus === 'suspended' ? 'var(--terracotta)' : 'var(--amber-new)',
            }}>
              {farmerStatus === 'approved' ? '✓ Approved' : farmerStatus === 'suspended' ? '✕ Suspended' : '⏳ Pending'}
            </span>
          </div>
        )}
      </div>

      {/* Nav */}
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

        {/* View public profile */}
        {farmerId && farmerStatus === 'approved' && (
          <>
            <div style={{ height: '1px', background: 'var(--border-light)', margin: '0.625rem 0.25rem' }} />
            <Link
              href={`/growers/${farmerId}`}
              target="_blank"
              onClick={() => setOpen(false)}
              style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.6rem 0.875rem', borderRadius: '10px', textDecoration: 'none', fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-2)', transition: 'all 0.15s' }}
            >
              <span style={{ width: '1.25rem', textAlign: 'center', fontSize: '0.9rem', flexShrink: 0 }}>👁</span>
              Public Profile ↗
            </Link>
          </>
        )}

        {/* Back to admin for dual-role users */}
        {isAdmin && (
          <>
            <div style={{ height: '1px', background: 'var(--border-light)', margin: '0.625rem 0.25rem' }} />
            <Link
              href="/dashboard/admin"
              onClick={() => setOpen(false)}
              style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.6rem 0.875rem', borderRadius: '10px', textDecoration: 'none', fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-2)', transition: 'all 0.15s' }}
            >
              <span style={{ width: '1.25rem', textAlign: 'center', fontSize: '0.9rem', flexShrink: 0 }}>🛡</span>
              Admin Portal
            </Link>
          </>
        )}
      </nav>

      {/* User section */}
      <div style={{ padding: '0.875rem', borderTop: '1px solid var(--border-light)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', padding: '0.75rem', borderRadius: '12px', background: 'var(--surface-2)' }}>
          <div style={{ width: '2rem', height: '2rem', borderRadius: '50%', background: 'var(--green)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '0.8rem', fontWeight: 700, flexShrink: 0 }}>
            {userName?.[0]?.toUpperCase() || 'G'}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{userName}</p>
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
        <Link href="/dashboard/farmer" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', textDecoration: 'none' }}>
          <div style={{ width: '1.75rem', height: '1.75rem', borderRadius: '0.4rem', background: 'var(--green)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '0.875rem' }}>B</div>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: '1rem', color: 'var(--text-1)', fontWeight: 600 }}>{businessName || 'Grower'}</span>
        </Link>
        <button onClick={() => setOpen(!open)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.375rem', color: 'var(--text-2)', fontSize: '1.3rem', lineHeight: 1 }}>
          {open ? '✕' : '☰'}
        </button>
      </div>

      {/* Mobile drawer */}
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
