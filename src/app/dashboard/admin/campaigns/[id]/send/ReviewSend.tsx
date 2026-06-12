'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

interface Props {
  campaignId: string
  subject: string
  body: string
  activeCount: number
  adminEmail: string
}

export default function ReviewSend({ campaignId, subject, body, activeCount, adminEmail }: Props) {
  const router = useRouter()
  const [reviewed, setReviewed] = useState(false)
  const [recipientMode, setRecipientMode] = useState<'all' | 'choose'>('all')
  const [sending, setSending] = useState(false)
  const [sendMsg, setSendMsg] = useState('')
  const [testEmail, setTestEmail] = useState(adminEmail)
  const [testing, setTesting] = useState(false)
  const [testMsg, setTestMsg] = useState('')

  async function sendTest() {
    if (!testEmail.trim()) return
    setTesting(true)
    setTestMsg('')
    try {
      const res = await fetch('/api/admin/campaigns/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject, body, to: testEmail }),
      })
      const d = await res.json()
      setTestMsg(res.ok ? '✓ Test email sent' : `⚠ ${d.error || 'Failed'}`)
    } catch { setTestMsg('⚠ Network error') } finally { setTesting(false) }
  }

  async function send() {
    if (!reviewed) return
    setSending(true)
    setSendMsg('')
    try {
      const res = await fetch(`/api/admin/campaigns/${campaignId}/send`, { method: 'POST' })
      const d = await res.json()
      if (res.ok) {
        setSendMsg(`✓ Sent to ${d.sent} subscriber${d.sent !== 1 ? 's' : ''}${d.failed > 0 ? ` (${d.failed} failed)` : ''}`)
        setTimeout(() => router.push('/dashboard/admin/campaigns'), 1800)
      } else {
        setSendMsg(`⚠ ${d.error || 'Send failed'}`)
        setSending(false)
      }
    } catch { setSendMsg('⚠ Network error'); setSending(false) }
  }

  const fieldLabel: React.CSSProperties = { display: 'block', fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-3)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.1em' }
  const inputBase: React.CSSProperties = { width: '100%', boxSizing: 'border-box', padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid var(--border-light)', fontSize: '0.9rem', color: 'var(--text-1)', background: 'var(--bg)', outline: 'none', fontFamily: 'inherit' }

  return (
    <div style={{ padding: '2rem 2.5rem', maxWidth: '680px', margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
        <Link href="/dashboard/admin/campaigns" style={{ color: 'var(--text-3)', textDecoration: 'none', fontSize: '0.875rem' }}>
          ← Back
        </Link>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.75rem', fontWeight: 700, color: 'var(--navy)' }}>
          Review &amp; Send
        </h1>
      </div>

      <div style={{ background: 'var(--surface)', border: '1px solid var(--border-light)', borderRadius: '12px', padding: '1.75rem' }}>
        {/* Subject preview */}
        <div style={{ marginBottom: '1.25rem' }}>
          <label style={fieldLabel}>Email Subject</label>
          <div style={{ ...inputBase, color: 'var(--text-2)' }}>{subject || <em>No subject</em>}</div>
        </div>

        {/* Body preview */}
        <div style={{ marginBottom: '1.5rem' }}>
          <label style={fieldLabel}>Message Body</label>
          <div style={{ ...inputBase, minHeight: '120px', whiteSpace: 'pre-wrap', color: 'var(--text-2)', lineHeight: 1.7 }}>
            {body || <em>No body</em>}
          </div>
        </div>

        {/* Review checkbox */}
        <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', padding: '1rem 1.25rem', border: `1px solid ${reviewed ? 'var(--green)' : 'var(--border-light)'}`, borderRadius: '8px', cursor: 'pointer', marginBottom: '1.5rem', background: reviewed ? 'var(--green-soft)' : 'transparent', transition: 'all 0.15s' }}>
          <input
            type="checkbox"
            checked={reviewed}
            onChange={e => setReviewed(e.target.checked)}
            style={{ marginTop: '0.1rem', flexShrink: 0, accentColor: 'var(--green)', width: '1rem', height: '1rem' }}
          />
          <span style={{ fontSize: '0.875rem', color: 'var(--text-1)', lineHeight: 1.5 }}>
            I have reviewed the subject and body — <span style={{ color: 'var(--green)', fontWeight: 600 }}>content is correct and ready to send</span>
          </span>
        </label>

        {/* Recipients */}
        <div style={{ marginBottom: '1.5rem' }}>
          <label style={fieldLabel}>Recipients</label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <button
              onClick={() => setRecipientMode('all')}
              style={{ padding: '0.75rem', borderRadius: '8px', border: 'none', fontWeight: 700, fontSize: '0.875rem', cursor: 'pointer', background: recipientMode === 'all' ? 'var(--navy)' : 'var(--bg)', color: recipientMode === 'all' ? 'white' : 'var(--text-2)', border: recipientMode === 'all' ? 'none' : '1px solid var(--border-light)' } as React.CSSProperties}
            >
              All active subscribers
            </button>
            <button
              onClick={() => setRecipientMode('choose')}
              style={{ padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-light)', fontWeight: 700, fontSize: '0.875rem', cursor: 'pointer', background: recipientMode === 'choose' ? 'var(--navy)' : 'var(--bg)', color: recipientMode === 'choose' ? 'white' : 'var(--text-2)' }}
            >
              Choose recipients
            </button>
          </div>
          {recipientMode === 'choose' && (
            <p style={{ fontSize: '0.8rem', color: 'var(--text-3)', marginTop: '0.625rem' }}>
              Segment targeting coming soon. Currently sends to all active subscribers.
            </p>
          )}
        </div>

        {/* Send test */}
        <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: '1.5rem', marginBottom: '1.5rem' }}>
          <label style={fieldLabel}>Send Test Email</label>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <input type="email" value={testEmail} onChange={e => setTestEmail(e.target.value)} placeholder="your@email.com" style={{ ...inputBase, flex: 1 }} />
            <button onClick={sendTest} disabled={testing || !testEmail.trim()} style={{ background: 'var(--surface)', border: '1px solid var(--border-light)', borderRadius: '8px', padding: '0 1.25rem', fontWeight: 700, fontSize: '0.875rem', color: 'var(--text-2)', cursor: testing ? 'wait' : 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}>
              {testing ? 'Sending…' : 'Send Test'}
            </button>
          </div>
          {testMsg && <p style={{ fontSize: '0.8rem', marginTop: '0.5rem', color: testMsg.startsWith('✓') ? 'var(--green)' : 'var(--terracotta)', fontWeight: 600 }}>{testMsg}</p>}
        </div>

        {/* Send button */}
        {sendMsg && (
          <p style={{ fontSize: '0.875rem', color: sendMsg.startsWith('✓') ? 'var(--green)' : 'var(--terracotta)', fontWeight: 600, marginBottom: '0.75rem' }}>{sendMsg}</p>
        )}
        <button
          onClick={send}
          disabled={!reviewed || sending}
          style={{
            width: '100%', padding: '0.875rem',
            background: reviewed && !sending ? 'var(--navy)' : 'var(--border-light)',
            color: reviewed && !sending ? 'white' : 'var(--text-3)',
            border: 'none', borderRadius: '8px', fontWeight: 700, fontSize: '0.95rem',
            cursor: reviewed && !sending ? 'pointer' : 'not-allowed',
            transition: 'all 0.15s',
          }}
        >
          {sending ? 'Sending…' : `Send to ${activeCount} Subscriber${activeCount !== 1 ? 's' : ''} →`}
        </button>
      </div>
    </div>
  )
}
