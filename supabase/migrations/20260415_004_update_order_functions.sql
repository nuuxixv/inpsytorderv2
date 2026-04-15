-- SQL 함수 업데이트: 스냅샷 컬럼 포함하여 order_items INSERT

-- 1. update_order_details 함수 업데이트
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
    product_name, product_code, category, list_price
  )
  SELECT
    order_id_param,
    (item->>'product_id')::int,
    (item->>'quantity')::int,
    (item->>'price_at_purchase')::numeric,
    item->>'product_name',
    item->>'product_code',
    item->>'category',
    (item->>'list_price')::numeric
  FROM jsonb_array_elements(items_param) AS item;

EXCEPTION
  WHEN others THEN
    RAISE EXCEPTION 'An error occurred in update_order_details: %', sqlerrm;
END;
$$ LANGUAGE plpgsql;

-- 2. update_order_with_items 함수 업데이트
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
    product_name, product_code, category, list_price
  )
  SELECT
    order_id_param,
    (item->>'product_id')::int,
    (item->>'quantity')::int,
    (item->>'price_at_purchase')::numeric,
    item->>'product_name',
    item->>'product_code',
    item->>'category',
    (item->>'list_price')::numeric
  FROM jsonb_array_elements(items_param) AS item;

EXCEPTION
  WHEN others THEN
    RAISE EXCEPTION 'An error occurred in update_order_with_items: %', sqlerrm;
END;
$$ LANGUAGE plpgsql;

-- 3. get_order_by_token 함수 업데이트: 스냅샷 컬럼 포함 + products fallback
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
            'product_name', COALESCE(oi.product_name, p.name),
            'product_code', COALESCE(oi.product_code, p.product_code),
            'category', COALESCE(oi.category, p.category),
            'list_price', COALESCE(oi.list_price, p.list_price),
            'products', (SELECT row_to_json(p2) FROM products p2 WHERE p2.id = oi.product_id)
          )
        )
        FROM order_items oi
        LEFT JOIN products p ON p.id = oi.product_id
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
                'product_name', COALESCE(pi.product_name, pp.name),
                'category', COALESCE(pi.category, pp.category),
                'products', (SELECT row_to_json(pp2) FROM products pp2 WHERE pp2.id = pi.product_id)
              ))
              FROM order_items pi
              LEFT JOIN products pp ON pp.id = pi.product_id
              WHERE pi.order_id = p.id
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
                'product_name', COALESCE(ci.product_name, cp.name),
                'category', COALESCE(ci.category, cp.category),
                'products', (SELECT row_to_json(cp2) FROM products cp2 WHERE cp2.id = ci.product_id)
              ))
              FROM order_items ci
              LEFT JOIN products cp ON cp.id = ci.product_id
              WHERE ci.order_id = c.id
            )
          )
        )
        FROM orders c WHERE c.parent_order_id = o.id
      ) AS child_orders
    FROM orders o
    WHERE o.access_token = p_token
  ) result;
$$;
