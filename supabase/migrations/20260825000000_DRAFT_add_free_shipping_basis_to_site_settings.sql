-- =====================================================================
-- [초안 / DRAFT — 적용 금지] site_settings.free_shipping_basis (무료배송 판정 기준)
-- =====================================================================
-- 상태: 설계 검토용 초안. CTO 검수 + 건우님 승인 전 SQL Editor 실행 금지.
--       적용은 메인 Claude가 승인 후 수행(본 에이전트는 실행하지 않음).
--
-- 근거:
--   무료배송 임계치(free_shipping_threshold) 판정의 "합계 기준"이 경로별로
--   어긋나 있었다:
--     - 서버 create-order  → 정가(할인 전) 합계 기준
--     - 어드민 NewOrderModal → 할인가(실결제) 합계 기준
--   이 컬럼 1개로 기준을 단일화한다. 값은 site_settings(단일 행, id=1)에 저장하고
--   서버·프론트가 같은 값을 읽어 동일 판정한다.
--
-- 의미(값 3상태):
--   NULL         = 미설정 → 코드 폴백 = 정가('list_price') 기준 (= 현행 서버 동작).
--   'list_price' = 정가(할인 전) 합계 기준.
--   'discounted' = 할인가(실결제) 합계 기준.
--   NULL 과 'list_price' 는 동작이 같다(둘 다 정가). NULL 을 별도로 두는 이유는
--   "설정을 만지지 않은 기존 환경" 을 명시적 값 없이도 현행대로 굴리기 위함.
--
-- DEFAULT 없음(= NULL) 인 이유:
--   DEFAULT 를 주면 기존 단일 행이 그 값으로 즉시 바뀌어 "미설정=현행" 불변 보장이
--   깨진다. NULL(미설정)=정가 폴백이므로, 설정을 안 만지면 서버 동작이 100% 불변.
--
-- CHECK 제약:
--   free_shipping_basis IS NULL OR free_shipping_basis IN ('list_price','discounted').
--   CHECK 는 "CHECK IF NOT EXISTS" 미지원 → drop-then-add 로 멱등 보장.
--
-- 가법·멱등·RLS/GRANT:
--   - ADD COLUMN IF NOT EXISTS 1개 + 제약 drop/add → 재실행 안전(멱등).
--     기존 컬럼·데이터 무변경. 단일 행(id=1)은 NULL 로 채워짐 → 배송비 회귀 0.
--   - site_settings RLS/GRANT 무변경. 기존 정책
--       "Public can view site_settings" FOR SELECT TO anon, authenticated USING (true)
--       (20260401000000_patch_rls_and_create_site_settings.sql:20) 을 신규 컬럼이 상속.
--     site_settings 는 컬럼 레벨 GRANT/REVOKE 가 전혀 없어(테이블 전체 SELECT)
--     신규 컬럼이 별도 GRANT 없이 anon/authenticated 에게 자동 노출된다.
--     프론트가 이미 anon 으로 free_shipping_threshold 를 읽고 있으므로,
--     같은 경로로 free_shipping_basis 도 읽혀야 판정이 일치한다 → GRANT 추가 불필요.
--     민감정보 아님(배송 정책 값, 고객에게 노출돼도 무해).
--   - 서버 create-order 는 SERVICE_ROLE_KEY 로 읽어 RLS 우회 → 영향 없음.
--   - UPDATE 는 기존 "Admins can update site_settings"(master 권한) 정책 그대로 상속.
--
-- ---------------------------------------------------------------------
-- [적용] Supabase 대시보드 → SQL Editor → (검수·승인 후) 본 파일 전문 1회 실행.
--        적용 순서: 이 마이그레이션 먼저 → 그 다음 create-order 함수 배포.
--        (함수는 컬럼 부재에도 graceful 폴백하므로 순서 역전돼도 회귀 0이나,
--         마이그레이션 선행을 권장.)
-- ---------------------------------------------------------------------
--
-- [롤백] (원복 필요 시 — 데이터 손실 주의)
--   ALTER TABLE public.site_settings DROP CONSTRAINT IF EXISTS site_settings_free_shipping_basis_check;
--   ALTER TABLE public.site_settings DROP COLUMN IF EXISTS free_shipping_basis;
-- =====================================================================

ALTER TABLE public.site_settings
    ADD COLUMN IF NOT EXISTS free_shipping_basis text;

-- CHECK 제약은 멱등 재실행을 위해 drop 후 add (CHECK IF NOT EXISTS 미지원).
ALTER TABLE public.site_settings
    DROP CONSTRAINT IF EXISTS site_settings_free_shipping_basis_check;
ALTER TABLE public.site_settings
    ADD CONSTRAINT site_settings_free_shipping_basis_check
    CHECK (free_shipping_basis IS NULL OR free_shipping_basis IN ('list_price', 'discounted'));

COMMENT ON COLUMN public.site_settings.free_shipping_basis IS '무료배송 임계치 판정 기준. NULL/list_price=정가(할인 전) 합계, discounted=할인가(실결제) 합계. 2026-08-25 신설 — 그 전까진 서버 정가·어드민 신규주문 할인가로 어긋나 있었음(통일).';

-- =====================================================================
-- 끝. 단일 행(id=1) free_shipping_basis=NULL 로 채워짐(정가 폴백 = 현행 동작, 회귀 0).
-- site_settings RLS/GRANT 무변경.
-- =====================================================================
