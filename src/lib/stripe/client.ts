// src/lib/stripe/client.ts
// Browser-side Stripe.js loader. loadStripe() fetches Stripe's own JS from
// their CDN and must only ever be called once per publishable key — Stripe's
// own docs warn against re-invoking it on every render/component mount.
'use client'

import { loadStripe, type Stripe } from '@stripe/stripe-js'

let stripePromise: Promise<Stripe | null> | null = null

export function getStripe(): Promise<Stripe | null> {
  if (!stripePromise) {
    const key = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
    stripePromise = key ? loadStripe(key) : Promise.resolve(null)
  }
  return stripePromise
}
