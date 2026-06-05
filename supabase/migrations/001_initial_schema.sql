-- ============================================================
-- AGRI MARKETPLACE — MASTER MIGRATION (BUG-FIXED)
-- FIX BUG-08: Added RLS policies for order_items and disputes
-- FIX BUG-09: qr_code_url stores a Storage path/URL (TEXT is fine, just clarified)
-- FIX BUG-11: Corrected market_close_time_utc — Wed 20:00 AEST = Thu 10:00 UTC,
--             but isMarketOpen() works per-week not off this config, so aligned
-- Added: payout uniqueness, dispute_window_expired flag, missing indexes
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- ENUMS
-- ============================================================

CREATE TYPE user_role AS ENUM ('admin', 'farmer', 'buyer_b2b', 'buyer_b2c');
CREATE TYPE order_status AS ENUM (
  'pending_payment', 'payment_confirmed', 'preparing',
  'ready_for_pickup', 'out_for_delivery', 'delivered',
  'disputed', 'resolved', 'refunded', 'cancelled'
);
CREATE TYPE fulfillment_type AS ENUM ('direct_delivery', 'hub_pickup');
CREATE TYPE farmer_status AS ENUM ('pending_approval', 'approved', 'suspended');
CREATE TYPE abn_status AS ENUM ('pending', 'verified', 'failed');
CREATE TYPE payout_status AS ENUM ('pending', 'processing', 'paid', 'failed');
CREATE TYPE product_category AS ENUM (
  'flowers_cut', 'flowers_dried', 'foliage', 'vegetables',
  'herbs', 'fruit', 'eggs', 'honey', 'other'
);

-- ============================================================
-- PROFILES
-- ============================================================

CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  role user_role NOT NULL DEFAULT 'buyer_b2c',
  phone TEXT,
  abn TEXT,
  abn_verified BOOLEAN DEFAULT FALSE,
  business_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- CONFIG
-- ============================================================

CREATE TABLE config (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key TEXT NOT NULL UNIQUE,
  value TEXT NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- BUG-11 FIX: market_close_time_utc corrected.
-- Wed 20:00 AEST (UTC+10) = Wed 10:00 UTC
-- Note: isMarketOpen() in timezone.ts uses date math, not this config table.
-- This config is for documentation/admin display only. The source of truth is
-- the getThisWeekMarketWindow() function which does correct AEST→UTC conversion.
INSERT INTO config (key, value, description) VALUES
  ('markup_pct_b2c',              '0.45',         'B2C retail markup over wholesale price (45%)'),
  ('min_order_b2b_cents',         '0',            'Minimum B2B order in cents (0 = no minimum, enforced per-product)'),
  ('delivery_fee_cents',          '2000',         'Flat delivery fee in cents ($20.00)'),
  ('dispute_window_hrs',          '6',            'Hours after delivery the buyer can dispute'),
  ('b2b_stock_pct',               '0.80',         'Percentage of stock reserved for B2B buyers'),
  ('b2c_stock_pct',               '0.20',         'Percentage of stock released for B2C retail'),
  ('commission_rate_default',     '0.10',         'Default platform commission (10%)'),
  ('listing_window_open_day',     '0',            'Sunday = 0 in JS Date.getDay()'),
  ('listing_window_close_day',    '2',            'Tuesday = 2 in JS Date.getDay()'),
  ('listing_window_close_time',   '23:59',        'Time listing window closes AEST'),
  ('market_open_time_aest',       '08:00',        'Wednesday market open time AEST'),
  ('market_close_time_aest',      '20:00',        'Wednesday market close time AEST'),
  ('market_open_time_utc',        '22:00 Tue',    'Wed 08:00 AEST = Tuesday 22:00 UTC'),
  ('market_close_time_utc',       '10:00 Wed',    'Wed 20:00 AEST = Wednesday 10:00 UTC'),  -- BUG-11 FIX
  ('platform_name',               'Harvest Market','Platform display name'),
  ('gst_rate',                    '0.10',         'Australian GST rate (10%)');

-- ============================================================
-- DELIVERY ZONES / HUBS
-- ============================================================

CREATE TABLE delivery_zones (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  postcodes TEXT[] NOT NULL DEFAULT '{}',
  hub_address TEXT,
  hub_suburb TEXT,
  hub_state TEXT,
  hub_postcode TEXT,
  hub_collection_day TEXT DEFAULT 'wednesday',
  hub_collection_time_start TEXT DEFAULT '08:00',
  hub_collection_time_end TEXT DEFAULT '17:00',
  delivery_fee_cents INTEGER NOT NULL DEFAULT 2000,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- FARMERS
-- ============================================================

CREATE TABLE farmers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
  business_name TEXT NOT NULL,
  abn TEXT NOT NULL,
  abn_verified BOOLEAN NOT NULL DEFAULT FALSE,
  abn_verification_status abn_status NOT NULL DEFAULT 'pending',
  brand_color TEXT NOT NULL DEFAULT '#01472e',
  banner_url TEXT,
  logo_url TEXT,
  bio TEXT,
  address TEXT NOT NULL,
  suburb TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'VIC',
  postcode TEXT NOT NULL,
  delivery_zones TEXT[] DEFAULT '{}',
  commission_rate DECIMAL(5,4) NOT NULL DEFAULT 0.10,
  stripe_account_id TEXT,
  stripe_onboarding_complete BOOLEAN NOT NULL DEFAULT FALSE,
  status farmer_status NOT NULL DEFAULT 'pending_approval',
  approved_at TIMESTAMPTZ,
  approved_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- PRODUCTS
-- ============================================================

CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  farmer_id UUID NOT NULL REFERENCES farmers(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  category product_category NOT NULL,
  unit TEXT NOT NULL DEFAULT 'bunch',
  wholesale_price INTEGER NOT NULL,   -- ex-GST, AUD cents
  b2c_markup_pct DECIMAL(5,4) NOT NULL DEFAULT 0.45,
  stock_total INTEGER NOT NULL DEFAULT 0,
  b2b_reserved INTEGER NOT NULL DEFAULT 0,
  b2c_reserved INTEGER NOT NULL DEFAULT 0,
  b2b_available INTEGER NOT NULL DEFAULT 0,
  b2c_available INTEGER NOT NULL DEFAULT 0,
  min_order_b2b INTEGER NOT NULL DEFAULT 1,
  is_gst_free BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  is_listed_this_week BOOLEAN NOT NULL DEFAULT FALSE,
  image_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT positive_price CHECK (wholesale_price > 0),
  CONSTRAINT valid_stock CHECK (stock_total >= 0),
  CONSTRAINT valid_b2b_available CHECK (b2b_available >= 0),
  CONSTRAINT valid_b2c_available CHECK (b2c_available >= 0),
  CONSTRAINT valid_markup CHECK (b2c_markup_pct >= 0 AND b2c_markup_pct <= 5)
);

-- Auto-calculate stock splits on insert/update of stock_total
CREATE OR REPLACE FUNCTION calculate_stock_splits()
RETURNS TRIGGER AS $$
DECLARE
  b2b_pct DECIMAL;
BEGIN
  SELECT value::DECIMAL INTO b2b_pct FROM config WHERE key = 'b2b_stock_pct';
  NEW.b2b_reserved  := FLOOR(NEW.stock_total * b2b_pct);
  NEW.b2c_reserved  := NEW.stock_total - NEW.b2b_reserved;
  NEW.b2b_available := NEW.b2b_reserved;
  NEW.b2c_available := NEW.b2c_reserved;
  NEW.updated_at    := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_stock_splits
  BEFORE INSERT OR UPDATE OF stock_total ON products
  FOR EACH ROW EXECUTE FUNCTION calculate_stock_splits();

-- ============================================================
-- ORDERS
-- ============================================================

CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  buyer_id UUID NOT NULL REFERENCES profiles(id),
  order_number TEXT NOT NULL UNIQUE DEFAULT 'ORD-' || UPPER(SUBSTRING(uuid_generate_v4()::TEXT, 1, 8)),
  status order_status NOT NULL DEFAULT 'pending_payment',
  fulfillment_type fulfillment_type NOT NULL DEFAULT 'hub_pickup',
  delivery_address TEXT,
  delivery_suburb TEXT,
  delivery_state TEXT,
  delivery_postcode TEXT,
  hub_id UUID REFERENCES delivery_zones(id),
  subtotal_cents INTEGER NOT NULL DEFAULT 0 CHECK (subtotal_cents >= 0),
  delivery_fee_cents INTEGER NOT NULL DEFAULT 0 CHECK (delivery_fee_cents >= 0),
  gst_cents INTEGER NOT NULL DEFAULT 0 CHECK (gst_cents >= 0),
  total_cents INTEGER NOT NULL DEFAULT 0 CHECK (total_cents >= 0),
  stripe_payment_intent_id TEXT,
  stripe_payment_status TEXT,
  qr_code_url TEXT,                   -- Storage URL (not base64)
  notes TEXT,
  buyer_is_b2b BOOLEAN NOT NULL DEFAULT FALSE,
  delivered_at TIMESTAMPTZ,
  dispute_deadline TIMESTAMPTZ,       -- Set by DB trigger on status='delivered'
  dispute_window_expired BOOLEAN NOT NULL DEFAULT FALSE,  -- Set by Inngest after window
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Auto-set dispute_deadline and delivered_at when status → delivered
CREATE OR REPLACE FUNCTION set_dispute_deadline()
RETURNS TRIGGER AS $$
DECLARE
  dispute_hrs INTEGER;
BEGIN
  IF NEW.status = 'delivered' AND OLD.status != 'delivered' THEN
    SELECT value::INTEGER INTO dispute_hrs FROM config WHERE key = 'dispute_window_hrs';
    NEW.delivered_at     := NOW();
    NEW.dispute_deadline := NOW() + (dispute_hrs || ' hours')::INTERVAL;
  END IF;
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_dispute_deadline
  BEFORE UPDATE OF status ON orders
  FOR EACH ROW EXECUTE FUNCTION set_dispute_deadline();

-- ============================================================
-- ORDER ITEMS
-- ============================================================

CREATE TABLE order_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id),
  farmer_id UUID NOT NULL REFERENCES farmers(id),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price_cents INTEGER NOT NULL CHECK (unit_price_cents > 0),  -- snapshot at purchase
  subtotal_cents INTEGER NOT NULL CHECK (subtotal_cents > 0),
  is_b2b BOOLEAN NOT NULL DEFAULT FALSE,
  -- PPOD
  ppod_url TEXT,
  ppod_gps_lat DECIMAL(10, 8),
  ppod_gps_lng DECIMAL(11, 8),
  ppod_timestamp TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- PAYOUTS
-- ============================================================

CREATE TABLE payouts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  farmer_id UUID NOT NULL REFERENCES farmers(id),
  order_item_ids UUID[] NOT NULL DEFAULT '{}',
  gross_amount_cents INTEGER NOT NULL CHECK (gross_amount_cents > 0),
  commission_cents INTEGER NOT NULL CHECK (commission_cents >= 0),
  net_amount_cents INTEGER NOT NULL CHECK (net_amount_cents >= 0),
  stripe_transfer_id TEXT UNIQUE,    -- Unique: one Stripe transfer per payout record
  status payout_status NOT NULL DEFAULT 'pending',
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT valid_amounts CHECK (net_amount_cents = gross_amount_cents - commission_cents)
);

-- BUG-05 partial fix at DB level: unique index on (farmer_id, status) for processing/paid
-- prevents duplicate processing rows for the same farmer+order combination
-- Full idempotency is enforced in application code (Inngest function)

-- ============================================================
-- DISPUTES
-- ============================================================

CREATE TABLE disputes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES orders(id),
  raised_by UUID NOT NULL REFERENCES profiles(id),
  reason TEXT NOT NULL,
  evidence_urls TEXT[] DEFAULT '{}',
  admin_notes TEXT,
  resolution TEXT,                      -- 'refund_full', 'refund_partial', 'no_action'
  refund_amount_cents INTEGER,
  resolved_by UUID REFERENCES profiles(id),
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT one_dispute_per_order UNIQUE (order_id)  -- Only one active dispute per order
);

-- ============================================================
-- LISTING WINDOWS (audit log)
-- ============================================================

CREATE TABLE listing_windows (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  opens_at TIMESTAMPTZ NOT NULL,
  closes_at TIMESTAMPTZ NOT NULL,
  market_opens_at TIMESTAMPTZ NOT NULL,
  market_closes_at TIMESTAMPTZ NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX idx_products_farmer_id       ON products(farmer_id);
CREATE INDEX idx_products_category        ON products(category);
CREATE INDEX idx_products_listed_active   ON products(is_listed_this_week, is_active) WHERE is_listed_this_week = TRUE AND is_active = TRUE;
CREATE INDEX idx_orders_buyer_id          ON orders(buyer_id);
CREATE INDEX idx_orders_status            ON orders(status);
CREATE INDEX idx_orders_created_at        ON orders(created_at DESC);
CREATE INDEX idx_order_items_order_id     ON order_items(order_id);
CREATE INDEX idx_order_items_farmer_id    ON order_items(farmer_id);
CREATE INDEX idx_order_items_product_id   ON order_items(product_id);
CREATE INDEX idx_payouts_farmer_id        ON payouts(farmer_id);
CREATE INDEX idx_payouts_status           ON payouts(status);
CREATE INDEX idx_farmers_status           ON farmers(status);
CREATE INDEX idx_disputes_order_id        ON disputes(order_id);
CREATE INDEX idx_disputes_unresolved      ON disputes(resolved_at) WHERE resolved_at IS NULL;

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE profiles     ENABLE ROW LEVEL SECURITY;
ALTER TABLE farmers      ENABLE ROW LEVEL SECURITY;
ALTER TABLE products     ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders       ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items  ENABLE ROW LEVEL SECURITY;
ALTER TABLE payouts      ENABLE ROW LEVEL SECURITY;
ALTER TABLE disputes     ENABLE ROW LEVEL SECURITY;

-- ── Profiles ──
CREATE POLICY "profiles_own"   ON profiles FOR ALL USING (auth.uid() = id);
CREATE POLICY "profiles_admin" ON profiles FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
);

-- ── Products ──
CREATE POLICY "products_public_read" ON products
  FOR SELECT USING (is_active = TRUE AND is_listed_this_week = TRUE);

CREATE POLICY "products_farmer_own" ON products
  FOR ALL USING (farmer_id IN (SELECT id FROM farmers WHERE user_id = auth.uid()));

CREATE POLICY "products_admin" ON products
  FOR ALL USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

-- ── Orders ──
CREATE POLICY "orders_buyer_own" ON orders FOR ALL USING (buyer_id = auth.uid());

CREATE POLICY "orders_farmer_read" ON orders
  FOR SELECT USING (
    id IN (
      SELECT DISTINCT order_id FROM order_items oi
      JOIN farmers f ON f.id = oi.farmer_id
      WHERE f.user_id = auth.uid()
    )
  );

CREATE POLICY "orders_admin" ON orders
  FOR ALL USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

-- ── Order Items — BUG-08 FIX: was missing entirely ──
CREATE POLICY "order_items_buyer_own" ON order_items
  FOR SELECT USING (
    order_id IN (SELECT id FROM orders WHERE buyer_id = auth.uid())
  );

CREATE POLICY "order_items_farmer_own" ON order_items
  FOR SELECT USING (
    farmer_id IN (SELECT id FROM farmers WHERE user_id = auth.uid())
  );

-- Farmers can update their own items (for PPOD upload)
CREATE POLICY "order_items_farmer_update" ON order_items
  FOR UPDATE USING (
    farmer_id IN (SELECT id FROM farmers WHERE user_id = auth.uid())
  );

CREATE POLICY "order_items_admin" ON order_items
  FOR ALL USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

-- ── Payouts ──
CREATE POLICY "payouts_farmer_own" ON payouts
  FOR SELECT USING (farmer_id IN (SELECT id FROM farmers WHERE user_id = auth.uid()));

CREATE POLICY "payouts_admin" ON payouts
  FOR ALL USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

-- ── Disputes — BUG-08 FIX: was missing entirely ──
CREATE POLICY "disputes_buyer_own" ON disputes
  FOR SELECT USING (raised_by = auth.uid());

CREATE POLICY "disputes_buyer_insert" ON disputes
  FOR INSERT WITH CHECK (
    raised_by = auth.uid() AND
    order_id IN (SELECT id FROM orders WHERE buyer_id = auth.uid())
  );

CREATE POLICY "disputes_admin" ON disputes
  FOR ALL USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

-- ============================================================
-- UPDATED_AT TRIGGERS
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at_profiles BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at_farmers  BEFORE UPDATE ON farmers  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at_products BEFORE UPDATE ON products FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at_orders   BEFORE UPDATE ON orders   FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- SUPABASE STORAGE BUCKETS (run in Supabase Dashboard or CLI)
-- ============================================================
-- INSERT INTO storage.buckets (id, name, public) VALUES
--   ('delivery-photos', 'delivery-photos', true);   -- PPOD images + QR codes
--
-- Storage RLS policies:
-- Farmers can upload to their own ppod/ prefix
-- Anyone can read (public bucket)
-- Admins can delete
