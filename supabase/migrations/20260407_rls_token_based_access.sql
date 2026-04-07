-- RLS 보안 강화: anon의 orders 전체 조회 차단
-- access_token 기반 SECURITY DEFINER 함수로만 고객 주문 조회 허용

-- 1. anon SELECT 정책 제거 (INSERT 정책은 유지)
DROP POLICY IF EXISTS "Public can view orders" ON orders;

-- 2. 토큰 기반 주문 조회 함수 (SECURITY DEFINER — RLS 우회하여 1건만 반환)
CREATE OR REPLACE FUNCTION get_order_by_token(p_token uuid)
RETURNS json
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT row_to_json(result)
  FROM (
    SELECT
      o.id, o.customer_name, o.phone_number, o.shipping_address,
      o.final_payment, o.delivery_fee, o.status, o.created_at,
      o.customer_request, o.is_on_site_sale, o.status_history,
      o.parent_order_id,
      (
        SELECT row_to_json(e)
        FROM events e
        WHERE e.id = o.event_id
      ) AS events,
      (
        SELECT json_agg(
          json_build_object(
            'quantity', oi.quantity,
            'price_at_purchase', oi.price_at_purchase,
            'products', (SELECT row_to_json(p) FROM products p WHERE p.id = oi.product_id)
          )
        )
        FROM order_items oi
        WHERE oi.order_id = o.id
      ) AS order_items,
      (
        SELECT row_to_json(parent)
        FROM (
          SELECT p.id, p.final_payment, p.delivery_fee, p.status,
            (
              SELECT json_agg(json_build_object(
                'quantity', pi.quantity,
                'price_at_purchase', pi.price_at_purchase,
                'products', (SELECT row_to_json(pp) FROM products pp WHERE pp.id = pi.product_id)
              ))
              FROM order_items pi WHERE pi.order_id = p.id
            ) AS order_items
          FROM orders p WHERE p.id = o.parent_order_id
        ) parent
      ) AS parent_order,
      (
        SELECT json_agg(
          json_build_object(
            'id', c.id,
            'final_payment', c.final_payment,
            'delivery_fee', c.delivery_fee,
            'status', c.status,
            'order_items', (
              SELECT json_agg(json_build_object(
                'quantity', ci.quantity,
                'price_at_purchase', ci.price_at_purchase,
                'products', (SELECT row_to_json(cp) FROM products cp WHERE cp.id = ci.product_id)
              ))
              FROM order_items ci WHERE ci.order_id = c.id
            )
          )
        )
        FROM orders c WHERE c.parent_order_id = o.id
      ) AS child_orders
    FROM orders o
    WHERE o.access_token = p_token
  ) result;
$$;

-- 3. anon / authenticated 모두 함수 실행 허용
GRANT EXECUTE ON FUNCTION get_order_by_token(uuid) TO anon;
GRANT EXECUTE ON FUNCTION get_order_by_token(uuid) TO authenticated;
