// src/hooks/useCart.ts
// FIX BUG-13: Cart now persists across page refreshes via Zustand persist middleware
// Uses sessionStorage (not localStorage) — clears when tab closes, intentional for security

import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { CartItem, Product, FulfillmentType } from '@/types'
import { getBuyerUnitPrice } from '@/lib/utils/pricing'

interface CartStore {
  items: CartItem[]
  fulfillment_type: FulfillmentType
  hub_id?: string
  isB2B: boolean

  addItem: (product: Product, quantity: number, isB2B: boolean) => void
  removeItem: (productId: string) => void
  updateQuantity: (productId: string, quantity: number) => void
  clearCart: () => void
  setFulfillmentType: (type: FulfillmentType) => void
  setHubId: (hubId: string) => void

  totalItems: () => number
  subtotalCents: () => number
  itemCount: () => number
}

export const useCart = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],
      fulfillment_type: 'hub_pickup',
      hub_id: undefined,
      isB2B: false,

      addItem: (product, quantity, isB2B) => {
        const existing = get().items.find(i => i.product_id === product.id)
        const unit_price_cents = getBuyerUnitPrice(product, isB2B)

        // Enforce stock cap based on buyer type
        const maxStock = isB2B ? product.b2b_available : product.b2c_available
        const currentQty = existing?.quantity || 0
        const newQty = Math.min(currentQty + quantity, maxStock)

        if (newQty <= 0) return // don't add if stock is 0

        if (existing) {
          set(state => ({
            items: state.items.map(item =>
              item.product_id === product.id
                ? { ...item, quantity: newQty, unit_price_cents, is_b2b: isB2B }
                : item
            ),
            isB2B,
          }))
        } else {
          set(state => ({
            items: [...state.items, {
              product_id: product.id,
              product,
              quantity: newQty,
              is_b2b: isB2B,
              unit_price_cents,
            }],
            isB2B,
          }))
        }
      },

      removeItem: (productId) => {
        set(state => ({ items: state.items.filter(i => i.product_id !== productId) }))
      },

      updateQuantity: (productId, quantity) => {
        if (quantity <= 0) {
          get().removeItem(productId)
          return
        }
        // Enforce stock cap on manual update
        const item = get().items.find(i => i.product_id === productId)
        if (item) {
          const maxStock = item.is_b2b ? item.product.b2b_available : item.product.b2c_available
          const capped = Math.min(quantity, maxStock)
          set(state => ({
            items: state.items.map(i =>
              i.product_id === productId ? { ...i, quantity: capped } : i
            )
          }))
        }
      },

      clearCart: () => set({ items: [], hub_id: undefined }),

      setFulfillmentType: (type) => set({ fulfillment_type: type }),
      setHubId: (hubId) => set({ hub_id: hubId }),

      totalItems: () => get().items.reduce((sum, item) => sum + item.quantity, 0),
      subtotalCents: () => get().items.reduce((sum, item) => sum + item.unit_price_cents * item.quantity, 0),
      itemCount: () => get().items.length,
    }),
    {
      name: 'bloom-lane-cart',
      storage: createJSONStorage(() =>
        // Use sessionStorage — cart clears on tab close (intentional: market window based)
        typeof window !== 'undefined' ? sessionStorage : {
          getItem: () => null,
          setItem: () => {},
          removeItem: () => {},
        }
      ),
      // Only persist the cart items and fulfillment type, not computed state
      partialize: (state) => ({
        items: state.items,
        fulfillment_type: state.fulfillment_type,
        hub_id: state.hub_id,
        isB2B: state.isB2B,
      }),
    }
  )
)
