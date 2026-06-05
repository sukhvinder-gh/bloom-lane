'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function ResetPasswordPage() {
  const supabase = createClient()
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    // Supabase exchanges the token from the URL hash automatically
    supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setReady(true)
    })
  }, [])

  async function handleReset() {
    if (password !== confirm) return setError('Passwords do not match')
    if (password.length < 6) return setError('Password must be at least 6 characters')
    setLoading(true)
    setError(null)
    const { error } = await supabase.auth.updateUser({ password })
    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      router.push('/auth/login?reset=success')
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '0.75rem 1rem', borderRadius: '0.75rem',
    border: '1.5px solid var(--sage)', fontFamily: 'var(--font-body)',
    fontSize: '0.95rem', color: 'var(--forest)', background: 'var(--cream)',
    boxSizing: 'border-box',
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--cream)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-body)' }}>
      <div style={{ width: '100%', maxWidth: '22rem', padding: '2rem' }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', color: 'var(--forest)', marginBottom: '0.5rem' }}>
          Reset password
        </h1>
        <p style={{ color: 'var(--forest)', opacity: 0.5, fontSize: '0.9rem', marginBottom: '2rem' }}>
          Enter your new password below.
        </p>

        {!ready && (
          <div style={{ background: '#fef9c3', border: '1px solid #fbbf24', borderRadius: '0.75rem', padding: '1rem', marginBottom: '1.5rem', fontSize: '0.875rem', color: '#92400e' }}>
            ⏳ Verifying reset link...
          </div>
        )}

        {error && (
          <div style={{ background: '#fee2e2', color: '#991b1b', padding: '0.75rem 1rem', borderRadius: '0.5rem', marginBottom: '1.5rem', fontSize: '0.875rem' }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label style={{ display: 'block', fontWeight: 700, fontSize: '0.875rem', color: 'var(--forest)', marginBottom: '0.35rem' }}>
              New password
            </label>
            <input type="password" style={inputStyle} value={password}
              onChange={e => setPassword(e.target.value)} placeholder="Min. 6 characters" />
          </div>
          <div>
            <label style={{ display: 'block', fontWeight: 700, fontSize: '0.875rem', color: 'var(--forest)', marginBottom: '0.35rem' }}>
              Confirm password
            </label>
            <input type="password" style={inputStyle} value={confirm}
              onChange={e => setConfirm(e.target.value)} placeholder="Repeat password" />
          </div>
          <button onClick={handleReset} disabled={loading || !ready}
            style={{ padding: '0.75rem', borderRadius: '0.75rem', background: 'var(--forest)', color: 'var(--cream)', border: 'none', fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: '0.95rem', cursor: loading || !ready ? 'not-allowed' : 'pointer', opacity: !ready ? 0.6 : 1 }}>
            {loading ? 'Updating...' : 'Set new password'}
          </button>
        </div>
      </div>
    </div>
  )
}