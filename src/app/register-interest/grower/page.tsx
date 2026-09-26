import type { Metadata } from 'next'
import PublicShell from '../../_components/PublicShell'
import InterestForm from '../InterestForm'

export const metadata: Metadata = {
  title: 'Register your interest — Growers — The Green Guild',
  description: 'Growers: register your interest to join The Green Guild.',
}

export default function GrowerInterestPage() {
  return (
    <PublicShell
      title="Register your interest — Growers"
      intro="We're opening to growers in the next few weeks. Leave your details and we'll email you as soon as sign-ups open."
      maxWidth="36rem"
      compact
    >
      <InterestForm role="grower" />
    </PublicShell>
  )
}
