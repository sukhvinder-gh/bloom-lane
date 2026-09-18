// src/lib/stripe/appearance.ts
// Shared Stripe Elements theme for every forest-green card that embeds a
// PaymentElement (checkout, grower Hub Membership payment). Stripe's built-in
// 'night' theme picks its own field/border colors, tuned for a neutral dark
// background — against this app's dark forest-green card those defaults read
// as too low-contrast (borders barely visible, tab labels washed out).
// Explicit variables/rules here instead, so field boundaries and tab/label
// contrast stay legible regardless of what Stripe ships next. Keep this in
// one place — it took several rounds of fixes (translucent selected-tab
// background, invisible Card/Klarna/Zip labels, the Link "save info" block
// clashing with the theme) to land on values that hold up.
import type { Appearance } from '@stripe/stripe-js'

export const STRIPE_APPEARANCE: Appearance = {
  theme: 'night',
  variables: {
    colorPrimary: '#c9d9c6',
    colorBackground: 'rgba(255,255,255,0.06)',
    colorText: '#f0ebe0',
    colorTextSecondary: '#a8c2a0',
    colorTextPlaceholder: 'rgba(240,235,224,0.45)',
    colorDanger: '#ff8a80',
    borderRadius: '10px',
    fontSizeBase: '15px',
  },
  rules: {
    '.Input': {
      border: '1px solid rgba(255,255,255,0.3)',
      boxShadow: 'none',
    },
    '.Input:focus': {
      border: '1px solid #c9d9c6',
      boxShadow: '0 0 0 1px #c9d9c6',
    },
    '.Label': {
      color: '#cfe0cc',
    },
    '.Tab': {
      border: '1px solid rgba(255,255,255,0.22)',
    },
    '.Tab:hover': {
      border: '1px solid rgba(255,255,255,0.4)',
    },
    '.Tab--selected': {
      border: '1px solid #c9d9c6',
      backgroundColor: '#c9d9c6',
    },
    '.TabLabel': {
      color: '#f0ebe0',
      fontWeight: '600',
    },
    '.TabIcon': {
      fill: '#f0ebe0',
    },
    '.TabLabel--selected': {
      color: '#173222',
    },
    '.TabIcon--selected': {
      fill: '#173222',
    },
    '.Block': {
      backgroundColor: 'rgba(255,255,255,0.05)',
      border: '1px solid rgba(255,255,255,0.16)',
      boxShadow: 'none',
    },
    '.BlockDivider': {
      backgroundColor: 'rgba(255,255,255,0.16)',
    },
    '.CheckboxLabel': {
      color: '#cfe0cc',
    },
  },
}
