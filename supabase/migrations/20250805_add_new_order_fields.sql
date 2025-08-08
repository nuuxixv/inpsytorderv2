ALTER TABLE public.orders
ADD COLUMN contact text,
ADD COLUMN address text,
ADD COLUMN total_amount numeric,
ADD COLUMN discount_amount numeric,
ADD COLUMN shipping_cost numeric,
ADD COLUMN is_on_site_sale boolean DEFAULT false;