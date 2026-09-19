import type { Metadata } from 'next'
import PublicShell from '../_components/PublicShell'
import ContactForm from './ContactForm'

export const metadata: Metadata = {
  title: 'Contact us — The Green Guild',
  description: 'Get in touch with The Green Guild team.',
}

export default function ContactPage() {
  return (
    <PublicShell
      title="Contact us"
      intro="Questions about buying, selling or setting up a hub? We'll reply by email."
      maxWidth="36rem"
      compact
    >
      <ContactForm />
    </PublicShell>
  )
}
