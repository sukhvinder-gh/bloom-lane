'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

interface Props {
  campaignId?: string
  initialSubject?: string
  initialBody?: string
  adminEmail?: string
}

export default function CampaignForm({ campaignId, initialSubject = '', initialBody = '', adminEmail = '' }: Props) {
  const router = useRouter()
  const isEdit = !!campaignId

  const [subject, setSubject] = useState(initialSubject)
  const [body, setBody] = useState(initialBody)
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState('')
  const [testEmail, setTestEmail] = useState(adminEmail)
  const [testing, setTesting] = useState(false)
  const [testMsg, setTestMsg] = useState('')

  async function saveDraft() {
    setSaving(true)
    setSaveMsg('')
    try {
      const url = isEdit ? `/api/admin/campaigns/${campaignId}` : '/api/admin/campaigns'
      const method = isEdit ? 'PATCH' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject, body }),
      })
      if (res.ok) {
        router.push('/dashboard/admin/campaigns')
      } else {
        const d = await res.json()
        setSaveMsg(d.error || 'Failed to save')
      }
    } catch {
      setSaveMsg('Network error')
    } finally {
      setSaving(false)
    }
  }

  async function sendTest() {
    if (!testEmail.trim()) return
    setTesting(true)
    setTestMsg('')
    try {
      const res = await fetch('/api/admin/campaigns/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject: subject || '(No subject)', body: body || '(No body)', to: testEmail }),
      })
      const d = await res.json()
      setTestMsg(res.ok ? '✓ Test email sent' : `⚠ ${d.error || 'Failed'}`)
    } catch {
      setTestMsg('⚠ Network error')
    } finally {
      setTesting(false)
    }
  }

  const fieldLabel: React.CSSProperties = { display: 'block', fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-3)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.1em' }
  const inputBase: React.CSSProperties = { width: '100%', boxSizing: 'border-box', padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid var(--border-light)', fontSize: '0.9rem', color: 'var(--text-1)', background: 'var(--bg)', outline: 'none', fontFamily: 'inherit' }

  return (
    <div style={{ padding: '2rem 2.5rem', maxWidth: '680px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
        <Link href="/dashboard/admin/campaigns" style={{ color: 'var(--text-3)', textDecoration: 'none', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
          ← Back
        </Link>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.75rem', fontWeight: 700, color: 'var(--navy)', flex: 1 }}>
          {isEdit ? 'Edit Campaign' : 'New Campaign'}
        </h1>
        <span style={{ background: 'var(--amber-soft)', color: 'var(--amber-new)', fontSize: '0.72rem', fontWeight: 700, padding: '0.25rem 0.75rem', borderRadius: '99px' }}>Draft</span>
      </div>

      <div style={{ background: 'var(--surface)', border: '1px solid var(--border-light)', borderRadius: '12px', padding: '1.75rem' }}>
        {/* Subject */}
        <div style={{ marginBottom: '1.5rem' }}>
          <label style={fieldLabel}>Email Subject</label>
          <input
            type="text"
            value={subject}
            onChange={e => setSubject(e.target.value)}
            placeholder="e.g. Exclusive Autumn Offer — Fresh Blooms Available Now"
            style={inputBase}
          />
        </div>

        {/* Body */}
        <div style={{ marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <label style={{ ...fieldLabel, marginBottom: 0 }}>Message Body</label>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-3)' }}>{body.length} chars</span>
          </div>
          <textarea
            value={body}
            onChange={e => setBody(e.target.value)}
            rows={12}
            placeholder={`Hi there,\n\nWe're excited to share something special with you...\n\nUse double line breaks between paragraphs.\n\nWarm regards,\nThe Green Guild Team`}
            style={{ ...inputBase, resize: 'vertical', lineHeight: 1.7 }}
          />
          <p style={{ fontSize: '0.72rem', color: 'var(--text-3)', marginTop: '0.375rem' }}>
            Double line break = new paragraph. Single = line break.
          </p>
        </div>

        {/* Send test */}
        <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: '1.5rem', marginBottom: '1.5rem' }}>
          <label style={fieldLabel}>Send Test Email</label>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <input
              type="email"
              value={testEmail}
              onChange={e => setTestEmail(e.target.value)}
              placeholder="your@email.com"
              style={{ ...inputBase, flex: 1 }}
            />
            <button
              onClick={sendTest}
              disabled={testing || !testEmail.trim()}
              style={{ background: 'var(--surface)', border: '1px solid var(--border-light)', borderRadius: '8px', padding: '0 1.25rem', fontWeight: 700, fontSize: '0.875rem', color: 'var(--text-2)', cursor: testing ? 'wait' : 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}
            >
              {testing ? 'Sending…' : 'Send Test'}
            </button>
          </div>
          {testMsg && (
            <p style={{ fontSize: '0.8rem', marginTop: '0.5rem', color: testMsg.startsWith('✓') ? 'var(--green)' : 'var(--terracotta)', fontWeight: 600 }}>{testMsg}</p>
          )}
          <p style={{ fontSize: '0.72rem', color: 'var(--text-3)', marginTop: '0.5rem' }}>
            Send a preview to yourself before saving the draft.
          </p>
        </div>

        {/* Save */}
        <div>
          {saveMsg && <p style={{ fontSize: '0.8rem', color: 'var(--terracotta)', marginBottom: '0.75rem', fontWeight: 600 }}>{saveMsg}</p>}
          <button
            onClick={saveDraft}
            disabled={saving}
            style={{ background: 'var(--navy)', color: 'white', border: 'none', borderRadius: '8px', padding: '0.75rem 1.75rem', fontWeight: 700, fontSize: '0.875rem', cursor: saving ? 'wait' : 'pointer', opacity: saving ? 0.7 : 1 }}
          >
            {saving ? 'Saving…' : isEdit ? 'Update Draft' : 'Save Draft'}
          </button>
          <p style={{ fontSize: '0.72rem', color: 'var(--text-3)', marginTop: '0.625rem' }}>
            After saving, use <strong>Send Now →</strong> from the campaigns list to review and send.
          </p>
        </div>
      </div>
    </div>
  )
}
