-- 보안: get_order_by_token(SECURITY DEFINER)이 events를 row_to_json(e)로 전체 컬럼 반환 →
-- 주문 토큰 보유자에게 신규 내부필드(marketing_cost/note/attendee_ids)까지 노출되던 2차 경로.
-- SECURITY DEFINER라 컬럼 GRANT(20260608020000)가 적용되지 않으므로 함수 본문에서 events를
-- 공개 8컬럼 json_build_object로 명시 교체. orders/order_items/parent/child는 기존과 동일.
-- OrderStatusPage가 쓰는 name·estimated_delivery_date 보존. 멱등(CREATE OR REPLACE).

CREATE OR REPLACE FUNCTION public.get_order_by_token(p_token uuid)
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
        SELECT json_build_object(
          'id', e.id, 'name', e.name, 'discount_rate', e.discount_rate,
          'tags', e.tags, 'start_date', e.start_date, 'end_date', e.end_date,
          'estimated_delivery_date', e.estimated_delivery_date, 'venue', e.venue
        )
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

GRANT EXECUTE ON FUNCTION public.get_order_by_token(uuid) TO anon, authenticated;
