import { redirect } from 'next/navigation'
export default function OldSubscriptionRedirect() {
  redirect('/dashboard/farmer/membership')
}
