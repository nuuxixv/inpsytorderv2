-- =====================================================================
-- [초안 / DRAFT — 적용 금지] products.discount_override (품목별 할인율 오버라이드)
-- =====================================================================
-- 상태: 설계 검토용 초안. CTO 검수 + 건우님 승인 전 SQL Editor 실행 금지.
-- 근거: 상품별 할인율 오버라이드 기능. 행사 일괄율(events.discount_rate)과
--       상품 할인여부(products.is_discountable)만으로는 표현 못 하는
--       "이 품목만 다른 할인율(정가 포함)" 요구를 컬럼 1개로 수용.
--
-- 실효 할인율 공식 (프론트/서버 정본 — 반드시 등가):
--   effectiveRate(product, eventRate) =
--       product.discount_override ?? (product.is_discountable ? eventRate : 0)
--   discountedUnit(product, eventRate) =
--       Math.round((product.list_price || 0) * (1 - effectiveRate))
--   → override 값이 있으면(0 포함) 무조건 그 값 사용, NULL/미지정이면 기존 로직.
--   SOURCE OF TRUTH: inpsyt-order-frontend/src/utils/pricing.js
--                    (getEffectiveRate/getDiscountedUnit), 케이스 pricing.test.js /
--                    서버 supabase/functions/create-order/index.ts.
--
-- DEFAULT 없음(= NULL) 인 이유:
--   NULL = "미지정" = 기존 행사율·is_discountable 로직 그대로.
--   0    = "명시적 정가"(행사율 무시). NULL 과 0 의 의미가 다르므로 DEFAULT 0 금지.
--   기존 전 상품이 NULL 로 채워짐 → 결제가 회귀 0 (순수 가법).
--
-- CHECK 제약(0~1):
--   할인율은 0(정가)~1(100% 할인) 범위. NULL 은 허용(미지정).
--   CHECK 는 "CHECK IF NOT EXISTS" 미지원 → drop-then-add 로 멱등 보장.
--
-- 가법·멱등·RLS/GRANT:
--   - ADD COLUMN IF NOT EXISTS 1개 + 제약 drop/add → 재실행 안전(멱등).
--     기존 컬럼·데이터 무변경.
--   - products RLS/GRANT 무변경. 기존 정책
--       "Public can view products" FOR SELECT TO anon, authenticated USING (true)
--       (20251121_apply_rbac_rls.sql:81) 를 신규 컬럼이 상속.
--     override 공개 허용 판단: 고객은 이미 최종 할인가를 보므로 민감정보 아님
--     (원가·마진 미노출과 동일 기조).
--   - order_items 스냅샷: price_at_purchase 는 결제 시점 서버 계산값이 이미 기록됨.
--     본 컬럼 추가는 신규 주문의 계산 입력만 바꿈, 과거 스냅샷 무영향.
--
-- ---------------------------------------------------------------------
-- [적용] Supabase 대시보드 → SQL Editor → (검수·승인 후) 본 파일 전문 1회 실행.
-- ---------------------------------------------------------------------
--
-- [롤백] (원복 필요 시 — 데이터 손실 주의)
--   ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_discount_override_check;
--   ALTER TABLE public.products DROP COLUMN IF EXISTS discount_override;
-- =====================================================================

ALTER TABLE public.products
    ADD COLUMN IF NOT EXISTS discount_override numeric;

-- CHECK 제약은 멱등 재실행을 위해 drop 후 add (CHECK IF NOT EXISTS 미지원).
ALTER TABLE public.products
    DROP CONSTRAINT IF EXISTS products_discount_override_check;
ALTER TABLE public.products
    ADD CONSTRAINT products_discount_override_check
    CHECK (discount_override IS NULL OR (discount_override >= 0 AND discount_override <= 1));

COMMENT ON COLUMN public.products.discount_override IS '품목별 할인율 오버라이드(0~1). NULL=미지정(행사율·is_discountable 로직), 0=명시적 정가. is_discountable보다 우선.';

-- =====================================================================
-- 끝. 기존 상품 전부 discount_override=NULL 로 채워짐(결제가 회귀 0, 순수 가법).
-- products RLS/GRANT 무변경. 과거 order_items 스냅샷 무영향.
-- =====================================================================
