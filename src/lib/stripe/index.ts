// src/lib/stripe/index.ts
// Stripe Connect setup for multi-vendor marketplace.
//
// Connected-account creation uses the v2 Core Accounts API
// (stripe.v2.core.accounts), not the older v1 stripe.accounts.create() —
// Stripe now rejects v1 account creation outright for this platform account
// ("Stripe no longer recommends Accounts v1 for new Connect integrations")
// unless a dashboard compatibility toggle is enabled, which isn't something
// to depend on long-term. Every connected account here (farmer or hub) is a
// pure *recipient*: the platform is always the merchant of record (buyers
// pay the platform's own account; a separate stripe.transfers.create() call
// — still v1, still the correct API for this — sends the connected account
// its share afterward). That's exactly what the v2 "recipient" configuration
// is for, as opposed to "merchant" (an account that processes its own
// charges, which none of ours do).
//
// stripe.transfers.create(), stripe.paymentIntents.*, stripe.refunds.create()
// and webhook signature verification are unaffected by this — only
// *creating* a Connect account moved to v2.

import Stripe from 'stripe'

// Server-side Stripe instance
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2026-08-26.dahlia',
  typescript: true,
})

type RecipientAccount = Stripe.V2.Core.Account

/**
 * True once this recipient account can actually receive a transfer —
 * i.e. the specific capability our stripe.transfers.create() calls depend
 * on, rather than a generic "onboarding complete" flag (v2 accounts don't
 * expose one; the old v1 details_submitted/charges_enabled/payouts_enabled
 * trio doesn't exist on v2 Account objects at all).
 */
export function isRecipientReadyForTransfers(account: RecipientAccount): boolean {
  return account.configuration?.recipient?.capabilities?.stripe_balance?.stripe_transfers?.status === 'active'
}

async function createRecipientAccount(params: {
  email: string
  businessName: string
  abn?: string
}): Promise<string> {
  const account = await stripe.v2.core.accounts.create({
    contact_email: params.email,
    display_name: params.businessName,
    dashboard: 'express', // gives the recipient a lightweight self-serve view of their own payouts/bank details, same as the v1 Express accounts this replaces
    identity: {
      country: 'AU',
      entity_type: 'company',
      business_details: {
        registered_name: params.businessName,
        ...(params.abn ? { id_numbers: [{ type: 'au_abn', value: params.abn.replace(/\D/g, '') }] } : {}),
      },
    },
    configuration: {
      recipient: {
        capabilities: { stripe_balance: { stripe_transfers: { requested: true } } },
      },
    },
    // Separate Charges & Transfers: the platform is the merchant of record
    // and already owns refund/loss handling manually (see
    // farmer_balance_adjustments) — 'application' on both mirrors that.
    defaults: {
      responsibilities: { fees_collector: 'application', losses_collector: 'application' },
    },
    metadata: {
      platform: 'agri-marketplace',
      ...(params.abn ? { abn: params.abn } : {}),
    },
  })

  return account.id
}

/**
 * Create a Stripe Connect recipient account for a new farmer. Stripe's own
 * hosted onboarding (the account link below) collects everything else —
 * address, bank details, identity documents — directly from the grower.
 */
export async function createFarmerStripeAccount(farmer: {
  email: string
  businessName: string
  abn: string
}): Promise<string> {
  return createRecipientAccount({ email: farmer.email, businessName: farmer.businessName, abn: farmer.abn })
}

/**
 * Create a Stripe Connect recipient account for a hub, so a grower's payout
 * can go to their hub instead of directly to them (see migration 040). No
 * ABN upfront — a hub isn't required to have one on file the way a grower's
 * ABN is captured at sign-up.
 */
export async function createHubStripeAccount(hub: {
  email: string
  businessName: string
}): Promise<string> {
  return createRecipientAccount({ email: hub.email, businessName: hub.businessName })
}

/**
 * Generate a Stripe onboarding link for a connected account (farmer or hub).
 * Defaults to the farmer's own return/refresh pages for backward compatibility.
 */
export async function createOnboardingLink(
  stripeAccountId: string,
  _entityId: string,
  paths: { refreshPath?: string; returnPath?: string } = {}
): Promise<string> {
  // Falls back to the known production URL rather than silently producing a
  // broken "undefined/dashboard/..." link if NEXT_PUBLIC_APP_URL is unset —
  // matches the fallback already used for NEXT_PUBLIC_SITE_URL in the email templates.
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://bloom-lane-app.azurewebsites.net'
  const link = await stripe.v2.core.accountLinks.create({
    account: stripeAccountId,
    use_case: {
      type: 'account_onboarding',
      account_onboarding: {
        configurations: ['recipient'],
        refresh_url: `${appUrl}${paths.refreshPath || '/dashboard/farmer/stripe/refresh'}`,
        return_url: `${appUrl}${paths.returnPath || '/dashboard/farmer/stripe/complete'}`,
      },
    },
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
  hubId?: string
}): Promise<Stripe.Transfer> {
  return stripe.transfers.create({
    amount: params.netAmountCents,
    currency: 'aud',
    destination: params.stripeAccountId,
    metadata: {
      order_id: params.orderId,
      farmer_id: params.farmerId,
      ...(params.hubId ? { hub_id: params.hubId } : {}),
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
