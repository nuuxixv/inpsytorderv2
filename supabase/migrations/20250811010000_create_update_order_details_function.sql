create or replace function update_order_details(
  order_id_param int,
  updates_param jsonb,
  items_param jsonb
)
returns void as $$
begin
  -- 1. Update the orders table
  update public.orders
  set
    status = updates_param->>'status',
    customer_name = updates_param->>'customer_name',
    email = updates_param->>'email',
    phone_number = updates_param->>'phone_number',
    shipping_address = (updates_param->>'shipping_address')::jsonb,
    customer_request = updates_param->>'customer_request',
    final_payment = (updates_param->>'final_payment')::numeric,
    event_id = (updates_param->>'event_id')::int,
    admin_memo = updates_param->>'admin_memo'
  where id = order_id_param;

  -- 2. Delete existing order items
  delete from public.order_items
  where order_id = order_id_param;

  -- 3. Insert new order items
  insert into public.order_items (order_id, product_id, quantity, price_at_purchase)
  select
    order_id_param,
    (item->>'product_id')::int,
    (item->>'quantity')::int,
    (item->>'price_at_purchase')::numeric
  from jsonb_array_elements(items_param) as item;

exception
  when others then
    raise exception 'An error occurred in update_order_details: %', sqlerrm;
end;
$$ language plpgsql;