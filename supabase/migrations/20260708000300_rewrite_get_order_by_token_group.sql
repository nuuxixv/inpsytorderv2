-- 주문 연계(합배송) — get_order_by_token 재작성(껍데기 승격)
-- 설계: docs/superpowers/specs/2026-07-07-주문연계-그룹모델-재설계-design.md §5.3
--
-- 토큰이 가리키는 주문을 그룹 루트로 정규화하여 반환:
--   · is_group_parent=true      → 그 자신이 그룹 루트(껍데기)
--   · parent_order_id 있음(자식) → 껍데기(부모)로 승격하여 그룹 뷰 반환
--   · 둘 다 아님                 → 단독 주문
-- 그룹이면 껍데기의 합배송지·총액·종합상태 + child_orders 배열(자식별 상품/결제금액/상태).
--
-- 보안(중요): events 는 기존 공개 8컬럼 json_build_object 유지(row_to_json 금지 — SECURITY
--   DEFINER라 컬럼 GRANT 우회되어 내부필드가 노출되던 2차 경로 차단, 20260608021000 정신 계승).
-- 멱등: CREATE OR REPLACE. GRANT anon/authenticated 유지.
--
-- 반환 shape 변경 주의: parent_order 필드 제거(자식 토큰은 이제 껍데기로 승격되어 루트가 됨),
--   is_group_parent 플래그 추가, child_orders 에 customer_name/phone_number 추가.
--   → OrderStatusPage(고객 그룹 뷰, §5.3) 프론트 개편과 함께 배포해야 함.
CREATE OR REPLACE FUNCTION public.get_order_by_token(p_token uuid)
RETURNS json
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  WITH tokenized AS (
    SELECT
      CASE
        WHEN o.is_group_parent            THEN o.id
        WHEN o.parent_order_id IS NOT NULL THEN o.parent_order_id
        ELSE o.id
      END AS root_id
    FROM orders o
    WHERE o.access_token = p_token
  )
  SELECT row_to_json(result)
  FROM (
    SELECT
      r.id, r.customer_name, r.phone_number, r.shipping_address,
      r.final_payment, r.delivery_fee, r.status, r.created_at,
      r.customer_request, r.is_on_site_sale, r.status_history,
      r.parent_order_id, r.is_group_parent,
      (
        SELECT json_build_object(
          'id', e.id, 'name', e.name, 'discount_rate', e.discount_rate,
          'tags', e.tags, 'start_date', e.start_date, 'end_date', e.end_date,
          'estimated_delivery_date', e.estimated_delivery_date, 'venue', e.venue
        )
        FROM events e
        WHERE e.id = r.event_id
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
        WHERE oi.order_id = r.id
      ) AS order_items,
      (
        SELECT json_agg(
          json_build_object(
            'id', c.id,
            'customer_name', c.customer_name,
            'phone_number', c.phone_number,
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
          ORDER BY c.id
        )
        FROM orders c WHERE c.parent_order_id = r.id
      ) AS child_orders
    FROM orders r
    JOIN tokenized t ON t.root_id = r.id
  ) result;
$$;

GRANT EXECUTE ON FUNCTION public.get_order_by_token(uuid) TO anon, authenticated;
