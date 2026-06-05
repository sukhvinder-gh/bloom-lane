-- supabase/migrations/002_stock_reservation_rpc.sql
-- Atomic stock reservation using Row-Level Locking
-- Called by checkout API to prevent overselling

CREATE OR REPLACE FUNCTION checkout_reserve_stock(
  p_items JSONB -- [{ product_id, quantity, is_b2b }]
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  item JSONB;
  product RECORD;
  available INTEGER;
  result JSONB := '{"success": true}'::JSONB;
BEGIN
  -- Process each item
  FOR item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    -- Lock the product row (prevents concurrent modifications)
    SELECT *
    INTO product
    FROM products
    WHERE id = (item->>'product_id')::UUID
    FOR UPDATE; -- ROW LEVEL LOCK

    IF NOT FOUND THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Product not found: ' || (item->>'product_id')
      );
    END IF;

    -- Check correct pool has enough stock
    IF (item->>'is_b2b')::BOOLEAN THEN
      available := product.b2b_available;
    ELSE
      available := product.b2c_available;
    END IF;

    IF available < (item->>'quantity')::INTEGER THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Insufficient stock for: ' || product.name ||
                 '. Available: ' || available ||
                 ', Requested: ' || (item->>'quantity')
      );
    END IF;

    -- Deduct from correct pool
    IF (item->>'is_b2b')::BOOLEAN THEN
      UPDATE products
      SET b2b_available = b2b_available - (item->>'quantity')::INTEGER
      WHERE id = product.id;
    ELSE
      UPDATE products
      SET b2c_available = b2c_available - (item->>'quantity')::INTEGER
      WHERE id = product.id;
    END IF;
  END LOOP;

  RETURN result;

EXCEPTION WHEN OTHERS THEN
  -- Any error rolls back all stock deductions (transaction is atomic)
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- Release stock (used on order cancellation or checkout abandonment)
CREATE OR REPLACE FUNCTION checkout_release_stock(
  p_items JSONB
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  item JSONB;
BEGIN
  FOR item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    IF (item->>'is_b2b')::BOOLEAN THEN
      UPDATE products
      SET b2b_available = b2b_available + (item->>'quantity')::INTEGER
      WHERE id = (item->>'product_id')::UUID;
    ELSE
      UPDATE products
      SET b2c_available = b2c_available + (item->>'quantity')::INTEGER
      WHERE id = (item->>'product_id')::UUID;
    END IF;
  END LOOP;
END;
$$;
