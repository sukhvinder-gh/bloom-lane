'use client'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function SignOutButton() {
  const router = useRouter()
  const supabase = createClient()

  async function handleSignOut() {
    await supabase.auth.signOut()
    // Force full page reload to clear all server-side cache and cookies
    window.location.href = '/auth/login'
  }

  return (
    <button
      onClick={handleSignOut}
      className="nav-item"
      style={{ width: '100%', border: 'none', background: 'none', textAlign: 'left', cursor: 'pointer' }}
    >
      <span style={{ width: '1.25rem', textAlign: 'center' }}>→</span> Sign out
    </button>
  )
}