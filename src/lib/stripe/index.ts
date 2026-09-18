// src/lib/stripe/index.ts
// Stripe Connect setup for multi-vendor marketplace
// Using Express accounts (recommended for MVP vs Custom)

import Stripe from 'stripe'

// Server-side Stripe instance
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20',
  typescript: true,
})

/**
 * Create a Stripe Connect Express account for a new farmer.
 * Express = Stripe handles KYC/identity verification UI.
 * Upgrade to Custom in V2 if you need branded onboarding.
 */
export async function createFarmerStripeAccount(farmer: {
  email: string
  businessName: string
  abn: string
}): Promise<string> {
  const account = await stripe.accounts.create({
    type: 'express',
    country: 'AU',
    email: farmer.email,
    capabilities: {
      card_payments: { requested: true },
      transfers: { requested: true },
    },
    business_type: 'company',
    company: {
      name: farmer.businessName,
      tax_id: farmer.abn.replace(/\D/g, ''), // ABN as tax ID
    },
    metadata: {
      abn: farmer.abn,
      platform: 'agri-marketplace',
    },
  })

  return account.id
}

/**
 * Generate Stripe onboarding link for farmer
 */
export async function createOnboardingLink(
  stripeAccountId: string,
  farmerId: string
): Promise<string> {
  // Falls back to the known production URL rather than silently producing a
  // broken "undefined/dashboard/..." link if NEXT_PUBLIC_APP_URL is unset —
  // matches the fallback already used for NEXT_PUBLIC_SITE_URL in the email templates.
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://bloom-lane-app.azurewebsites.net'
  const link = await stripe.accountLinks.create({
    account: stripeAccountId,
    refresh_url: `${appUrl}/dashboard/farmer/stripe/refresh`,
    return_url: `${appUrl}/dashboard/farmer/stripe/complete`,
    type: 'account_onboarding',
  })

  return link.url
}

/**
 * Create payment intent for an order
 * amount = total_cents (inc-GST, inc-delivery)
 */
export async function createPaymentIntent(params: {
  amountCents: number
  orderId: string
  buyerId: string
  metadata?: Record<string, string>
}): Promise<Stripe.PaymentIntent> {
  return stripe.paymentIntents.create({
    amount: params.amountCents,
    currency: 'aud',
    metadata: {
      order_id: params.orderId,
      buyer_id: params.buyerId,
      ...params.metadata,
    },
    automatic_payment_methods: { enabled: true },
  })
}

/**
 * Execute payout to a farmer via Stripe Connect
 * Transfers net_amount from platform to farmer's connected account
 */
export async function createFarmerPayout(params: {
  stripeAccountId: string
  netAmountCents: number
  orderId: string
  farmerId: string
}): Promise<Stripe.Transfer> {
  return stripe.transfers.create({
    amount: params.netAmountCents,
    currency: 'aud',
    destination: params.stripeAccountId,
    metadata: {
      order_id: params.orderId,
      farmer_id: params.farmerId,
    },
  })
}

/**
 * Process refund for a disputed order.
 * reason defaults to 'requested_by_customer' — 'fraudulent' has real
 * card-network risk-scoring consequences and must only be used for actual
 * fraud, not ordinary dispute resolutions.
 */
export async function createRefund(
  paymentIntentId: string,
  amountCents?: number,
  reason: 'requested_by_customer' | 'duplicate' | 'fraudulent' = 'requested_by_customer'
): Promise<Stripe.Refund> {
  return stripe.refunds.create({
    payment_intent: paymentIntentId,
    ...(amountCents ? { amount: amountCents } : {}),
    reason,
  })
}

/**
 * Cancel a still-open PaymentIntent (buyer abandoned checkout before
 * paying). No-op if Stripe has already moved it past a cancellable state
 * (e.g. already succeeded) — that's a normal race, not an error worth
 * surfacing to the caller.
 */
export async function cancelPaymentIntent(paymentIntentId: string): Promise<void> {
  try {
    await stripe.paymentIntents.cancel(paymentIntentId)
  } catch (err: any) {
    if (err?.code !== 'payment_intent_unexpected_state') throw err
  }
}

/**
 * Verify Stripe webhook signature
 */
export function constructWebhookEvent(
  payload: string | Buffer,
  signature: string
): Stripe.Event {
  return stripe.webhooks.constructEvent(
    payload,
    signature,
    process.env.STRIPE_WEBHOOK_SECRET!
  )
}
