'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'

type Campaign = {
  id: string
  subject: string
  body: string
  status: 'draft' | 'sent'
  sent_at: string | null
  recipient_count: number | null
  created_at: string
}

export default function CampaignsContent() {
  const [activeCount, setActiveCount] = useState<number | null>(null)
  const [sentCount, setSentCount] = useState<number | null>(null)
  const [draftCount, setDraftCount] = useState<number | null>(null)
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState<string | null>(null)

  async function load() {
    try {
      const res = await fetch('/api/admin/campaigns')
      const data = await res.json()
      setActiveCount(data.activeCount ?? 0)
      setSentCount(data.sentCount ?? 0)
      setDraftCount(data.draftCount ?? 0)
      setCampaigns(data.campaigns ?? [])
    } catch { /* silent */ } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  async function deleteCampaign(id: string, subject: string) {
    if (!confirm(`Delete "${subject}"?`)) return
    setDeleting(id)
    await fetch(`/api/admin/campaigns/${id}`, { method: 'DELETE' })
    setCampaigns(cs => cs.filter(c => c.id !== id))
    setDraftCount(n => (n ?? 1) - 1)
    setDeleting(null)
  }

  function fmtDate(iso: string) {
    return new Date(iso).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Australia/Sydney' })
  }

  return (
    <div style={{ padding: '2rem 2.5rem', maxWidth: '1100px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '2rem', gap: '1rem', flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.75rem', fontWeight: 700, color: 'var(--navy)', marginBottom: '0.25rem' }}>Campaigns</h1>
          <p style={{ color: 'var(--text-3)', fontSize: '0.875rem' }}>
            Send newsletters and offers to your {loading ? '…' : activeCount} active subscribers
          </p>
        </div>
        <Link
          href="/dashboard/admin/campaigns/new"
          style={{ background: 'var(--navy)', color: 'white', textDecoration: 'none', padding: '0.625rem 1.25rem', borderRadius: '8px', fontWeight: 700, fontSize: '0.875rem', flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
        >
          + New Campaign
        </Link>
      </div>

      {/* Stats */}
      <div className="mg-stack" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '2rem' }}>
        {[
          { label: 'Active Subscribers', value: activeCount },
          { label: 'Sent', value: sentCount },
          { label: 'Drafts', value: draftCount },
        ].map(s => (
          <div key={s.label} style={{ background: 'var(--surface)', border: '1px solid var(--border-light)', borderRadius: '12px', padding: '1.25rem 1.5rem', textAlign: 'center' }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', fontWeight: 700, color: s.label === 'Drafts' ? 'var(--amber-new)' : s.label === 'Sent' ? 'var(--green)' : 'var(--navy)', lineHeight: 1 }}>
              {loading ? '—' : (s.value ?? 0)}
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-3)', marginTop: '0.375rem' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Campaign table */}
      {loading ? (
        <p style={{ color: 'var(--text-3)', fontSize: '0.875rem' }}>Loading…</p>
      ) : campaigns.length === 0 ? (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border-light)', borderRadius: '12px', padding: '4rem', textAlign: 'center' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>📨</div>
          <p style={{ color: 'var(--text-2)', fontWeight: 600, marginBottom: '0.5rem' }}>No campaigns yet</p>
          <p style={{ color: 'var(--text-3)', fontSize: '0.875rem', marginBottom: '1.5rem' }}>Create your first newsletter campaign to get started.</p>
          <Link href="/dashboard/admin/campaigns/new" style={{ background: 'var(--navy)', color: 'white', textDecoration: 'none', padding: '0.625rem 1.25rem', borderRadius: '8px', fontWeight: 700, fontSize: '0.875rem' }}>
            + New Campaign
          </Link>
        </div>
      ) : (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border-light)', borderRadius: '12px', overflow: 'hidden' }}>
          <div className="table-wrap">
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-light)' }}>
                {['SUBJECT', 'STATUS', 'RECIPIENTS', 'DATE', ''].map(h => (
                  <th key={h} style={{ padding: '0.875rem 1.25rem', textAlign: h === 'RECIPIENTS' || h === 'DATE' ? 'center' : 'left', fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.1em', color: 'var(--text-3)', textTransform: 'uppercase' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {campaigns.map(c => (
                <tr key={c.id} style={{ borderBottom: '1px solid var(--border-light)' }}>
                  <td style={{ padding: '1rem 1.25rem', maxWidth: '320px' }}>
                    <span style={{ fontWeight: 600, color: 'var(--text-1)', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {c.subject || <em style={{ color: 'var(--text-3)' }}>No subject</em>}
                    </span>
                  </td>
                  <td style={{ padding: '1rem 1.25rem' }}>
                    <span style={{
                      display: 'inline-block',
                      padding: '0.2rem 0.625rem',
                      borderRadius: '99px',
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      background: c.status === 'sent' ? 'var(--green-soft)' : 'var(--amber-soft)',
                      color: c.status === 'sent' ? 'var(--green)' : 'var(--amber-new)',
                    }}>
                      {c.status === 'sent' ? 'Sent' : 'Draft'}
                    </span>
                  </td>
                  <td style={{ padding: '1rem 1.25rem', textAlign: 'center', color: c.recipient_count != null ? 'var(--text-1)' : 'var(--text-3)', fontWeight: c.recipient_count != null ? 600 : 400 }}>
                    {c.recipient_count != null ? c.recipient_count : '—'}
                  </td>
                  <td style={{ padding: '1rem 1.25rem', textAlign: 'center', color: 'var(--text-3)' }}>
                    {fmtDate(c.sent_at ?? c.created_at)}
                  </td>
                  <td style={{ padding: '1rem 1.25rem', whiteSpace: 'nowrap', textAlign: 'right' }}>
                    {c.status === 'draft' && (
                      <>
                        <Link href={`/dashboard/admin/campaigns/${c.id}/edit`} style={{ color: 'var(--navy)', textDecoration: 'none', fontWeight: 600, fontSize: '0.8rem', marginRight: '1rem' }}>
                          Edit
                        </Link>
                        <Link href={`/dashboard/admin/campaigns/${c.id}/send`} style={{ color: 'var(--green)', textDecoration: 'none', fontWeight: 700, fontSize: '0.8rem', marginRight: '1rem' }}>
                          Send Now →
                        </Link>
                        <button
                          onClick={() => deleteCampaign(c.id, c.subject)}
                          disabled={deleting === c.id}
                          style={{ color: 'var(--terracotta)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '0.8rem', padding: 0 }}
                        >
                          {deleting === c.id ? '…' : 'Delete'}
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      )}
    </div>
  )
}
