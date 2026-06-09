import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import type { ReactNode } from 'react'
import SignOutButton from './SignOutButton'
import MobileHeader from './MobileHeader'

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, full_name, email')
    .eq('id', user.id)
    .single()

  const role = profile?.role

  // If role is null, render error UI directly — do NOT redirect('/dashboard')
  // as that causes an infinite loop (layout → /dashboard → layout → ...)
  if (!role) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: 'var(--cream)', fontFamily: 'var(--font-body)' }}>
        <div style={{ textAlign: 'center', padding: '2rem' }}>
          <h2 style={{ fontFamily: 'var(--font-display)', color: 'var(--forest)', fontSize: '1.8rem', marginBottom: '1rem' }}>
            Account Setup Incomplete
          </h2>
          <p style={{ color: 'var(--forest)', opacity: 0.7, marginBottom: '0.5rem' }}>
            Your account role hasn&apos;t been assigned yet.
          </p>
          <p style={{ fontSize: '0.8rem', color: 'var(--forest)', opacity: 0.4, marginBottom: '2rem' }}>
            User: {user.email} · ID: {user.id}
          </p>
          <a href="/auth/login" style={{ background: 'var(--forest)', color: 'var(--cream)', padding: '0.75rem 2rem', borderRadius: '99px', textDecoration: 'none', fontWeight: 700 }}>
            Sign Out &amp; Back to Login
          </a>
        </div>
      </div>
    )
  }

  const navLinks = {
    admin:  [
      { href: '/dashboard/admin',         label: 'Overview',      icon: '◎' },
      { href: '/dashboard/admin/orders',  label: 'Orders',        icon: '📦' },
      { href: '/dashboard/admin/farmers', label: 'Growers',       icon: '🌿' },
      { href: '/dashboard/admin/buyers',   label: 'Buyers',        icon: '🛒' },
      { href: '/dashboard/admin/disputes', label: 'Disputes',     icon: '🚨' },
      { href: '/dashboard/admin/payouts', label: 'Payouts',       icon: '💰' },
      { href: '/dashboard/admin/config',  label: 'Config',        icon: '⚙' },
    ],
    farmer: [
      { href: '/dashboard/farmer',                   label: 'Overview',   icon: '◎' },
      { href: '/dashboard/farmer/inventory',         label: 'Inventory',  icon: '📋' },
      { href: '/dashboard/farmer/orders',            label: 'Orders',     icon: '📦' },
      { href: '/dashboard/farmer/payouts',           label: 'Payouts',    icon: '💰' },
      { href: '/dashboard/farmer/storefront',        label: 'Storefront', icon: '🏪' },
    ],
    buyer: [
      { href: '/dashboard/buyer',        label: 'Overview',    icon: '◎' },
      { href: '/marketplace',            label: 'Marketplace', icon: '🛒' },
      { href: '/growers',                label: 'Growers',     icon: '🌱' },
      { href: '/dashboard/buyer/orders', label: 'Orders',      icon: '📦' },
    ],
  }

  const links = role === 'admin' ? navLinks.admin : role === 'farmer' ? navLinks.farmer : navLinks.buyer
  const roleLabel = role === 'admin' ? 'Admin' : role === 'farmer' ? 'Grower' : role === 'buyer_b2b' ? 'B2B Buyer' : 'Buyer'

  const badgeStyle: Record<string, React.CSSProperties> = {
    admin:      { background: 'var(--forest)', color: 'var(--cream)' },
    farmer:     { background: 'var(--sage)', color: 'var(--forest)' },
    buyer_b2b:  { background: 'var(--offwhite)', color: 'var(--forest)', border: '1px solid var(--sage)' },
    buyer_b2c:  { background: 'var(--offwhite)', color: 'var(--forest)' },
  }

  // Sign out handled via /api/auth/signout POST route
  // (Server Actions caused redirect issues with browser extension probes)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', background: 'var(--cream)' }}>

      {/* Mobile top bar — hidden on desktop via CSS */}
      <MobileHeader
        links={links}
        userName={profile?.full_name || null}
        roleLabel={roleLabel}
        roleStyle={badgeStyle[role] || {}}
      />

      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>

      {/* ── Sidebar (desktop only) ── */}
      <aside className="desktop-sidebar" style={{
        width: '15rem', flexShrink: 0, display: 'flex', flexDirection: 'column',
        position: 'sticky', top: 0, height: '100vh',
        background: 'white', borderRight: '1px solid var(--olive)',
        boxShadow: '1px 0 0 var(--olive)',
      }}>

        {/* Logo */}
        <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--olive)' }}>
          <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', textDecoration: 'none' }}>
            <div style={{ width: '2rem', height: '2rem', borderRadius: '0.5rem', background: 'var(--forest)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-display)', color: 'var(--cream)', fontSize: '1rem' }}>B</div>
            <span style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', color: 'var(--navy)', fontWeight: 600 }}>Bloom Lane</span>
          </Link>
        </div>

        {/* User chip */}
        <div style={{ padding: '1.25rem', borderBottom: '1px solid var(--olive)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{
              width: '2.25rem', height: '2.25rem', borderRadius: '50%', flexShrink: 0,
              background: 'var(--forest)', display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--cream)', fontFamily: 'var(--font-display)', fontSize: '1rem',
            }}>
              {profile?.full_name?.[0]?.toUpperCase() || '?'}
            </div>
            <div style={{ minWidth: 0 }}>
              <p style={{ fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: '0.8rem', color: 'var(--forest)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {profile?.full_name}
              </p>
              <span className="badge" style={{ marginTop: '0.25rem', ...badgeStyle[role] }}>
                {roleLabel}
              </span>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '0.75rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
          {links.map(link => (
            <Link key={link.href} href={link.href} className="nav-item">
              <span style={{ width: '1.25rem', textAlign: 'center', fontSize: '0.9rem' }}>{link.icon}</span>
              {link.label}
            </Link>
          ))}
        </nav>

        {/* Bottom */}
        <div style={{ padding: '0.75rem', borderTop: '1px solid var(--olive)', display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
          <Link href="/marketplace" className="nav-item">
            <span style={{ width: '1.25rem', textAlign: 'center' }}>🌿</span> Marketplace
          </Link>
          <SignOutButton />
        </div>
      </aside>

      {/* Main */}
      <main style={{ flex: 1, overflow: 'auto' }}>{children}</main>

      </div>{/* end flex row */}
    </div>
  )
}