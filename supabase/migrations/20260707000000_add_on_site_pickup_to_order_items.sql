-- 현장수령(상품 단위) — order_items.on_site_pickup 컬럼 추가 + 저장 함수 보존 로직
-- 설계: docs/superpowers/specs/2026-07-07-현장수령-상품주문단위-design.md
--
-- 배경: update_order_details / update_order_with_items 는 편집 저장 시 order_items 를
--       DELETE 후 items_param 으로 재INSERT 한다. 현재 INSERT 컬럼에 on_site_pickup 이
--       없어, 상품별 현장수령(A) 마킹이 편집 저장 시 DEFAULT false 로 초기화되는 버그가 있음.
--       두 함수의 INSERT 컬럼 목록 + SELECT 절(jsonb 파싱)에 on_site_pickup 을 추가해 보존한다.
--
-- 제약: SET 절 원형 유지(delivery_fee/is_on_site_sale/total_cost/discount_amount 추가 금지),
--       CREATE OR REPLACE 만 사용(DROP 금지), RLS 변경 없음, 재고 로직 없음.

-- 0. 신규 컬럼 (기존 행은 DEFAULT false 로 자동 채움)
ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS on_site_pickup BOOLEAN NOT NULL DEFAULT false;

-- 1. update_order_details — order_items 재INSERT 시 on_site_pickup 보존
CREATE OR REPLACE FUNCTION update_order_details(
  order_id_param int,
  updates_param jsonb,
  items_param jsonb
)
RETURNS void AS $$
BEGIN
  UPDATE public.orders
  SET
    status = updates_param->>'status',
    customer_name = updates_param->>'customer_name',
    phone_number = updates_param->>'phone_number',
    shipping_address = (updates_param->>'shipping_address')::jsonb,
    customer_request = updates_param->>'customer_request',
    final_payment = (updates_param->>'final_payment')::numeric,
    event_id = (updates_param->>'event_id')::int,
    admin_memo = updates_param->>'admin_memo'
  WHERE id = order_id_param;

  DELETE FROM public.order_items
  WHERE order_id = order_id_param;

  INSERT INTO public.order_items (
    order_id, product_id, quantity, price_at_purchase,
    product_name, product_code, category, list_price, on_site_pickup
  )
  SELECT
    order_id_param,
    (item->>'product_id')::int,
    (item->>'quantity')::int,
    (item->>'price_at_purchase')::numeric,
    item->>'product_name',
    item->>'product_code',
    item->>'category',
    (item->>'list_price')::numeric,
    COALESCE((item->>'on_site_pickup')::boolean, false)
  FROM jsonb_array_elements(items_param) AS item;

EXCEPTION
  WHEN others THEN
    RAISE EXCEPTION 'An error occurred in update_order_details: %', sqlerrm;
END;
$$ LANGUAGE plpgsql;

-- 2. update_order_with_items — order_items 재INSERT 시 on_site_pickup 보존
CREATE OR REPLACE FUNCTION update_order_with_items(
  order_id_param int,
  updates_param jsonb,
  items_param jsonb
)
RETURNS void AS $$
BEGIN
  UPDATE public.orders
  SET
    status = updates_param->>'status',
    customer_name = updates_param->>'customer_name',
    phone_number = updates_param->>'phone_number',
    shipping_address = (updates_param->>'shipping_address')::jsonb,
    customer_request = updates_param->>'customer_request',
    final_payment = (updates_param->>'final_payment')::numeric,
    event_id = (updates_param->>'event_id')::int,
    admin_memo = updates_param->>'admin_memo'
  WHERE id = order_id_param;

  DELETE FROM public.order_items
  WHERE order_id = order_id_param;

  INSERT INTO public.order_items (
    order_id, product_id, quantity, price_at_purchase,
    product_name, product_code, category, list_price, on_site_pickup
  )
  SELECT
    order_id_param,
    (item->>'product_id')::int,
    (item->>'quantity')::int,
    (item->>'price_at_purchase')::numeric,
    item->>'product_name',
    item->>'product_code',
    item->>'category',
    (item->>'list_price')::numeric,
    COALESCE((item->>'on_site_pickup')::boolean, false)
  FROM jsonb_array_elements(items_param) AS item;

EXCEPTION
  WHEN others THEN
    RAISE EXCEPTION 'An error occurred in update_order_with_items: %', sqlerrm;
END;
$$ LANGUAGE plpgsql;
