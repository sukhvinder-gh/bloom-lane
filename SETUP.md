# Harvest Hub — Setup Guide

## 1. Install dependencies
```
npm install --legacy-peer-deps
```

## 2. Fill in your environment variables
Open `.env.local` and replace the placeholder values:

- NEXT_PUBLIC_SUPABASE_URL → from supabase.com/dashboard → Settings → API
- NEXT_PUBLIC_SUPABASE_ANON_KEY → same page, "anon public" key
- SUPABASE_SERVICE_ROLE_KEY → same page, "service_role" key (click Reveal)
- NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY → dashboard.stripe.com → Developers → API keys
- STRIPE_SECRET_KEY → same page (TEST mode)

## 3. Run your Supabase SQL migrations
In Supabase dashboard → SQL Editor → paste and run:
  1. supabase/migrations/001_initial_schema.sql
  2. supabase/migrations/002_stock_reservation_rpc.sql

## 4. Create Storage bucket
In Supabase dashboard → Storage → New bucket:
  Name: delivery-photos
  Public: YES

## 5. Create admin user
In Supabase dashboard → Authentication → Users → Add user
Then in Table Editor → profiles → set role = 'admin' for that user

## 6. Start the app
```
npm run dev
```
Open http://localhost:3000

## Stripe webhook (for payment testing)
In a second terminal:
```
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```
Copy the whsec_... secret into .env.local as STRIPE_WEBHOOK_SECRET

## Test card numbers
- Success: 4242 4242 4242 4242
- Decline:  4000 0000 0000 0002
- Any future expiry date, any 3-digit CVC
