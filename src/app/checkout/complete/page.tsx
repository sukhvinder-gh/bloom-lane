'use client'
import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { getStripe } from '@/lib/stripe/client'

// Stripe's redirect return_url for payment methods that require leaving the
// page (most card payments never hit this — they resolve inline via
// redirect: 'if_required' in StripePaymentForm). Stripe appends
// payment_intent_client_secret to the URL itself; we just read it back and
// check the final status before sending the buyer on to their order.
function CheckoutCompleteInner() {
  const router = useRouter()
  const params = useSearchParams()
  const [status, setStatus] = useState<'checking' | 'ok' | 'failed'>('checking')
  const [message, setMessage] = useState('')

  useEffect(() => {
    const orderId = params.get('order_id')
    const clientSecret = params.get('payment_intent_client_secret')

    if (!clientSecret || !orderId) {
      setStatus('failed')
      setMessage('Missing payment details — please contact support if you were charged.')
      return
    }

    getStripe().then(async stripe => {
      if (!stripe) { setStatus('failed'); setMessage('Could not verify payment.'); return }
      const { paymentIntent } = await stripe.retrievePaymentIntent(clientSecret)
      if (paymentIntent?.status === 'succeeded' || paymentIntent?.status === 'processing') {
        setStatus('ok')
        router.replace(`/dashboard/buyer/orders/${orderId}?new=true`)
      } else {
        setStatus('failed')
        setMessage('Your payment was not completed. Please try again from your cart.')
      }
    })
  }, [params, router])

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--cream)', padding: '2rem' }}>
      <div className="card reveal" style={{ padding: '3rem', textAlign: 'center', maxWidth: '26rem' }}>
        {status === 'checking' && <p style={{ color: 'var(--forest)' }}>Confirming your payment…</p>}
        {status === 'ok' && <p style={{ color: 'var(--forest)' }}>Payment confirmed — redirecting…</p>}
        {status === 'failed' && (
          <>
            <p style={{ color: 'var(--forest)', fontWeight: 700, marginBottom: '0.75rem' }}>Payment not completed</p>
            <p style={{ color: 'var(--moss)', fontSize: '0.9rem' }}>{message}</p>
          </>
        )}
      </div>
    </div>
  )
}

export default function CheckoutCompletePage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', background: 'var(--cream)' }} />}>
      <CheckoutCompleteInner />
    </Suspense>
  )
}
