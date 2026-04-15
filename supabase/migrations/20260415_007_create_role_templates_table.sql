CREATE TABLE IF NOT EXISTS public.role_templates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  permissions JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_system BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.role_templates ADD COLUMN IF NOT EXISTS slug TEXT;
-- 기존 데이터에 slug가 없으면 name 기반으로 채움
UPDATE public.role_templates SET slug = 'master' WHERE name = '마스터' AND slug IS NULL;
UPDATE public.role_templates SET slug = 'onsite' WHERE name = '현장 마케팅' AND slug IS NULL;
UPDATE public.role_templates SET slug = 'fulfillment_book' WHERE name LIKE '출고 (도서)%' AND slug IS NULL;
UPDATE public.role_templates SET slug = 'fulfillment_test' WHERE name LIKE '출고 (검사)%' AND slug IS NULL;

ALTER TABLE public.role_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view role_templates" ON public.role_templates
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Master can insert role_templates" ON public.role_templates
  FOR INSERT TO authenticated WITH CHECK (public.has_permission('master'));
CREATE POLICY "Master can update role_templates" ON public.role_templates
  FOR UPDATE TO authenticated USING (public.has_permission('master'));
CREATE POLICY "Master can delete role_templates" ON public.role_templates
  FOR DELETE TO authenticated USING (public.has_permission('master') AND NOT is_system);

INSERT INTO public.role_templates (slug, name, description, permissions, is_system) VALUES
  ('master', '마스터', '모든 권한', '["master"]'::jsonb, true),
  ('onsite', '현장 마케팅', '현장 주문 접수, 결제 처리, 학회 정보 조회', '["orders:view","orders:edit","events:view","dashboard:view"]'::jsonb, true),
  ('fulfillment_book', '출고 (도서)', '주문 조회/편집, 상품 조회, 출고 처리', '["orders:view","orders:edit","products:view","fulfillment:view","dashboard:view"]'::jsonb, true),
  ('fulfillment_test', '출고 (검사)', '주문 조회/편집, 상품 조회, 출고 처리', '["orders:view","orders:edit","products:view","fulfillment:view","dashboard:view"]'::jsonb, true)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  permissions = EXCLUDED.permissions;
