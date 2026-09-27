import { redirect } from 'next/navigation'

// Stripe calls this when an account link expires/is invalid, asking the app
// to generate a fresh one — must forward hub_id, or a coordinator with more
// than one hub gets silently bounced back to onboarding their most-recently-
// created hub instead of the one they were actually mid-setup on.
export default async function CoordinatorStripeOnboardingRefreshPage({
  searchParams,
}: {
  searchParams: Promise<{ hub_id?: string }>
}) {
  const { hub_id } = await searchParams
  redirect(`/api/coordinator/stripe/onboarding${hub_id ? `?hub_id=${hub_id}` : ''}`)
}
