'use client'
import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { Elements } from '@stripe/react-stripe-js'
import { getStripe } from '@/lib/stripe/client'
import { STRIPE_APPEARANCE } from '@/lib/stripe/appearance'
import StripePaymentForm from '@/components/StripePaymentForm'
import SingleImageUpload from '@/components/SingleImageUpload'
import AddressAutocompleteInput from '@/components/AddressAutocompleteInput'

const STATUS_LABEL: Record<string, { label: string; bg: string; color: string }> = {
  pending:  { label: '⏳ Awaiting admin approval', bg: '#FEF3C7', color: '#92400E' },
  active:   { label: '✓ Active — growers can join', bg: '#D1FAE5', color: '#065F46' },
  inactive: { label: 'Inactive', bg: '#F1EFE8', color: '#5F5E5A' },
}

type PickupWindow = { day: string; open: string; close: string }
type Hub = {
  id: string; name: string; region: string | null; status: string
  stripe_account_id?: string | null; stripe_onboarding_complete?: boolean
  logo_url?: string | null; banner_url?: string | null
  pickup_venue_name?: string | null
  pickup_address?: string | null; pickup_suburb?: string | null
  pickup_state?: string | null; pickup_postcode?: string | null
  pickup_windows?: PickupWindow[] | null
}
type Sub = { status: string; amount_cents: number } | null
type Member = {
  id: string
  business_name: string | null
  profiles: { full_name: string | null; email: string | null } | null
  subscriptions: { status: string; plan: string; expires_at: string | null }[]
}

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']

function CollectionPointEditor({ hub, onSaved }: { hub: Hub; onSaved: (hub: Hub) => void }) {
  const [venueName, setVenueName] = useState(hub.pickup_venue_name ?? '')
  const [address,  setAddress]  = useState(hub.pickup_address  ?? '')
  const [suburb,   setSuburb]   = useState(hub.pickup_suburb   ?? '')
  const [state,    setState]    = useState(hub.pickup_state    ?? '')
  const [postcode, setPostcode] = useState(hub.pickup_postcode ?? '')
  const [windows, setWindows] = useState<PickupWindow[]>(hub.pickup_windows ?? [])
  const updateWindow = (i: number, patch: Partial<PickupWindow>) =>
    setWindows(ws => ws.map((w, idx) => idx === i ? { ...w, ...patch } : w))
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  async function save() {
    setSaving(true); setMsg(null)
    const res = await fetch('/api/coordinator/hub', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        hub_id: hub.id,
        pickup_venue_name: venueName,
        pickup_address: address, pickup_suburb: suburb, pickup_state: state, pickup_postcode: postcode,
        pickup_windows: windows,
      }),
    })
    const data = await res.json()
    if (!res.ok) { setMsg({ type: 'err', text: data.error || 'Could not save' }); setSaving(false); return }
    onSaved(data.hub)
    setMsg({ type: 'ok', text: 'Saved' })
    setSaving(false)
  }

  return (
    <div className="card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
      <div>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.05rem', color: 'var(--forest)', marginBottom: '0.25rem' }}>Collection Point</h2>
        <p style={{ fontSize: '0.8rem', color: 'var(--moss)' }}>
          Where growers drop off and buyers collect, and when — this is what growers and buyers see once they pick your hub as a pickup location.
        </p>
      </div>

      <div>
        <label className="type-label-sm" style={{ display: 'block', color: 'var(--moss)', marginBottom: '0.3rem' }}>Pickup address</label>
        <input className="input" value={venueName} onChange={e => setVenueName(e.target.value)}
          placeholder="Building or shop name (optional), e.g. Community Hall" style={{ width: '100%', marginBottom: '0.6rem' }} />
        <AddressAutocompleteInput className="input" placeholder="Street address" value={address}
          onChange={setAddress}
          onSelect={({ address: a, suburb, state: s, postcode: p }) => {
            setAddress(a)
            if (suburb) setSuburb(suburb)
            if (s) setState(s)
            if (p) setPostcode(p)
          }}
          style={{ width: '100%', marginBottom: '0.6rem' }} />
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '0.6rem' }}>
          <input className="input" value={suburb} onChange={e => setSuburb(e.target.value)} placeholder="Suburb" />
          <input className="input" value={state} onChange={e => setState(e.target.value)} placeholder="State" />
          <input className="input" value={postcode} onChange={e => setPostcode(e.target.value)} placeholder="Postcode" />
        </div>
      </div>

      <div>
        <label className="type-label-sm" style={{ display: 'block', color: 'var(--moss)', marginBottom: '0.3rem' }}>Collection schedule</label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
          {windows.map((w, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr auto', gap: '0.6rem', alignItems: 'center' }}>
              <select className="input" value={w.day} onChange={e => updateWindow(i, { day: e.target.value })} required>
                <option value="">Day…</option>
                {DAYS.map(d => <option key={d} value={d}>{d[0].toUpperCase() + d.slice(1)}</option>)}
              </select>
              <input className="input" type="time" value={w.open} onChange={e => updateWindow(i, { open: e.target.value })} required aria-label="Opens" />
              <input className="input" type="time" value={w.close} onChange={e => updateWindow(i, { close: e.target.value })} required aria-label="Closes" />
              <button type="button" onClick={() => setWindows(ws => ws.filter((_, idx) => idx !== i))} aria-label="Remove window"
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#B91C1C', fontSize: '1rem', padding: '0.25rem 0.4rem' }}>✕</button>
            </div>
          ))}
          <button type="button" onClick={() => setWindows(ws => [...ws, { day: '', open: '08:00', close: '17:00' }])}
            className="btn btn-ghost btn-sm" style={{ alignSelf: 'flex-start' }}>
            + Add collection window
          </button>
        </div>
      </div>

      {msg && <Banner type={msg.type} text={msg.text} />}

      <button type="button" onClick={save} disabled={saving} className="btn btn-forest" style={{ alignSelf: 'flex-start', minWidth: '7.5rem' }}>
        {saving ? 'Saving…' : 'Save Collection Point'}
      </button>
    </div>
  )
}

type CollectionPointRequest = {
  id: string
  status: 'pending' | 'approved' | 'declined'
  created_at: string
  farmers: { business_name: string | null; email: string | null; region: string | null; suburb: string | null; state: string | null } | null
}

function CollectionPointRequestsCard({ hubId }: { hubId: string }) {
  const [requests, setRequests] = useState<CollectionPointRequest[]>([])
  const [loaded, setLoaded] = useState(false)
  const [decidingId, setDecidingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  function load() {
    fetch(`/api/coordinator/hub/requests?hub_id=${hubId}`).then(r => r.json()).then(data => {
      setRequests(data.data || [])
      setLoaded(true)
    }).catch(() => setLoaded(true))
  }

  useEffect(() => { load() }, [hubId])

  async function decide(optionId: string, status: 'approved' | 'declined') {
    setDecidingId(optionId); setError(null)
    const res = await fetch('/api/coordinator/hub/requests', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hub_id: hubId, option_id: optionId, status }),
    })
    const data = await res.json()
    if (!res.ok) { setError(data.error || 'Could not update this request'); setDecidingId(null); return }
    load()
    setDecidingId(null)
  }

  const pending = requests.filter(r => r.status === 'pending')
  const decided = requests.filter(r => r.status !== 'pending')

  const STATUS_PILL: Record<string, { label: string; bg: string; color: string }> = {
    approved: { label: '✓ Approved', bg: '#D1FAE5', color: '#065F46' },
    declined: { label: '✕ Declined', bg: '#FEE2E2', color: '#B91C1C' },
  }

  return (
    <div className="card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.05rem', color: 'var(--forest)' }}>Collection Point requests</h2>
        <p style={{ fontSize: '0.8rem', color: 'var(--moss)' }}>Growers who've picked you as their collection point — approve to let buyers choose it at checkout.</p>
      </div>

      {error && <Banner type="err" text={error} />}

      {!loaded ? (
        <p style={{ fontSize: '0.85rem', color: 'var(--moss)' }}>Loading…</p>
      ) : requests.length === 0 ? (
        <p style={{ fontSize: '0.85rem', color: 'var(--moss)' }}>No growers have requested this hub yet.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
          {pending.map(r => (
            <div key={r.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', padding: '0.75rem 1rem', background: '#FEF3C7', borderRadius: '0.75rem', flexWrap: 'wrap' }}>
              <div>
                <p style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--forest)' }}>{r.farmers?.business_name || 'Grower'}</p>
                <p style={{ fontSize: '0.75rem', color: 'var(--moss)' }}>{[r.farmers?.suburb, r.farmers?.state].filter(Boolean).join(', ') || r.farmers?.region}</p>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button type="button" onClick={() => decide(r.id, 'approved')} disabled={decidingId === r.id} className="btn btn-forest btn-sm">
                  {decidingId === r.id ? '…' : 'Approve'}
                </button>
                <button type="button" onClick={() => decide(r.id, 'declined')} disabled={decidingId === r.id} className="btn btn-ghost btn-sm">
                  Decline
                </button>
              </div>
            </div>
          ))}
          {decided.map(r => {
            const s = STATUS_PILL[r.status]
            return (
              <div key={r.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', padding: '0.75rem 1rem', background: 'var(--olive)', borderRadius: '0.75rem', flexWrap: 'wrap' }}>
                <div>
                  <p style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--forest)' }}>{r.farmers?.business_name || 'Grower'}</p>
                  <p style={{ fontSize: '0.75rem', color: 'var(--moss)' }}>{[r.farmers?.suburb, r.farmers?.state].filter(Boolean).join(', ') || r.farmers?.region}</p>
                </div>
                <span style={{ padding: '0.3rem 0.75rem', borderRadius: '99px', fontSize: '0.75rem', fontWeight: 700, background: s.bg, color: s.color, whiteSpace: 'nowrap' }}>{s.label}</span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function NotifyHubCard({ hubId }: { hubId: string }) {
  const [open, setOpen] = useState(false)
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  async function send() {
    setSending(true); setResult(null)
    const res = await fetch('/api/coordinator/hub/notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hub_id: hubId, subject, message }),
    })
    const data = await res.json()
    if (!res.ok) {
      setResult({ type: 'err', text: data.error || 'Could not send' })
    } else if (data.sent === 0 && data.recipients === 0) {
      setResult({ type: 'ok', text: 'No growers or buyers to notify yet.' })
    } else {
      setResult({ type: 'ok', text: `Sent to ${data.sent} of ${data.recipients} recipients.` })
      setSubject(''); setMessage('')
    }
    setSending(false)
  }

  return (
    <div className="card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.05rem', color: 'var(--forest)' }}>Notify my hub</h2>
          <p style={{ fontSize: '0.8rem', color: 'var(--moss)' }}>Reaches growers using this as their collection point, and buyers with an order still awaiting collection.</p>
        </div>
        <button type="button" onClick={() => setOpen(o => !o)} className="btn btn-ghost btn-sm">{open ? 'Cancel' : 'Compose'}</button>
      </div>
      {open && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
          <input className="input" value={subject} onChange={e => setSubject(e.target.value)} placeholder="Subject" style={{ width: '100%' }} />
          <textarea className="input" value={message} onChange={e => setMessage(e.target.value)} placeholder="Message" rows={4} style={{ width: '100%', resize: 'vertical' }} />
          {result && <Banner type={result.type} text={result.text} />}
          <button type="button" onClick={send} disabled={sending || !subject.trim() || !message.trim()} className="btn btn-forest" style={{ alignSelf: 'flex-start', minWidth: '7.5rem' }}>
            {sending ? 'Sending…' : 'Send'}
          </button>
        </div>
      )}
    </div>
  )
}

function Banner({ type, text }: { type: 'ok' | 'err'; text: string }) {
  return (
    <div style={{ padding: '0.875rem 1rem', borderRadius: '0.75rem', background: type === 'ok' ? '#D1FAE5' : '#FEE2E2', color: type === 'ok' ? '#065F46' : '#B91C1C', fontSize: '0.85rem', fontWeight: 600 }}>
      {type === 'ok' ? '✓' : '⚠'} {text}
    </div>
  )
}

export default function CoordinatorHubRegisterPage() {
  const searchParams = useSearchParams()
  const [loading, setLoading] = useState(true)
  const [hubs, setHubs]       = useState<Hub[]>([])
  const [sub, setSub]         = useState<Sub>(null)

  const [name, setName]     = useState('')
  const [region, setRegion] = useState('')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg]       = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  useEffect(() => {
    if (searchParams.get('stripe_error') !== '1') return
    const detail = searchParams.get('stripe_error_msg')
    setMsg({ type: 'err', text: detail ? `Something went wrong setting up Stripe: ${detail}` : 'Something went wrong setting up Stripe. Please try again, or contact support if it keeps happening.' })
  }, [searchParams])
  const [payment, setPayment] = useState<{ clientSecret: string; feeCents: number } | null>(null)
  const [resuming, setResuming] = useState(false)
  const [members, setMembers] = useState<Member[]>([])
  const [membersLoaded, setMembersLoaded] = useState(false)

  function loadStatus() {
    return fetch('/api/coordinator/hub').then(r => r.json()).then(data => {
      setHubs(data.hubs || [])
      setSub(data.subscription || null)
    }).catch(() => {})
  }

  async function updateHubImage(hubId: string, field: 'logo_url' | 'banner_url', url: string | null) {
    setHubs(hs => hs.map(h => h.id === hubId ? { ...h, [field]: url } : h))
    await fetch('/api/coordinator/hub', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hub_id: hubId, [field]: url }),
    }).catch(() => {})
  }

  useEffect(() => { loadStatus().finally(() => setLoading(false)) }, [])

  const hasActiveHub = hubs.some(h => h.status === 'active')
  useEffect(() => {
    if (!hasActiveHub) return
    fetch('/api/coordinator/hub/members').then(r => r.json()).then(data => {
      setMembers(data.data || [])
      setMembersLoaded(true)
    }).catch(() => setMembersLoaded(true))
  }, [hasActiveHub])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true); setMsg(null)
    const res = await fetch('/api/coordinator/hub', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, region }),
    })
    const data = await res.json()
    if (!res.ok) {
      setMsg({ type: 'err', text: data.error || 'Something went wrong' })
      setSaving(false)
      return
    }
    await loadStatus()
    if (data.requiresPayment) {
      if (data.client_secret) {
        setPayment({ clientSecret: data.client_secret, feeCents: data.fee_cents || 0 })
      } else {
        setMsg({ type: 'err', text: 'Your hub was registered, but we couldn’t start the payment. Please contact us and we’ll sort it out.' })
      }
    } else {
      setMsg({ type: 'ok', text: `Hub "${name}" has been submitted for approval. An admin will review it and you'll get an email once it's active.` })
    }
    setSaving(false)
  }

  async function resumePayment() {
    setResuming(true); setMsg(null)
    const res = await fetch('/api/coordinator/hub/pay', { method: 'POST' })
    const data = await res.json()
    if (!res.ok) {
      setMsg({ type: 'err', text: data.error || 'Could not start payment. Please try again.' })
      setResuming(false)
      return
    }
    setPayment({ clientSecret: data.client_secret, feeCents: data.amount_cents || 0 })
    setResuming(false)
  }

  async function handlePaymentSuccess() {
    const piId = payment?.clientSecret.split('_secret_')[0]
    setPayment(null)
    if (piId) await fetch('/api/coordinator/hub/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ payment_intent_id: piId }),
    }).catch(() => null)
    await loadStatus()
    setMsg({ type: 'ok', text: 'Payment received. Thank you!' })
  }

  const feeLabel = payment ? `$${(payment.feeCents / 100).toFixed(2)}` : ''
  const pendingPayment = sub?.status === 'pending' && (sub.amount_cents || 0) > 0

  if (loading) return (
    <div className="page-pad" style={{ padding: '2.5rem', maxWidth: '44rem', color: 'var(--moss)' }}>Loading…</div>
  )

  return (
    <div className="page-pad" style={{ padding: '2.5rem', maxWidth: '44rem' }}>
      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', color: 'var(--forest)', marginBottom: '0.25rem' }}>Register a Hub / Collective</h1>
      <p style={{ fontSize: '0.875rem', color: 'var(--moss)', marginBottom: '2rem' }}>
        Register your growing collective. Once approved, growers can join your hub.
      </p>

      {hubs.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {hubs.map(hub => {
            const s = STATUS_LABEL[hub.status] || STATUS_LABEL.inactive
            return (
              <div key={hub.id} className="card" style={{ padding: '1.25rem 1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
                <div>
                  <p style={{ fontWeight: 700, color: 'var(--forest)' }}>{hub.name}</p>
                  {hub.region && <p style={{ fontSize: '0.8rem', color: 'var(--moss)' }}>{hub.region}</p>}
                </div>
                <span style={{ padding: '0.3rem 0.75rem', borderRadius: '99px', fontSize: '0.75rem', fontWeight: 700, background: s.bg, color: s.color, whiteSpace: 'nowrap' }}>{s.label}</span>
              </div>
            )
          })}

          {pendingPayment && (
            payment ? (
              <div className="card-forest" style={{ padding: '1.75rem' }}>
                <p style={{ color: 'var(--cream)', fontWeight: 700, marginBottom: '1.25rem' }}>Pay the {feeLabel} registration fee</p>
                <Elements stripe={getStripe()} options={{ clientSecret: payment.clientSecret, appearance: STRIPE_APPEARANCE }}>
                  <StripePaymentForm
                    amountLabel={`Pay ${feeLabel}`}
                    returnUrl={`${typeof window !== 'undefined' ? window.location.origin : ''}/dashboard/coordinator/hub/register`}
                    onSuccess={handlePaymentSuccess}
                  />
                </Elements>
              </div>
            ) : (
              <div className="card-forest" style={{ padding: '1.75rem' }}>
                <p style={{ color: 'var(--cream)', fontWeight: 700, marginBottom: '0.375rem' }}>Payment required to activate</p>
                <p style={{ color: 'var(--sage)', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
                  Pay ${((sub!.amount_cents || 0) / 100).toFixed(2)} to finish registering your hub.
                </p>
                <button onClick={resumePayment} disabled={resuming} className="btn btn-cream" style={{ width: '100%' }}>
                  {resuming ? 'Loading payment form…' : `Pay $${((sub!.amount_cents || 0) / 100).toFixed(2)} now`}
                </button>
              </div>
            )
          )}

          {msg && <Banner type={msg.type} text={msg.text} />}

          {hasActiveHub && (() => {
            const activeHub = hubs.find(h => h.status === 'active')!
            return (
              <div className="card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.05rem', color: 'var(--forest)' }}>Hub Photo</h2>
                <SingleImageUpload
                  label="Logo"
                  shape="square"
                  url={activeHub.logo_url ?? null}
                  onChange={url => updateHubImage(activeHub.id, 'logo_url', url)}
                />
                <SingleImageUpload
                  label="Hub Photo"
                  shape="wide"
                  url={activeHub.banner_url ?? null}
                  onChange={url => updateHubImage(activeHub.id, 'banner_url', url)}
                />
              </div>
            )
          })()}

          {hasActiveHub && (() => {
            const activeHub = hubs.find(h => h.status === 'active')!
            return (
              <>
                <CollectionPointEditor
                  hub={activeHub}
                  onSaved={updated => setHubs(hs => hs.map(h => h.id === updated.id ? updated : h))}
                />
                <CollectionPointRequestsCard hubId={activeHub.id} />
                <NotifyHubCard hubId={activeHub.id} />
              </>
            )
          })()}

          {/* One payout section per active hub — a coordinator running more
              than one hub needs to connect Stripe for each individually;
              this used to only ever operate on whichever hub they created
              most recently, leaving every other hub of theirs permanently
              stuck unable to connect at all. */}
          {hubs.filter(h => h.status === 'active').map(activeHub => (
            activeHub.stripe_onboarding_complete ? (
              <div key={activeHub.id} style={{ padding: '0.875rem 1rem', background: '#D1FAE5', borderRadius: '0.75rem', fontSize: '0.85rem', color: '#065F46', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
                <span>✓ {hubs.filter(h => h.status === 'active').length > 1 ? `${activeHub.name}: ` : ''}Payout account connected — growers in this hub are paid out to your hub's account, not directly to them.</span>
                <a href={`/api/coordinator/stripe/onboarding?hub_id=${activeHub.id}`}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', background: 'white', border: '1px solid #6EE7B7', color: '#065F46', padding: '0.4rem 1rem', borderRadius: '99px', textDecoration: 'none', fontSize: '0.78rem', fontWeight: 700, flexShrink: 0 }}>
                  Update bank details →
                </a>
              </div>
            ) : (
              <div key={activeHub.id} className="card" style={{ padding: '1.5rem' }}>
                <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.05rem', color: 'var(--forest)', marginBottom: '0.375rem' }}>
                  Connect a payout account{hubs.filter(h => h.status === 'active').length > 1 ? ` — ${activeHub.name}` : ''}
                </h2>
                <p style={{ fontSize: '0.85rem', color: 'var(--moss)', marginBottom: '1.25rem', lineHeight: 1.6 }}>
                  Growers in this hub are paid directly by default. Connect this hub's own Stripe account and their payouts come to it instead, so you can distribute them yourselves.
                </p>
                <a href={`/api/coordinator/stripe/onboarding?hub_id=${activeHub.id}`} className="btn btn-forest" style={{ width: '100%', display: 'inline-flex', justifyContent: 'center' }}>
                  {activeHub.stripe_account_id ? 'Continue Setup' : 'Connect Payout Account'}
                </a>
              </div>
            )
          ))}

          {hasActiveHub && (
            <div className="card" style={{ padding: '1.5rem' }}>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.15rem', color: 'var(--forest)', marginBottom: '0.25rem' }}>Growers in your hub</h2>
              <p style={{ fontSize: '0.8rem', color: 'var(--moss)', marginBottom: '1.25rem' }}>
                Growers join by selecting Hub Membership and picking your hub on their Membership page — there's nothing for you to approve.
              </p>
              {!membersLoaded ? (
                <p style={{ fontSize: '0.85rem', color: 'var(--moss)' }}>Loading…</p>
              ) : members.length === 0 ? (
                <p style={{ fontSize: '0.85rem', color: 'var(--moss)' }}>No growers have joined yet.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
                  {members.map(m => {
                    const activeSub = m.subscriptions?.find(s => s.status === 'active')
                    return (
                      <div key={m.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', padding: '0.75rem 1rem', background: 'var(--olive)', borderRadius: '0.75rem' }}>
                        <div>
                          <p style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--forest)' }}>{m.business_name || m.profiles?.full_name || 'Grower'}</p>
                          <p style={{ fontSize: '0.75rem', color: 'var(--moss)' }}>{m.profiles?.email}</p>
                        </div>
                        <span style={{ fontSize: '0.75rem', color: 'var(--moss)', whiteSpace: 'nowrap' }}>
                          {activeSub ? `Active · renews ${activeSub.expires_at ? new Date(activeSub.expires_at).toLocaleDateString('en-AU') : '—'}` : 'No active membership'}
                        </span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
            <div>
              <label className="type-label-sm" style={{ display: 'block', color: 'var(--moss)', marginBottom: '0.3rem' }}>Hub / Collective Name *</label>
              <input className="input" value={name} onChange={e => setName(e.target.value)} required placeholder="e.g. Yarra Valley Growers Collective" style={{ width: '100%' }} />
            </div>
            <div>
              <label className="type-label-sm" style={{ display: 'block', color: 'var(--moss)', marginBottom: '0.3rem' }}>Region</label>
              <input className="input" value={region} onChange={e => setRegion(e.target.value)} placeholder="e.g. Yarra Valley, VIC" style={{ width: '100%' }} />
            </div>
          </div>

          <div style={{ padding: '0.875rem 1rem', background: 'var(--olive)', borderRadius: '0.75rem', fontSize: '0.8rem', color: 'var(--moss)' }}>
            <p>After registration, The Green Guild admin will review and activate your hub. You will be notified by email once approved.</p>
          </div>

          {msg && <Banner type={msg.type} text={msg.text} />}

          <button type="submit" disabled={saving || !name.trim()} className="btn btn-forest" style={{ padding: '0.875rem', borderRadius: '0.875rem' }}>
            {saving ? 'Registering…' : 'Register Hub'}
          </button>
        </form>
      )}
    </div>
  )
}
