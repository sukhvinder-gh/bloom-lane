import { Suspense } from 'react'
import OrderContent from './OrderContent'

export default function BuyerOrderPage() {
  return (
    <Suspense fallback={<div style={{ padding: '2.5rem', color: 'var(--forest)', opacity: 0.5 }}>Loading order...</div>}>
      <OrderContent />
    </Suspense>
  )
}
