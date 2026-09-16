// Stripe's refresh_url — used when an onboarding link expires before the
// farmer finishes. Just regenerates a fresh link via the same route that
// creates the first one.
import { redirect } from 'next/navigation'

export default function StripeOnboardingRefreshPage() {
  redirect('/api/stripe/onboarding')
}
