'use client'
import { useState } from 'react'
import { roleLabel } from '@/lib/utils/permissions'

type Profile = { id: string; full_name: string | null; email: string; role: string; created_at?: string }
const BUSINESS_ROLES = ['farmer', 'buyer_b2b', 'buyer_b2c', 'coordinator']

export default function AdminUsersPage() {
  const [email, setEmail] = useState('')
  const [searching, setSearching] = useState(false)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [targetRole, setTargetRole] = useState('')
  const [saving, setSaving] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  async function search(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) return
    setSearching(true)
    setMsg(null)
    setProfile(null)
    const res = await fetch(`/api/admin/users/role?email=${encodeURIComponent(email.trim())}`)
    const data = await res.json()
    if (!res.ok) {
      setMsg({ type: 'err', text: data.error || 'User not found' })
    } else {
      setProfile(data.data)
      setTargetRole(data.data.role)
    }
    setSearching(false)
  }

  async function changeRole() {
    if (!profile) return
    setSaving(true)
    setMsg(null)
    const res = await fetch('/api/admin/users/role', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: profile.email, target_role: targetRole }),
    })
    const data = await res.json()
    if (!res.ok) {
      setMsg({ type: 'err', text: data.error || 'Could not change role' })
    } else {
      setProfile(data.user)
      setMsg({ type: 'ok', text: `Role updated to ${roleLabel(targetRole)}.` })
    }
    setSaving(false)
    setConfirming(false)
  }

  return (
    <div className="page-pad" style={{ padding: '2.5rem', maxWidth: '40rem' }}>
      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', color: 'var(--navy)', marginBottom: '0.25rem' }}>Users</h1>
      <p style={{ fontSize: '0.875rem', color: 'var(--moss)', marginBottom: '2rem' }}>
        Look up any account by email and fix a mis-assigned business role (grower, buyer, coordinator). Platform-admin
        access is managed separately in Config &gt; Team.
      </p>

      <form onSubmit={search} className="card" style={{ padding: '1.25rem', display: 'flex', gap: '0.75rem', marginBottom: '1.5rem' }}>
        <input
          className="input" type="email" placeholder="user@example.com" value={email}
          onChange={e => setEmail(e.target.value)} style={{ flex: 1 }} required
        />
        <button type="submit" disabled={searching} className="btn btn-forest">
          {searching ? 'Searching…' : 'Search'}
        </button>
      </form>

      {msg && (
        <div style={{ padding: '0.875rem 1rem', borderRadius: '0.75rem', marginBottom: '1.5rem', fontSize: '0.85rem', fontWeight: 600, background: msg.type === 'ok' ? '#D1FAE5' : '#FEE2E2', color: msg.type === 'ok' ? '#065F46' : '#B91C1C' }}>
          {msg.type === 'ok' ? '✓' : '⚠'} {msg.text}
        </div>
      )}

      {profile && (
        <div className="card" style={{ padding: '1.5rem' }}>
          <div style={{ marginBottom: '1.25rem' }}>
            <p style={{ fontWeight: 700, color: 'var(--navy)' }}>{profile.full_name || '—'}</p>
            <p style={{ fontSize: '0.85rem', color: 'var(--moss)' }}>{profile.email}</p>
            <p style={{ fontSize: '0.8rem', color: 'var(--moss)', marginTop: '0.25rem' }}>
              Current role: <strong>{roleLabel(profile.role)}</strong>
            </p>
          </div>

          {['admin', 'super_admin', 'platform_admin'].includes(profile.role) ? (
            <p style={{ fontSize: '0.8rem', color: '#92400E', background: '#FEF3C7', padding: '0.75rem 1rem', borderRadius: '0.625rem' }}>
              This account is on the platform team — change its access from Admin &gt; Config &gt; Team instead.
            </p>
          ) : (
            <>
              <label className="type-label-sm" style={{ display: 'block', color: 'var(--moss)', marginBottom: '0.375rem' }}>Change role to</label>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <select value={targetRole} onChange={e => setTargetRole(e.target.value)} className="input" style={{ flex: 1 }}>
                  {BUSINESS_ROLES.map(r => <option key={r} value={r}>{roleLabel(r)}</option>)}
                </select>
                <button
                  onClick={() => setConfirming(true)}
                  disabled={saving || targetRole === profile.role}
                  className="btn btn-forest"
                >
                  Change Role
                </button>
              </div>
              <p style={{ fontSize: '0.75rem', color: 'var(--moss)', marginTop: '0.5rem', opacity: 0.8 }}>
                Only changes what dashboard and permissions this account gets — it won't create or delete any
                grower/buyer/hub profile data, so a switched-to role may need to complete its own profile setup.
              </p>
            </>
          )}
        </div>
      )}

      {confirming && profile && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div onClick={() => setConfirming(false)} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)' }} />
          <div style={{ position: 'relative', background: 'white', borderRadius: '16px', width: '100%', maxWidth: '24rem', padding: '1.75rem', textAlign: 'center' }}>
            <p style={{ fontWeight: 700, color: 'var(--navy)', marginBottom: '0.5rem' }}>Change role?</p>
            <p style={{ fontSize: '0.85rem', color: 'var(--moss)', marginBottom: '1.5rem' }}>
              {profile.email} will move from <strong>{roleLabel(profile.role)}</strong> to <strong>{roleLabel(targetRole)}</strong>.
            </p>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
              <button onClick={() => setConfirming(false)} className="btn btn-ghost btn-sm" style={{ minWidth: '7rem' }}>Cancel</button>
              <button onClick={changeRole} disabled={saving} className="btn btn-forest btn-sm" style={{ minWidth: '7rem' }}>
                {saving ? 'Saving…' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
