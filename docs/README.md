# 🌱 Agri Marketplace — Developer Guide

**Hybrid B2B/B2C Agricultural Marketplace — Australia**

Built with: Next.js 15 · Supabase · Stripe Connect · Inngest · TypeScript

---

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Set up environment
cp .env.example .env.local
# Fill in all values (see Environment Setup below)

# 3. Start Supabase locally
npx supabase start

# 4. Run migrations
npx supabase db push

# 5. Start dev server
npm run dev

# 6. In separate terminal — Stripe webhook forwarding
stripe listen --forward-to localhost:3000/api/webhooks/stripe

# 7. In separate terminal — Inngest dev server
npx inngest-cli@latest dev
```

---

## Project Structure

```
src/
├── app/
│   ├── auth/           # Login, register pages
│   ├── marketplace/    # Public product browsing
│   ├── dashboard/
│   │   ├── admin/      # Platform admin
│   │   ├── farmer/     # Grower dashboard
│   │   └── buyer/      # Buyer dashboard
│   └── api/
│       ├── products/   # Product CRUD
│       ├── orders/     # Checkout + order management
│       │   └── ppod/   # Photo Proof of Delivery
│       ├── stripe/     # Stripe Connect onboarding
│       ├── webhooks/   # Stripe webhooks
│       └── abn/        # ABN verification
├── components/
├── lib/
│   ├── supabase/       # DB client (server + browser)
│   ├── stripe/         # Payment utilities
│   ├── inngest/        # Background jobs
│   └── utils/
│       ├── pricing.ts  # GST, markup, stock splits
│       ├── timezone.ts # AEST/AEDT handling
│       └── abn.ts      # ABN validation + ABR API
├── hooks/
│   └── useCart.ts      # Zustand cart store
├── types/              # TypeScript types
└── middleware.ts       # Auth + role routing
```

---

## Environment Setup

### 1. Supabase
1. Create project at [supabase.com](https://supabase.com)
2. Copy `NEXT_PUBLIC_SUPABASE_URL` and keys from Project Settings → API
3. Run `npx supabase db push` to apply migrations

### 2. Stripe Connect
1. Create account at [stripe.com](https://stripe.com)
2. Enable Connect at [dashboard.stripe.com/connect](https://dashboard.stripe.com/connect)
3. Set country to **Australia**
4. Copy publishable + secret keys
5. Create webhook endpoint: `https://yourdomain.com/api/webhooks/stripe`
   - Events: `payment_intent.succeeded`, `payment_intent.payment_failed`

### 3. ABR API (Australian Business Register)
1. Register for a free GUID at: https://abr.business.gov.au/Tools/WebServices
2. Add `ABR_GUID` to `.env.local`
3. Without this, ABN verification falls back to format-only + marks as "pending"

### 4. Inngest
1. Create account at [inngest.com](https://inngest.com)
2. Add the API route: `src/app/api/inngest/route.ts`
3. Register functions at Inngest dashboard

### 5. Email (dual provider)
The app sends through whichever provider `EMAIL_PROVIDER` selects (or infers —
see `.env.example`). Resend's free sandbox sender can only deliver to the
Resend account owner's own inbox, so most environments actually run on Gmail
SMTP until a verified sending domain is in place:
1. **Resend:** create an account at [resend.com](https://resend.com), verify
   your domain (`.com.au` ideally), add `RESEND_API_KEY` + `EMAIL_FROM`.
2. **Gmail (interim path):** generate a Gmail App Password and set
   `GMAIL_USER` + `GMAIL_APP_PASSWORD` — no domain verification needed.

---

## Key Business Rules (Do Not Change Without Review)

### Pricing
- All prices stored as **integers (cents)** — never floats
- B2B buyer pays: `wholesale_price + 10% GST` (unless `is_gst_free`)
- B2C buyer pays: `wholesale_price × (1 + 0.45 markup) + 10% GST`
- GST-free products: raw unprocessed food (check ATO list)

### Stock Splits (80/20)
- When farmer sets `stock_total`: DB trigger auto-calculates `b2b_reserved` (80%) and `b2c_reserved` (20%)
- B2B buyers draw from `b2b_available`, B2C from `b2c_available`
- Atomic RPC function prevents race conditions

### Listing Window (Weekly Cycle)
- **Opens:** Sunday 00:00 AEST
- **Closes:** Tuesday 23:59 AEST (Inngest cron locks listings)
- **Market opens:** Wednesday 08:00 AEST
- **Market closes:** Wednesday 20:00 AEST
- All times stored as **UTC** in DB, converted to AEST/AEDT at UI layer

### Dispute Window
- Starts: when order status set to `delivered` + PPOD uploaded
- Duration: 6 hours (configurable in `config` table)
- After expiry: Inngest automatically triggers farmer payouts
- Dispute button: hidden after `dispute_deadline` timestamp

### Payouts
- Platform takes commission (default 10%, configurable per farmer)
- Payout = `subtotal - commission`
- Transfer via Stripe Connect to farmer's Express account
- Triggered by Inngest 6 hours after delivery (post-dispute window)

---

## Testing Checklist (QA Gates)

Before any production deployment, verify:

- [ ] **Race Condition:** Simulate 10 concurrent checkouts for last-in-stock item → only 1 succeeds
- [ ] **B2B Tax Display:** B2B buyer sees `$100.00 (ex-GST)`, pays `$110.00`
- [ ] **B2C Tax Display:** B2C buyer sees `$159.50 (inc-GST)` (wholesale $100 + 45% markup + GST)
- [ ] **GST-Free Product:** No GST on raw vegetables at either tier
- [ ] **Timezone Integrity:** Change server timezone to UTC, verify Wednesday window still opens at 8:00 AEST
- [ ] **Dispute Lockout:** Dispute button disappears at exactly T+361 minutes (6hrs + 1min) after delivery
- [ ] **Payout Accuracy:** Farmer receives exactly `gross - (gross × commission_rate)` via Stripe
- [ ] **ABN Fallback:** With ABR_GUID unset, signup succeeds with status "pending"
- [ ] **Stock Split:** Product with 10 stock → b2b_reserved=8, b2c_reserved=2 (DB trigger)

---

## Deployment (Azure App Service)

Deployment is automatic — GitHub Actions (`.github/workflows/azure-deploy.yml`)
builds and deploys on every push to `main`. There is no manual deploy step for
normal changes.

```bash
# 1. Push to GitHub — this alone triggers the deploy
git push origin main

# 2. Watch the run
gh run list --limit 1
gh run view <run-id>
```

The workflow runs `npm run build` (output: 'standalone'), copies
`.next/static` and `public` into the standalone bundle, and deploys it to the
**bloom-lane-app** Azure Web App via `azure/webapps-deploy@v3` using a
publish-profile secret. A full deploy typically takes ~3 minutes.

- Environment variables live in Azure App Service's own Configuration
  (Application Settings), not in a committed `.env.production` — only
  `NEXT_PUBLIC_*` values are safe to commit there.
- Stripe webhook endpoint: `https://bloom-lane-app.azurewebsites.net/api/webhooks/stripe`
- `deploy-azure.ps1` (repo root) is a manual/local deploy helper — not used by CI.

---

## Database Migrations

```bash
# Create new migration
npx supabase migration new your_migration_name

# Apply all pending migrations
npx supabase db push

# Reset DB (WARNING: deletes all data)
npx supabase db reset

# Generate TypeScript types from schema
npm run db:generate
```

---

## Gaps Addressed (vs Original TRD)

| Gap | Solution |
|-----|----------|
| ABN API downtime | Format-only fallback + "pending" status — growers not blocked |
| GST-free products | `is_gst_free` checkbox on product form, skips GST in all calculations |
| PPOD on mobile | `<input type="file" capture="environment">` — no native app needed |
| Hub toggle ownership | Buyer chooses at checkout; Admin can override in dashboard |
| Post-dispute resolution | Admin notified → manual resolve → triggers refund or release |
| Stripe account type | **Express** for MVP (Stripe handles KYC); upgrade to Custom for V2 |
| Email provider | Added **Resend** (not in original TRD) for all transactional emails |
