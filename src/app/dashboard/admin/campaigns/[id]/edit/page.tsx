import { createClient, createAdminClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import CampaignForm from '../../CampaignForm'

export default async function EditCampaignPage({ params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const admin = createAdminClient()
  const { data: profile } = await admin.from('profiles').select('role').eq('id', user.id).single()
  if (!profile || !['admin', 'platform_admin', 'super_admin'].includes(profile.role)) {
    redirect('/dashboard')
  }

  const { id } = await params
  const { data: campaign } = await admin.from('campaigns').select('id, subject, body, status').eq('id', id).single()
  if (!campaign || campaign.status !== 'draft') notFound()

  return (
    <CampaignForm
      campaignId={campaign.id}
      initialSubject={campaign.subject}
      initialBody={campaign.body}
      adminEmail={user.email ?? ''}
    />
  )
}
