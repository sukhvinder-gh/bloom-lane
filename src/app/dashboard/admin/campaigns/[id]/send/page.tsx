import { createClient, createAdminClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import ReviewSend from './ReviewSend'

export default async function ReviewSendPage({ params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const admin = createAdminClient()
  const { data: profile } = await admin.from('profiles').select('role').eq('id', user.id).single()
  if (!profile || !['admin', 'platform_admin', 'super_admin'].includes(profile.role)) {
    redirect('/dashboard')
  }

  const { id } = await params
  const [{ data: campaign }, { count: activeCount }] = await Promise.all([
    admin.from('campaigns').select('id, subject, body, status').eq('id', id).single(),
    admin.from('newsletter_subscribers').select('*', { count: 'exact', head: true }).eq('status', 'active'),
  ])

  if (!campaign || campaign.status !== 'draft') notFound()

  return (
    <ReviewSend
      campaignId={campaign.id}
      subject={campaign.subject}
      body={campaign.body}
      activeCount={activeCount ?? 0}
      adminEmail={user.email ?? ''}
    />
  )
}
