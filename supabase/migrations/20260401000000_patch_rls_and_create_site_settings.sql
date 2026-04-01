-- Migration: Configure site_settings table
-- Date: 2026-04-01

-- 1. Create site_settings table
CREATE TABLE IF NOT EXISTS public.site_settings (
    id integer PRIMARY KEY DEFAULT 1,
    free_shipping_threshold integer NOT NULL DEFAULT 30000,
    shipping_cost integer NOT NULL DEFAULT 3000,
    email_domains jsonb NOT NULL DEFAULT '["naver.com", "gmail.com", "daum.net", "hanmail.net"]'::jsonb,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    -- Enforce single row
    CONSTRAINT site_settings_single_row CHECK (id = 1)
);

-- 2. Enable RLS on site_settings
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;

-- 3. Create Policies for site_settings
-- Public can view site_settings (needed to show shipping threshold dynamically in frontend)
CREATE POLICY "Public can view site_settings" ON public.site_settings FOR SELECT TO anon, authenticated USING (true);

-- Admins can update site_settings
CREATE POLICY "Admins can update site_settings" ON public.site_settings FOR UPDATE TO authenticated USING (public.has_permission('master'));

-- 4. Insert initial data if not exists
INSERT INTO public.site_settings (id, free_shipping_threshold, shipping_cost)
VALUES (1, 30000, 3000)
ON CONFLICT (id) DO NOTHING;
