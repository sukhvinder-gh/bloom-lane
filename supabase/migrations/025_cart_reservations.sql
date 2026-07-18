-- Migration 025: 1-hour cart reservation
--
-- Today, stock is only actually locked at checkout submission — the cart
-- itself is pure client-side optimism (sessionStorage), so two buyers can
-- both "have" the last few stems in their carts simultaneously. This adds a
-- real server-side hold: adding to cart atomically reserves stock (deducting
-- from the same b2b_available/b2c_available pools checkout already uses) for
-- 60 minutes, preventing "product poaching" while a buyer builds an order.

CREATE TABLE IF NOT EXISTS cart_reservations (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  quantity   INTEGER NOT NULL CHECK (quantity > 0),
  is_b2b     BOOLEAN NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, product_id, is_b2b)
);

ALTER TABLE cart_reservations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "cart_reservations_own"       ON cart_reservations;
DROP POLICY IF EXISTS "cart_reservations_admin_all"  ON cart_reservations;
CREATE POLICY "cart_reservations_own" ON cart_reservations FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "cart_reservations_admin_all" ON cart_reservations FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'platform_admin', 'super_admin'))
);

CREATE INDEX IF NOT EXISTS idx_cart_reservations_expires ON cart_reservations(expires_at);
CREATE INDEX IF NOT EXISTS idx_cart_reservations_user    ON cart_reservations(user_id);

-- Set (or replace) a buyer's reservation for one product to an exact
-- quantity. Releases whatever that buyer already held for this product
-- first, then re-reserves the new amount — so raising/lowering the qty in
-- cart is a single atomic "net adjustment", not stack on top of the old hold.
CREATE OR REPLACE FUNCTION cart_set_reservation(
  p_user_id UUID,
  p_product_id UUID,
  p_quantity INTEGER,
  p_is_b2b BOOLEAN,
  p_expires_at TIMESTAMPTZ
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  product RECORD;
  existing_qty INTEGER := 0;
  available INTEGER;
BEGIN
  SELECT * INTO product FROM products WHERE id = p_product_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Product not found');
  END IF;

  SELECT quantity INTO existing_qty FROM cart_reservations
    WHERE user_id = p_user_id AND product_id = p_product_id AND is_b2b = p_is_b2b;
  existing_qty := COALESCE(existing_qty, 0);

  IF p_is_b2b THEN
    available := product.b2b_available + existing_qty;
  ELSE
    available := product.b2c_available + existing_qty;
  END IF;

  IF p_quantity > available THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient stock', 'available', available);
  END IF;

  IF p_is_b2b THEN
    UPDATE products SET b2b_available = b2b_available + existing_qty - p_quantity WHERE id = p_product_id;
  ELSE
    UPDATE products SET b2c_available = b2c_available + existing_qty - p_quantity WHERE id = p_product_id;
  END IF;

  INSERT INTO cart_reservations (user_id, product_id, quantity, is_b2b, expires_at)
  VALUES (p_user_id, p_product_id, p_quantity, p_is_b2b, p_expires_at)
  ON CONFLICT (user_id, product_id, is_b2b)
  DO UPDATE SET quantity = p_quantity, expires_at = p_expires_at;

  RETURN jsonb_build_object('success', true, 'expires_at', p_expires_at);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- Fully release a buyer's reservation for one product (removed from cart).
CREATE OR REPLACE FUNCTION cart_release_reservation(
  p_user_id UUID,
  p_product_id UUID,
  p_is_b2b BOOLEAN
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  existing_qty INTEGER;
BEGIN
  SELECT quantity INTO existing_qty FROM cart_reservations
    WHERE user_id = p_user_id AND product_id = p_product_id AND is_b2b = p_is_b2b
    FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', true, 'released', 0);
  END IF;

  IF p_is_b2b THEN
    UPDATE products SET b2b_available = b2b_available + existing_qty WHERE id = p_product_id;
  ELSE
    UPDATE products SET b2c_available = b2c_available + existing_qty WHERE id = p_product_id;
  END IF;

  DELETE FROM cart_reservations WHERE user_id = p_user_id AND product_id = p_product_id AND is_b2b = p_is_b2b;

  RETURN jsonb_build_object('success', true, 'released', existing_qty);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- Consume a reservation at checkout — deletes it WITHOUT releasing stock,
-- since the order now permanently owns that stock. Returns false if no
-- live (non-expired) reservation covers the requested quantity, so the
-- caller can fall back to a fresh checkout_reserve_stock check.
CREATE OR REPLACE FUNCTION cart_consume_reservation(
  p_user_id UUID,
  p_product_id UUID,
  p_quantity INTEGER,
  p_is_b2b BOOLEAN
)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
  existing RECORD;
BEGIN
  SELECT * INTO existing FROM cart_reservations
    WHERE user_id = p_user_id AND product_id = p_product_id AND is_b2b = p_is_b2b
    FOR UPDATE;

  IF NOT FOUND OR existing.expires_at < now() OR existing.quantity < p_quantity THEN
    RETURN false;
  END IF;

  DELETE FROM cart_reservations WHERE id = existing.id;
  RETURN true;
END;
$$;

-- Scheduled sweep — releases stock for reservations that expired without
-- being converted into an order (abandoned cart).
CREATE OR REPLACE FUNCTION cart_release_expired_reservations()
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  r RECORD;
  released_count INTEGER := 0;
BEGIN
  FOR r IN SELECT * FROM cart_reservations WHERE expires_at < now() FOR UPDATE LOOP
    IF r.is_b2b THEN
      UPDATE products SET b2b_available = b2b_available + r.quantity WHERE id = r.product_id;
    ELSE
      UPDATE products SET b2c_available = b2c_available + r.quantity WHERE id = r.product_id;
    END IF;
    DELETE FROM cart_reservations WHERE id = r.id;
    released_count := released_count + 1;
  END LOOP;
  RETURN released_count;
END;
$$;
