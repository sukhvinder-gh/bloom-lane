// src/hooks/useCart.ts
// FIX BUG-13: Cart now persists across page refreshes via Zustand persist middleware
// Uses sessionStorage (not localStorage) — clears when tab closes, intentional for security
//
// Cart reservation: adding/changing quantity now reserves real stock
// server-side for 60 minutes (see /api/cart/reserve), instead of the old
// purely-client-side optimism. This is what actually prevents two buyers
// both "having" the last few stems — the hold happens the moment an item
// is added, not just at checkout.

import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { CartItem, Product, FulfillmentType } from '@/types'
import { getBuyerUnitPrice } from '@/lib/utils/pricing'

type MutationResult = { success: boolean; error?: string; available?: number }

interface CartStore {
  items: CartItem[]
  fulfillment_type: FulfillmentType
  hub_id?: string
  isB2B: boolean

  addItem: (product: Product, quantity: number, isB2B: boolean) => Promise<MutationResult>
  removeItem: (productId: string) => Promise<MutationResult>
  updateQuantity: (productId: string, quantity: number) => Promise<MutationResult>
  setItemNotes: (productId: string, notes: string) => void
  clearCart: () => void
  setFulfillmentType: (type: FulfillmentType) => void
  setHubId: (hubId: string) => void

  totalItems: () => number
  subtotalCents: () => number
}

async function reserveOnServer(productId: string, quantity: number, isB2B: boolean): Promise<MutationResult & { expires_at?: string }> {
  const res = await fetch('/api/cart/reserve', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ product_id: productId, quantity, is_b2b: isB2B }),
  })
  const data = await res.json()
  if (!res.ok) return { success: false, error: data.error || 'Could not reserve stock', available: data.available }
  return { success: true, expires_at: data.expires_at }
}

async function releaseOnServer(productId: string, isB2B: boolean): Promise<void> {
  try {
    await fetch('/api/cart/reserve', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ product_id: productId, is_b2b: isB2B }),
    })
  } catch {
    // Best-effort — an abandoned reservation still expires via the sweep job
  }
}

export const useCart = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],
      fulfillment_type: 'hub_pickup',
      hub_id: undefined,
      isB2B: false,

      addItem: async (product, quantity, isB2B) => {
        const existing = get().items.find(i => i.product_id === product.id)
        const currentQty = existing?.quantity || 0
        const newQty = currentQty + quantity

        const result = await reserveOnServer(product.id, newQty, isB2B)
        if (!result.success) return result

        const unit_price_cents = getBuyerUnitPrice(product, isB2B, !!(product as any).farmers?.gst_registered)

        if (existing) {
          set(state => ({
            items: state.items.map(item =>
              item.product_id === product.id
                ? { ...item, quantity: newQty, unit_price_cents, is_b2b: isB2B, reserved_until: result.expires_at }
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
              reserved_until: result.expires_at,
            }],
            isB2B,
          }))
        }
        return { success: true }
      },

      removeItem: async (productId) => {
        const item = get().items.find(i => i.product_id === productId)
        set(state => ({ items: state.items.filter(i => i.product_id !== productId) }))
        if (item) await releaseOnServer(productId, item.is_b2b)
        return { success: true }
      },

      updateQuantity: async (productId, quantity) => {
        const item = get().items.find(i => i.product_id === productId)
        if (!item) return { success: false, error: 'Item not in cart' }

        if (quantity <= 0) {
          return get().removeItem(productId)
        }

        const result = await reserveOnServer(productId, quantity, item.is_b2b)
        if (!result.success) return result

        set(state => ({
          items: state.items.map(i =>
            i.product_id === productId ? { ...i, quantity, reserved_until: result.expires_at } : i
          )
        }))
        return { success: true }
      },

      setItemNotes: (productId, notes) => set(state => ({
        items: state.items.map(i => i.product_id === productId ? { ...i, notes } : i)
      })),

      // Clears local state only — used after a successful order (reservations
      // are already consumed server-side by then, nothing left to release).
      clearCart: () => set({ items: [], hub_id: undefined }),

      setFulfillmentType: (type) => set({ fulfillment_type: type }),
      setHubId: (hubId) => set({ hub_id: hubId }),

      totalItems: () => get().items.reduce((sum, item) => sum + item.quantity, 0),
      subtotalCents: () => get().items.reduce((sum, item) => sum + item.unit_price_cents * item.quantity, 0),
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
