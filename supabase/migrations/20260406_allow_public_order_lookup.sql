-- Migration: Allow anonymous users to look up orders
-- Date: 2026-04-06
-- Reason: Customers need to view their own order status after placing an order.
--         Without this, /order/status/:id and /order/lookup pages always fail for unauthenticated users.

-- Drop existing policies if they already exist (idempotent)
DROP POLICY IF EXISTS "Public can view orders" ON public.orders;
DROP POLICY IF EXISTS "Public can view order_items" ON public.order_items;

-- Allow anonymous users to read orders (needed for order status page and lookup page)
CREATE POLICY "Public can view orders" ON public.orders
  FOR SELECT TO anon
  USING (true);

-- Allow anonymous users to read order_items (needed to display order contents)
CREATE POLICY "Public can view order_items" ON public.order_items
  FOR SELECT TO anon
  USING (true);
