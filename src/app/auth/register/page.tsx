import { Suspense } from 'react'
import Link from 'next/link'
import PublicShell from '../../_components/PublicShell'
import RegisterForm from './RegisterForm'

export default function RegisterPage() {
  return (
    <PublicShell
      title="Create account"
      intro={<>Already have one? <Link href="/auth/login" style={{ color: '#23402f', fontWeight: 500, textDecoration: 'underline', textUnderlineOffset: '3px' }}>Sign in</Link></>}
      maxWidth="30rem"
      compact
    >
      <Suspense fallback={null}>
        <RegisterForm />
      </Suspense>
    </PublicShell>
  )
}
