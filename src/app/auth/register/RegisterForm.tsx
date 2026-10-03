'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { validateABNFormat, sanitizeABNInput } from '@/lib/utils/abn'

type Role = 'buyer_b2b' | 'buyer_b2c' | 'farmer' | 'coordinator'

export default function RegisterForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const requestedRole = (searchParams.get('role') as Role) || 'buyer_b2b'
  // Personal retail (buyer_b2c) isn't open for signup yet — only wholesale
  // buyer accounts are active right now — so a deep link requesting it
  // falls back to the wholesale option rather than landing on a disabled card.
  const defaultRole = requestedRole === 'buyer_b2c' ? 'buyer_b2b' : requestedRole
  const [role, setRole] = useState<Role>(defaultRole)
  const [step, setStep] = useState<'form' | 'done'>('form')
  const [form, setForm] = useState({ email: '', password: '', fullName: '', businessName: '', phone: '', abn: '', postcode: '' })
  const [flowerBusiness, setFlowerBusiness] = useState(false)
  const [abnStatus, setAbnStatus] = useState<'idle' | 'checking' | 'ok' | 'error'>('idle')
  const [abnMsg, setAbnMsg] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const up = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  async function checkABN() {
    if (!validateABNFormat(form.abn)) { setAbnStatus('error'); setAbnMsg('Invalid ABN — must be 11 digits'); return }
    setAbnStatus('checking')
    const res = await fetch('/api/abn', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ abn: form.abn }) })
    const d = await res.json()
    if (d.isValid) { setAbnStatus('ok'); setAbnMsg(d.businessName ? `✓ ${d.businessName}` : '✓ ABN valid') }
    else { setAbnStatus('error'); setAbnMsg(d.error || 'ABN not found') }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    if (!form.fullName.trim()) { setError('Full name is required'); setLoading(false); return }
    if (!form.email.trim()) { setError('Email is required'); setLoading(false); return }
    if (form.password.length < 8) { setError('Password must be at least 8 characters'); setLoading(false); return }
    if ((role === 'buyer_b2b' || role === 'farmer' || role === 'coordinator') && !form.businessName.trim()) {
      setError('Business/organisation name is required for this account type'); setLoading(false); return
    }
    if (role === 'farmer' && !form.postcode.trim()) {
      setError('Postcode is required for farmer accounts'); setLoading(false); return
    }
    if (role === 'farmer' && !validateABNFormat(form.abn)) {
      setError('Please enter a valid 11-digit ABN for your grower account'); setLoading(false); return
    }

    const supabase = createClient()
    const { data, error } = await supabase.auth.signUp({
      email: form.email.trim(),
      password: form.password,
      options: {
        data: {
          full_name:     form.fullName.trim(),
          role,
          business_name: form.businessName.trim(),
          phone:         form.phone.trim(),
          abn:           form.abn.replace(/\s/g, ''),
          postcode:      form.postcode.trim(),
          flower_related_business: role === 'buyer_b2b' ? flowerBusiness : null,
        }
      }
    })

    if (error) {
      const msg = error.message
      const status = (error as any).status || 0
      if (msg.includes('User already registered') || msg.includes('already been registered') || msg.toLowerCase().includes('already registered')) {
        setError('An account with this email already exists. Please sign in instead.')
      } else if (msg.includes('Password') || msg.includes('password')) {
        setError('Password is too weak. Use at least 8 characters.')
      } else if (msg.includes('valid email') || msg.includes('invalid email')) {
        setError('Please enter a valid email address.')
      } else if (msg.includes('rate limit') || msg.includes('too many')) {
        setError('Too many attempts. Please wait a few minutes and try again.')
      } else if (msg.includes('Database error') && status === 500) {
        setError(`Account creation failed: ${msg}. Please ensure migrations have been run in Supabase.`)
      } else {
        setError(msg || 'Something went wrong. Please try again.')
      }
      setLoading(false)
      return
    }

    // Supabase never returns an error for signUp() on an email that already
    // has an account but hasn't confirmed it yet — by design, to avoid
    // leaking which emails are registered. Instead it silently re-sends that
    // EXISTING account's original confirmation link and discards everything
    // just submitted (role, business name, ABN, all of it) with no signal
    // to the caller except one: a fresh signup's user comes back with a
    // non-empty `identities` array, a pre-existing user's comes back empty.
    // Without this check, someone re-registering an old test email under a
    // different role sees "check your email", confirms, and is silently
    // logged into the original stale account instead.
    if (data.user && data.user.identities?.length === 0) {
      setError('An account with this email already exists but hasn’t been confirmed yet. Check your inbox for the original confirmation link, or reset your password from the sign-in page.')
      setLoading(false)
      return
    }

    if (data.user && !data.session) {
      setStep('done')
    } else if (data.session) {
      setStep('done')
    } else {
      setError('Something went wrong. Please try again.')
      setLoading(false)
    }
  }

  // Public sign-up for buyers and growers is paused for a few weeks while
  // we work through interest registrations first — set these back to true
  // to reopen. Coordinator registration (hub setup) stays open throughout.
  const PUBLIC_SIGNUP_OPEN: Record<Role, boolean> = {
    buyer_b2b: false,
    buyer_b2c: false,
    farmer: false,
    coordinator: true,
  }

  const roles = [
    { id: 'buyer_b2b',   icon: '🏪', label: 'Business Buyer',  sub: PUBLIC_SIGNUP_OPEN.buyer_b2b ? 'Buyer pricing with ABN' : 'Register interest', interestHref: '/register-interest/buyer' },
    { id: 'buyer_b2c',   icon: '🛍️', label: 'Individual',       sub: 'Coming soon', disabled: true },
    { id: 'farmer',      icon: '🌿', label: 'Grower',           sub: PUBLIC_SIGNUP_OPEN.farmer ? 'List & sell produce' : 'Register interest', interestHref: '/register-interest/grower' },
    { id: 'coordinator', icon: '🏛',  label: 'Coordinator',     sub: 'Manage a hub or collective' },
  ]

  if (step === 'done') return (
    <div className="card-forest" style={{ padding: '2.5rem', textAlign: 'center' }}>
      <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🌱</div>
      <h2 className="type-subheading" style={{ color: 'var(--cream)', marginBottom: '0.75rem' }}>You're in!</h2>
      <p className="type-label" style={{ color: 'var(--moss)', marginBottom: '1.75rem', lineHeight: 1.8 }}>
        Check your email to confirm.
        {role === 'farmer' ? ' We review grower applications within 24 hours.' : ''}
        {role === 'coordinator' ? ' Once confirmed, you can register your hub.' : ''}
      </p>
      <Link href="/auth/login" className="btn btn-cream" style={{ width: '100%' }}>Go to sign in</Link>
    </div>
  )

  return (
    <div>
        <div className="card" style={{ padding: '0.375rem', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '0.25rem', marginBottom: '0.75rem', background: 'var(--olive)' }}>
          {roles.map(opt => (
            <button key={opt.id} type="button" onClick={() => !opt.disabled && setRole(opt.id as Role)}
              disabled={opt.disabled}
              title={opt.disabled ? 'Personal retail accounts aren\'t open yet' : undefined}
              style={{ padding: '0.5rem 0.375rem', borderRadius: '2rem', border: 'none', cursor: opt.disabled ? 'not-allowed' : 'pointer', textAlign: 'center', transition: 'all 0.2s', background: role === opt.id ? 'var(--forest)' : 'transparent', opacity: opt.disabled ? 0.45 : 1 }}>
              <div style={{ fontSize: '1.2rem', marginBottom: '0.2rem' }}>{opt.icon}</div>
              <div className="type-label-sm" style={{ color: role === opt.id ? 'var(--cream)' : 'var(--forest)', marginBottom: '0.1rem' }}>{opt.label}</div>
              <div style={{ fontSize: '0.6rem', color: role === opt.id ? 'var(--sage)' : 'var(--moss)' }}>{opt.sub}</div>
            </button>
          ))}
        </div>

        {error && <div className="badge badge-red" style={{ width: '100%', padding: '0.625rem', borderRadius: '0.75rem', marginBottom: '0.75rem', justifyContent: 'flex-start', fontSize: '0.75rem' }}>⚠ {error}</div>}

        {!PUBLIC_SIGNUP_OPEN[role] ? (
          <div className="card" style={{ padding: '2rem', background: 'white', textAlign: 'center' }}>
            <p style={{ fontWeight: 700, color: 'var(--forest)', marginBottom: '0.5rem' }}>
              {role === 'farmer' ? 'Grower' : 'Buyer'} sign-ups open soon
            </p>
            <p style={{ fontSize: '0.85rem', color: 'var(--moss)', marginBottom: '1.5rem', lineHeight: 1.6 }}>
              We're opening to {role === 'farmer' ? 'growers' : 'buyers'} in the next few weeks. Register your interest and we'll email you as soon as sign-ups are open.
            </p>
            <Link href={roles.find(r => r.id === role)?.interestHref || '/'} className="btn btn-forest" style={{ width: '100%' }}>
              Register interest
            </Link>
          </div>
        ) : (
        <form onSubmit={handleSubmit} className="card" style={{ padding: '1.25rem', display: 'grid', gap: '0.625rem', background: 'white' }}>
          <div className="mg-stack" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.625rem' }}>
            <div><label className="label">Full name *</label><input className="input" placeholder="Jane Smith" value={form.fullName} onChange={e => up('fullName', e.target.value)} required /></div>
            <div><label className="label">Phone</label><input className="input" type="tel" placeholder="04xx xxx xxx" value={form.phone} onChange={e => up('phone', e.target.value)} /></div>
          </div>
          {(role === 'buyer_b2b' || role === 'farmer' || role === 'coordinator') && (
            <div><label className="label">{role === 'coordinator' ? 'Organisation name *' : 'Business name *'}</label><input className="input" placeholder={role === 'coordinator' ? 'Your organisation or collective' : 'Your business name'} value={form.businessName} onChange={e => up('businessName', e.target.value)} required /></div>
          )}
          <div><label className="label">Email *</label><input className="input" type="email" placeholder="you@business.com.au" value={form.email} onChange={e => up('email', e.target.value)} required /></div>
          <div>
            <label className="label">Password *</label>
            <div style={{ position: 'relative' }}>
              <input
                className="input" type={showPassword ? 'text' : 'password'} placeholder="Min 8 characters"
                value={form.password} onChange={e => up('password', e.target.value)} required minLength={8}
                style={{ paddingRight: '2.75rem', width: '100%' }}
              />
              <button
                type="button" onClick={() => setShowPassword(v => !v)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                style={{ position: 'absolute', right: '0.5rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 700, color: 'var(--moss)', padding: '0.375rem 0.5rem' }}
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>
          {(role === 'buyer_b2b' || role === 'farmer' || role === 'coordinator') && (
            <div>
              <label className="label">ABN (11 digits)</label>
              <div style={{ display: 'flex', gap: '0.625rem' }}>
                <input className="input" placeholder="XX XXX XXX XXX" value={form.abn} onChange={e => { up('abn', sanitizeABNInput(e.target.value)); setAbnStatus('idle') }} maxLength={11} style={{ flex: 1 }} />
                <button type="button" onClick={checkABN} className="btn btn-ghost btn-sm" disabled={abnStatus === 'checking'} style={{ flexShrink: 0 }}>
                  {abnStatus === 'checking' ? '…' : 'Verify'}
                </button>
              </div>
              {abnMsg && <p className="type-label-sm" style={{ marginTop: '0.375rem', color: abnStatus === 'ok' ? 'var(--forest)' : '#b91c1c' }}>{abnMsg}</p>}
            </div>
          )}
          {role === 'buyer_b2b' && (
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.625rem', fontSize: '0.8rem', color: 'var(--moss)', cursor: 'pointer' }}>
              <input type="checkbox" checked={flowerBusiness} onChange={e => setFlowerBusiness(e.target.checked)} style={{ marginTop: '0.15rem' }} />
              This ABN is for a flower-related business (florist, event stylist, wedding planner, etc.)
            </label>
          )}
          {role === 'farmer' && (
            <div><label className="label">Farm postcode *</label><input className="input" placeholder="3000" maxLength={4} value={form.postcode} onChange={e => up('postcode', e.target.value)} required /></div>
          )}
          {role === 'coordinator' && (
            <div style={{ padding: '0.625rem', background: 'var(--olive)', borderRadius: '0.75rem', fontSize: '0.775rem', color: 'var(--moss)' }}>
              After registering, you can set up your hub from the coordinator dashboard.
            </div>
          )}
          <div className="mg-stack" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.625rem' }}>
            <Link href="/" className="btn btn-outline" style={{ justifyContent: 'center' }}>Cancel</Link>
            <button type="submit" className="btn btn-forest" disabled={loading}>{loading ? 'Creating…' : 'Create account'}</button>
          </div>
        </form>
        )}
    </div>
  )
}
