'use client'
import { useState, useEffect, useRef } from 'react'

type Message = {
  id: string
  sender_id: string
  sender_role: 'buyer' | 'farmer' | 'admin'
  body: string
  created_at: string
  profiles?: { full_name?: string }
}

const ROLE_LABEL: Record<Message['sender_role'], string> = {
  buyer: 'Buyer',
  farmer: 'Grower',
  admin: 'Admin',
}

export default function MessageThread({ purchaseOrderId, title }: { purchaseOrderId: string; title?: string }) {
  const [messages, setMessages] = useState<Message[]>([])
  const [viewerRole, setViewerRole] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetch(`/api/purchase-orders/${purchaseOrderId}/messages`)
      .then(r => r.json())
      .then(d => { setMessages(d.data || []); setViewerRole(d.viewer_role || null); setLoading(false) })
  }, [purchaseOrderId])

  useEffect(() => { bottomRef.current?.scrollIntoView({ block: 'nearest' }) }, [messages.length])

  async function send() {
    if (!draft.trim()) return
    setSending(true)
    setError('')
    const res = await fetch(`/api/purchase-orders/${purchaseOrderId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body: draft.trim() }),
    })
    const result = await res.json()
    if (!res.ok) {
      setError(result.error?.message || result.error || 'Message failed to send')
      setSending(false)
      return
    }
    setMessages(m => [...m, result.data])
    setDraft('')
    setSending(false)
  }

  return (
    <div className="card reveal" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {title && <h3 className="type-label-lg" style={{ color: 'var(--forest)' }}>{title}</h3>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem', maxHeight: '18rem', overflowY: 'auto', padding: '0.25rem' }}>
        {loading ? (
          <p className="type-label-sm" style={{ color: 'var(--moss)' }}>Loading messages…</p>
        ) : messages.length === 0 ? (
          <p className="type-label-sm" style={{ color: 'var(--moss)' }}>No messages yet — questions about this order go here instead of DMs or texts.</p>
        ) : (
          messages.map(m => {
            const mine = m.sender_role === viewerRole
            return (
              <div key={m.id} style={{ display: 'flex', justifyContent: mine ? 'flex-end' : 'flex-start' }}>
                <div style={{
                  maxWidth: '80%',
                  background: mine ? 'var(--forest)' : 'var(--olive)',
                  color: mine ? 'white' : 'var(--forest)',
                  borderRadius: '1rem',
                  padding: '0.625rem 0.875rem',
                }}>
                  <p style={{ fontSize: '0.7rem', opacity: 0.75, marginBottom: '0.2rem', fontWeight: 700 }}>
                    {m.profiles?.full_name || ROLE_LABEL[m.sender_role]}
                  </p>
                  <p style={{ fontSize: '0.85rem', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{m.body}</p>
                </div>
              </div>
            )
          })
        )}
        <div ref={bottomRef} />
      </div>

      {error && <p style={{ color: 'var(--bloom)', fontSize: '0.78rem' }}>{error}</p>}

      <div style={{ display: 'flex', gap: '0.625rem' }}>
        <input
          className="input"
          placeholder="Write a message…"
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !sending) send() }}
          maxLength={2000}
        />
        <button className="btn btn-forest btn-sm" disabled={sending || !draft.trim()} onClick={send}>
          {sending ? '…' : 'Send'}
        </button>
      </div>
    </div>
  )
}
