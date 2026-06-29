-- =====================================================================
-- DRAFT: products.category 대분류 강제 (NOT NULL + CHECK)
-- =====================================================================
-- 목적: 상품 대분류를 검사/도서/도구로 강제해 미분류 매출(회계 누락) 차단.
-- 사전 확인: 건우님 SQL Editor 점검 결과 기존 데이터 중
--            category IS NULL OR category NOT IN ('검사','도서','도구') = 0건 (깨끗).
--            따라서 NOT NULL + CHECK 추가가 안전하게 성공함.
-- 성격: 가법(제약 추가)·멱등·RLS 무변경. order_items/orders 무관.
-- 실 적용: 건우님 승인 후 SQL Editor에서 아래 [적용] 블록 실행.
--
-- ---------------------------------------------------------------------
-- [적용] (Supabase SQL Editor에 그대로 붙여넣기)
-- ---------------------------------------------------------------------
--   ALTER TABLE public.products ALTER COLUMN category SET NOT NULL;
--   ALTER TABLE public.products
--     ADD CONSTRAINT products_category_check
--     CHECK (category IN ('검사', '도서', '도구'));
--
-- ---------------------------------------------------------------------
-- [롤백] (되돌릴 때 SQL Editor에 붙여넣기)
-- ---------------------------------------------------------------------
--   ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_category_check;
--   ALTER TABLE public.products ALTER COLUMN category DROP NOT NULL;
-- =====================================================================

-- 멱등 처리: CHECK 제약은 IF NOT EXISTS 미지원이므로 사전 DROP 후 재생성.
-- (이미 적용된 환경에서 재실행해도 안전)

-- 1) NOT NULL 강제 (이미 NOT NULL이면 no-op)
ALTER TABLE public.products ALTER COLUMN category SET NOT NULL;

-- 2) CHECK 제약: 유효 대분류 화이트리스트 강제
ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_category_check;
ALTER TABLE public.products
  ADD CONSTRAINT products_category_check
  CHECK (category IN ('검사', '도서', '도구'));

COMMENT ON CONSTRAINT products_category_check ON public.products IS
  '대분류는 검사/도서/도구만 허용 — 미분류 매출(회계 누락) 차단. 대분류 추가 시 이 제약 갱신 필요.';
