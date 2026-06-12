'use client'
import { useState, useEffect } from 'react'

type Campaign = {
  id: string
  subject: string
  sent_at: string
  recipient_count: number
}

export default function CampaignsContent() {
  const [activeCount, setActiveCount] = useState<number | null>(null)
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState('')
  const [loading, setLoading] = useState(true)

  async function load() {
    try {
      const res = await fetch('/api/admin/campaigns')
      const data = await res.json()
      setActiveCount(data.activeCount ?? 0)
      setCampaigns(data.campaigns ?? [])
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  async function handleSend() {
    if (!subject.trim() || !body.trim()) {
      setResult('Subject and body are required.')
      return
    }
    if (!confirm(`Send "${subject}" to ${activeCount} subscribers?`)) return
    setSending(true)
    setResult('')
    try {
      const res = await fetch('/api/admin/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject: subject.trim(), body: body.trim() }),
      })
      const data = await res.json()
      if (res.ok) {
        setResult(`✓ Sent to ${data.sent} subscriber${data.sent !== 1 ? 's' : ''}${data.failed > 0 ? ` (${data.failed} failed)` : ''}`)
        setSubject('')
        setBody('')
        load()
      } else {
        setResult(`⚠ ${data.error || 'Send failed'}`)
      }
    } catch {
      setResult('⚠ Network error. Please try again.')
    } finally {
      setSending(false)
    }
  }

  function fmtDate(iso: string) {
    return new Date(iso).toLocaleString('en-AU', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Australia/Sydney' })
  }

  return (
    <div style={{ padding: '2rem', maxWidth: '900px', margin: '0 auto' }}>
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', fontWeight: 700, color: 'var(--navy)', marginBottom: '0.25rem' }}>Campaigns</h1>
        <p style={{ color: 'var(--text-3)', fontSize: '0.875rem' }}>Send email campaigns to newsletter subscribers</p>
      </div>

      {/* Subscriber count */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border-light)', borderRadius: '12px', padding: '1.25rem 1.5rem', marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <div style={{ width: '2.5rem', height: '2.5rem', borderRadius: '10px', background: 'var(--bloom-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.25rem', flexShrink: 0 }}>📬</div>
        <div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', fontWeight: 700, color: 'var(--navy)', lineHeight: 1 }}>
            {loading ? '—' : activeCount?.toLocaleString()}
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-3)', marginTop: '0.15rem' }}>Active subscribers</div>
        </div>
      </div>

      {/* Compose */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border-light)', borderRadius: '12px', padding: '1.5rem', marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--navy)', marginBottom: '1.25rem' }}>Compose campaign</h2>
        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-2)', marginBottom: '0.375rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Subject line
          </label>
          <input
            type="text"
            value={subject}
            onChange={e => setSubject(e.target.value)}
            placeholder="This week's availability at The Green Guild 🌸"
            style={{
              width: '100%', boxSizing: 'border-box',
              padding: '0.75rem 1rem', borderRadius: '8px',
              border: '1px solid var(--border-light)', fontSize: '0.9rem',
              color: 'var(--text-1)', background: 'var(--bg)',
              outline: 'none',
            }}
          />
        </div>
        <div style={{ marginBottom: '1.25rem' }}>
          <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-2)', marginBottom: '0.375rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Body (one paragraph per line)
          </label>
          <textarea
            value={body}
            onChange={e => setBody(e.target.value)}
            rows={8}
            placeholder="Hi there,&#10;&#10;This week the market is packed with gorgeous spring blooms..."
            style={{
              width: '100%', boxSizing: 'border-box',
              padding: '0.75rem 1rem', borderRadius: '8px',
              border: '1px solid var(--border-light)', fontSize: '0.9rem',
              color: 'var(--text-1)', background: 'var(--bg)',
              outline: 'none', resize: 'vertical', lineHeight: 1.7,
              fontFamily: 'inherit',
            }}
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
          {result && (
            <span style={{ fontSize: '0.875rem', color: result.startsWith('✓') ? 'var(--green)' : 'var(--terracotta)', fontWeight: 600 }}>
              {result}
            </span>
          )}
          <button
            onClick={handleSend}
            disabled={sending || !subject.trim() || !body.trim()}
            style={{
              marginLeft: 'auto',
              background: sending || !subject.trim() || !body.trim() ? 'var(--border-light)' : 'var(--navy)',
              color: sending || !subject.trim() || !body.trim() ? 'var(--text-3)' : 'white',
              border: 'none', borderRadius: '8px',
              padding: '0.75rem 1.5rem', fontWeight: 700,
              fontSize: '0.875rem', cursor: sending ? 'wait' : 'pointer',
              transition: 'all 0.15s',
            }}
          >
            {sending ? 'Sending…' : `Send to ${activeCount ?? '…'} subscribers`}
          </button>
        </div>
      </div>

      {/* Campaign history */}
      <div>
        <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--navy)', marginBottom: '1rem' }}>Campaign history</h2>
        {loading ? (
          <p style={{ color: 'var(--text-3)', fontSize: '0.875rem' }}>Loading…</p>
        ) : campaigns.length === 0 ? (
          <p style={{ color: 'var(--text-3)', fontSize: '0.875rem' }}>No campaigns sent yet.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
            {campaigns.map(c => (
              <div key={c.id} style={{ background: 'var(--surface)', border: '1px solid var(--border-light)', borderRadius: '10px', padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.subject}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-3)', marginTop: '0.2rem' }}>{fmtDate(c.sent_at)}</div>
                </div>
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-2)', flexShrink: 0 }}>
                  {c.recipient_count} sent
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
