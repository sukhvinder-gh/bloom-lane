import type { Metadata } from 'next'
import PublicShell from '../../_components/PublicShell'
import InterestForm from '../InterestForm'

export const metadata: Metadata = {
  title: 'Register your interest — Buyers — The Green Guild',
  description: 'Buyers: register your interest to join The Green Guild.',
}

export default function BuyerInterestPage() {
  return (
    <PublicShell
      title="Register your interest — Buyers"
      intro="We're opening to buyers in the next few weeks. Leave your details and we'll email you as soon as sign-ups open."
      maxWidth="36rem"
      compact
    >
      <InterestForm role="buyer" />
    </PublicShell>
  )
}
