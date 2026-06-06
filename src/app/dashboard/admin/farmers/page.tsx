import { Suspense } from 'react'
import FarmersContent from './FarmersContent'

export default function AdminFarmersPage() {
  return (
    <Suspense fallback={<div className="page-pad" style={{ padding: '2.5rem', color: 'var(--forest)', opacity: 0.5 }}>Loading farmers...</div>}>
      <FarmersContent />
    </Suspense>
  )
}
