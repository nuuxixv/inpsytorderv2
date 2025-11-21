-- Migration: Apply RBAC and RLS Policies
-- Date: 2025-11-21

-- 1. First, drop all existing policies that depend on the functions
DROP POLICY IF EXISTS "Allow view orders" ON public.orders;
DROP POLICY IF EXISTS "Allow edit orders" ON public.orders;
DROP POLICY IF EXISTS "Allow view order_items" ON public.order_items;
DROP POLICY IF EXISTS "Allow edit order_items" ON public.order_items;
DROP POLICY IF EXISTS "Allow view products" ON public.products;
DROP POLICY IF EXISTS "Allow edit products" ON public.products;
DROP POLICY IF EXISTS "Allow view events" ON public.events;
DROP POLICY IF EXISTS "Allow edit events" ON public.events;

DROP POLICY IF EXISTS "Public can view events" ON public.events;
DROP POLICY IF EXISTS "Admins can insert events" ON public.events;
DROP POLICY IF EXISTS "Admins can update events" ON public.events;
DROP POLICY IF EXISTS "Admins can delete events" ON public.events;

DROP POLICY IF EXISTS "Public can view products" ON public.products;
DROP POLICY IF EXISTS "Admins can insert products" ON public.products;
DROP POLICY IF EXISTS "Admins can update products" ON public.products;
DROP POLICY IF EXISTS "Admins can delete products" ON public.products;

DROP POLICY IF EXISTS "Public can insert orders" ON public.orders;
DROP POLICY IF EXISTS "Admins can view orders" ON public.orders;
DROP POLICY IF EXISTS "Admins can update orders" ON public.orders;
DROP POLICY IF EXISTS "Master can delete orders" ON public.orders;

DROP POLICY IF EXISTS "Public can insert order_items" ON public.order_items;
DROP POLICY IF EXISTS "Admins can view order_items" ON public.order_items;
DROP POLICY IF EXISTS "Admins can update order_items" ON public.order_items;
DROP POLICY IF EXISTS "Admins can delete order_items" ON public.order_items;

-- 2. Now drop the functions
DROP FUNCTION IF EXISTS public.get_current_user_permissions();
DROP FUNCTION IF EXISTS public.has_permission(text);

-- 3. Recreate the functions with new logic
CREATE OR REPLACE FUNCTION public.get_current_user_permissions()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT coalesce(
    current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' -> 'permissions',
    '["view", "edit"]'::jsonb  -- Default permissions for users without explicit permissions
  );
$$;

CREATE OR REPLACE FUNCTION public.has_permission(required_perm text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT (
    -- Master has all permissions
    (get_current_user_permissions() ? 'master') OR
    -- Check for specific permission
    (get_current_user_permissions() ? required_perm) OR
    -- Fallback: if authenticated and no permissions set, grant view/edit
    (auth.uid() IS NOT NULL AND jsonb_array_length(
      coalesce(
        current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' -> 'permissions',
        '[]'::jsonb
      )
    ) = 0)
  );
$$;

-- 4. Enable RLS on all tables
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

-- 5. Create New Policies

-- EVENTS
CREATE POLICY "Public can view events" ON public.events FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Admins can insert events" ON public.events FOR INSERT TO authenticated WITH CHECK (public.has_permission('edit'));
CREATE POLICY "Admins can update events" ON public.events FOR UPDATE TO authenticated USING (public.has_permission('edit'));
CREATE POLICY "Admins can delete events" ON public.events FOR DELETE TO authenticated USING (public.has_permission('master'));

-- PRODUCTS
CREATE POLICY "Public can view products" ON public.products FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Admins can insert products" ON public.products FOR INSERT TO authenticated WITH CHECK (public.has_permission('edit'));
CREATE POLICY "Admins can update products" ON public.products FOR UPDATE TO authenticated USING (public.has_permission('edit'));
CREATE POLICY "Admins can delete products" ON public.products FOR DELETE TO authenticated USING (public.has_permission('master'));

-- ORDERS
CREATE POLICY "Public can insert orders" ON public.orders FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Admins can view orders" ON public.orders FOR SELECT TO authenticated USING (public.has_permission('view'));
CREATE POLICY "Admins can update orders" ON public.orders FOR UPDATE TO authenticated USING (public.has_permission('edit'));
CREATE POLICY "Master can delete orders" ON public.orders FOR DELETE TO authenticated USING (public.has_permission('master'));

-- ORDER_ITEMS
CREATE POLICY "Public can insert order_items" ON public.order_items FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Admins can view order_items" ON public.order_items FOR SELECT TO authenticated USING (public.has_permission('view'));
CREATE POLICY "Admins can update order_items" ON public.order_items FOR UPDATE TO authenticated USING (public.has_permission('edit'));
CREATE POLICY "Admins can delete order_items" ON public.order_items FOR DELETE TO authenticated USING (public.has_permission('edit'));
