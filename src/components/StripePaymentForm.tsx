'use client'
import { useState } from 'react'
import { useStripe, useElements, PaymentElement } from '@stripe/react-stripe-js'

// Generic card entry + confirmation step — only ever mounted inside an
// <Elements> provider that already has a PaymentIntent client_secret, so
// there's nothing to create here, only to confirm. Shared by order checkout
// and grower Hub Membership payment — both are a single PaymentIntent
// confirmed the same way.
export default function StripePaymentForm({
  amountLabel,
  returnUrl,
  onSuccess,
}: {
  amountLabel: string
  returnUrl: string
  onSuccess: () => void
}) {
  const stripe = useStripe()
  const elements = useElements()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  async function handlePay() {
    if (!stripe || !elements) return
    setSubmitting(true)
    setError('')

    // Validates the PaymentElement's own fields (surfaces inline errors on
    // the element itself) before attempting to confirm.
    const { error: submitError } = await elements.submit()
    if (submitError) {
      setError(submitError.message || 'Please check your payment details.')
      setSubmitting(false)
      return
    }

    // redirect: 'if_required' keeps the buyer on this page for the common
    // card case — Stripe only navigates away for payment methods that
    // genuinely require it. returnUrl is the fallback for exactly that case.
    const { error: confirmError, paymentIntent } = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: returnUrl },
      redirect: 'if_required',
    })

    if (confirmError) {
      setError(confirmError.message || 'Payment failed. Please try again.')
      setSubmitting(false)
      return
    }

    if (paymentIntent && (paymentIntent.status === 'succeeded' || paymentIntent.status === 'processing')) {
      onSuccess()
    } else {
      setError('Payment did not complete. Please try again.')
      setSubmitting(false)
    }
  }

  return (
    <div>
      <PaymentElement options={{ layout: 'tabs' }} />
      {error && (
        <div className="badge badge-red" style={{ width: '100%', padding: '0.875rem', borderRadius: '0.75rem', justifyContent: 'flex-start', fontSize: '0.7rem', marginTop: '1.25rem' }}>
          ⚠ {error}
        </div>
      )}
      <button
        type="button"
        onClick={handlePay}
        disabled={!stripe || !elements || submitting}
        className="btn btn-cream"
        style={{ width: '100%', marginTop: '1.25rem' }}
      >
        {submitting ? 'Processing…' : amountLabel}
      </button>
    </div>
  )
}
