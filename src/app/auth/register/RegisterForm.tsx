'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { validateABNFormat } from '@/lib/utils/abn'

type Role = 'buyer_b2b' | 'buyer_b2c' | 'farmer' | 'coordinator'

export default function RegisterForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const defaultRole = (searchParams.get('role') as Role) || 'buyer_b2b'
  const [role, setRole] = useState<Role>(defaultRole)
  const [step, setStep] = useState<'form' | 'done'>('form')
  const [form, setForm] = useState({ email: '', password: '', fullName: '', businessName: '', phone: '', abn: '', postcode: '' })
  const [abnStatus, setAbnStatus] = useState<'idle' | 'checking' | 'ok' | 'error'>('idle')
  const [abnMsg, setAbnMsg] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
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

    if (data.user && !data.session) {
      setStep('done')
    } else if (data.session) {
      setStep('done')
    } else {
      setError('Something went wrong. Please try again.')
      setLoading(false)
    }
  }

  const roles = [
    { id: 'buyer_b2b',   icon: '🏪', label: 'Business Buyer',  sub: 'Wholesale with ABN' },
    { id: 'buyer_b2c',   icon: '🛍️', label: 'Individual',       sub: 'Retail pricing' },
    { id: 'farmer',      icon: '🌿', label: 'Grower',           sub: 'List & sell produce' },
    { id: 'coordinator', icon: '🏛',  label: 'Coordinator',     sub: 'Manage a hub/group' },
  ]

  if (step === 'done') return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent' }}>
      <div className="card-forest reveal" style={{ padding: '4rem', textAlign: 'center', maxWidth: '28rem' }}>
        <div style={{ fontSize: '4rem', marginBottom: '1.5rem' }}>🌱</div>
        <h2 className="type-subheading" style={{ color: 'var(--cream)', marginBottom: '1rem' }}>You're in!</h2>
        <p className="type-label" style={{ color: 'var(--moss)', marginBottom: '2.5rem', lineHeight: 1.8 }}>
          Check your email to confirm.
          {role === 'farmer' ? ' We review grower applications within 24 hours.' : ''}
          {role === 'coordinator' ? ' Once confirmed, you can register your hub.' : ''}
        </p>
        <Link href="/auth/login" className="btn btn-cream" style={{ width: '100%' }}>Go to sign in</Link>
      </div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', padding: '3rem 1.5rem' }}>
      <div className="reveal" style={{ width: '100%', maxWidth: '30rem' }}>
        <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
          <Link href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.75rem', textDecoration: 'none', marginBottom: '2rem' }}>
            <div style={{ width: '2.25rem', height: '2.25rem', borderRadius: '0.625rem', background: 'var(--forest)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-display)', color: 'var(--cream)', fontSize: '1.1rem' }}>T</div>
            <span style={{ fontFamily: 'var(--font-display)', fontSize: '1.75rem', color: 'var(--navy)', textTransform: 'uppercase', letterSpacing: '-0.03em' }}>The Green Guild</span>
          </Link>
          <h1 className="type-subheading" style={{ color: 'var(--navy)', marginBottom: '0.5rem' }}>Create account</h1>
          <p className="type-label" style={{ color: 'var(--moss)' }}>
            Already have one? <Link href="/auth/login" style={{ color: 'var(--navy)', textDecoration: 'underline', textUnderlineOffset: '3px' }}>Sign in</Link>
          </p>
        </div>

        <div className="card" style={{ padding: '0.5rem', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '0.375rem', marginBottom: '1.5rem', background: 'var(--olive)' }}>
          {roles.map(opt => (
            <button key={opt.id} type="button" onClick={() => setRole(opt.id as Role)}
              style={{ padding: '1rem 0.5rem', borderRadius: '2rem', border: 'none', cursor: 'pointer', textAlign: 'center', transition: 'all 0.2s', background: role === opt.id ? 'var(--forest)' : 'transparent' }}>
              <div style={{ fontSize: '1.5rem', marginBottom: '0.375rem' }}>{opt.icon}</div>
              <div className="type-label-sm" style={{ color: role === opt.id ? 'var(--cream)' : 'var(--forest)', marginBottom: '0.2rem' }}>{opt.label}</div>
              <div style={{ fontSize: '0.6rem', color: role === opt.id ? 'var(--sage)' : 'var(--moss)' }}>{opt.sub}</div>
            </button>
          ))}
        </div>

        {error && <div className="badge badge-red" style={{ width: '100%', padding: '0.875rem', borderRadius: '0.75rem', marginBottom: '1.25rem', justifyContent: 'flex-start', fontSize: '0.75rem' }}>⚠ {error}</div>}

        <form onSubmit={handleSubmit} className="card" style={{ padding: '2rem', display: 'grid', gap: '1.125rem', background: 'white' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div><label className="label">Full name *</label><input className="input" placeholder="Jane Smith" value={form.fullName} onChange={e => up('fullName', e.target.value)} required /></div>
            <div><label className="label">Phone</label><input className="input" type="tel" placeholder="04xx xxx xxx" value={form.phone} onChange={e => up('phone', e.target.value)} /></div>
          </div>
          {(role === 'buyer_b2b' || role === 'farmer' || role === 'coordinator') && (
            <div><label className="label">{role === 'coordinator' ? 'Organisation name *' : 'Business name *'}</label><input className="input" placeholder={role === 'coordinator' ? 'Your organisation or collective' : 'Your business name'} value={form.businessName} onChange={e => up('businessName', e.target.value)} required /></div>
          )}
          <div><label className="label">Email *</label><input className="input" type="email" placeholder="you@business.com.au" value={form.email} onChange={e => up('email', e.target.value)} required /></div>
          <div><label className="label">Password *</label><input className="input" type="password" placeholder="Min 8 characters" value={form.password} onChange={e => up('password', e.target.value)} required minLength={8} /></div>
          {(role === 'buyer_b2b' || role === 'farmer' || role === 'coordinator') && (
            <div>
              <label className="label">ABN (11 digits)</label>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <input className="input" placeholder="XX XXX XXX XXX" value={form.abn} onChange={e => { up('abn', e.target.value); setAbnStatus('idle') }} style={{ flex: 1 }} />
                <button type="button" onClick={checkABN} className="btn btn-ghost btn-sm" disabled={abnStatus === 'checking'} style={{ flexShrink: 0 }}>
                  {abnStatus === 'checking' ? '…' : 'Verify'}
                </button>
              </div>
              {abnMsg && <p className="type-label-sm" style={{ marginTop: '0.5rem', color: abnStatus === 'ok' ? 'var(--forest)' : '#b91c1c' }}>{abnMsg}</p>}
            </div>
          )}
          {role === 'farmer' && (
            <div><label className="label">Farm postcode *</label><input className="input" placeholder="3000" maxLength={4} value={form.postcode} onChange={e => up('postcode', e.target.value)} required /></div>
          )}
          {role === 'coordinator' && (
            <div style={{ padding: '0.875rem', background: 'var(--olive)', borderRadius: '0.75rem', fontSize: '0.775rem', color: 'var(--moss)' }}>
              After registering, you can set up your hub from the coordinator dashboard.
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginTop: '0.5rem' }}>
            <Link href="/" className="btn btn-outline" style={{ justifyContent: 'center' }}>Cancel</Link>
            <button type="submit" className="btn btn-forest" disabled={loading}>{loading ? 'Creating…' : 'Create account'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}
