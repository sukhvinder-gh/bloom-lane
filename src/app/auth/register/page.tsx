import { Suspense } from 'react'
import RegisterForm from './RegisterForm'

export default function RegisterPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', background: 'var(--cream)' }} />}>
      <RegisterForm />
    </Suspense>
  )
}
