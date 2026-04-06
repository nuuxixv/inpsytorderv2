-- Migration: Add access_token to orders for secure public order status URL
-- Date: 2026-04-06
-- Reason: /order/status/:id exposes sequential integer IDs, enabling enumeration attacks.
--         UUID token is unguessable and safe to expose in URLs.

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS access_token uuid DEFAULT gen_random_uuid() NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS orders_access_token_idx ON public.orders(access_token);

-- Backfill existing orders that may have NULL (shouldn't happen due to DEFAULT, but just in case)
UPDATE public.orders SET access_token = gen_random_uuid() WHERE access_token IS NULL;
