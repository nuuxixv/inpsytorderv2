-- =====================================================================
-- [초안 / DRAFT — 적용 금지] products 검사 위계 가법 컬럼
-- =====================================================================
-- 상태: 설계 검토용 초안. CTO 검수 + 건우님 승인 전 SQL Editor 실행 금지.
-- 근거: DOCS/PRD_검사위계.md §6 데이터모델.
-- 선행: 20260630000000_DRAFT_create_test_groups_master.sql 를 먼저 실행할 것
--       (test_group_id FK 가 test_groups(id) 를 참조하므로).
--
-- 목적:
--   기존 products 에 검사 위계(2뎁스) 진열용 컬럼을 "가법"으로 추가.
--   - test_group_id : 소속 검사군(1:1, FK → test_groups). NULL=미보정/미분류.
--   - option_name   : 형태 옵션명(예 '검사지/온라인코드(20)'). 2뎁스 한 행 표기.
--   - option_label  : 말머리(예 '교사용 12~23개월용'). 옵션 행의 prefix.
--   - is_common     : 공용 옵션 여부(지침서·매뉴얼 등 말머리 공통).
--   - sort_order    : 검사군 내 옵션 정렬순서(낮을수록 먼저).
--
-- 주의: is_active(상품 전역 노출여부)는 검사 위계 전용이 아니라 상품 전체 공통 필드이므로
--       별도 파일(20260630020000_DRAFT_add_products_is_active.sql)에서 추가함.
--
-- order_items 무영향:
--   옵션 = 개별 product. 담기·주문·정산은 기존 product 단위 그대로.
--   order_items 스냅샷 4필드 계약 유지 → 주문 로직 무변경.
--
-- category 컬럼 무변경:
--   본 파일은 products.category 를 읽거나 수정하지 않음. 신규 컬럼만 ADD.
--
-- 매출 집계 무영향:
--   매출 집계·대시보드는 products.category 만 사용(이미 검증). 신규 컬럼 미참조.
--
-- 가법·멱등·RLS/GRANT:
--   - ADD COLUMN IF NOT EXISTS 만 사용 → 재실행 안전(멱등). 기존 컬럼·데이터 무변경.
--   - products RLS 정책·GRANT 무변경(신규 컬럼은 기존 테이블 정책·GRANT를 그대로 상속).
--   - FK ON DELETE SET NULL: 검사군 삭제 시 상품은 남고 소속만 해제(주문·매출 보호).
--
-- ---------------------------------------------------------------------
-- [적용] Supabase 대시보드 → SQL Editor → (검수·승인 후) 본 파일 전문 1회 실행.
-- ---------------------------------------------------------------------
--
-- [롤백] (원복 필요 시 SQL Editor에 붙여넣기 — 데이터 손실 주의)
--   ALTER TABLE public.products DROP COLUMN IF EXISTS sort_order;
--   ALTER TABLE public.products DROP COLUMN IF EXISTS is_common;
--   ALTER TABLE public.products DROP COLUMN IF EXISTS option_label;
--   ALTER TABLE public.products DROP COLUMN IF EXISTS option_name;
--   ALTER TABLE public.products DROP COLUMN IF EXISTS test_group_id;
-- =====================================================================

-- 1) 검사군 소속 FK (1:1, nullable). 검사군 삭제 시 상품은 보존하고 소속만 해제.
ALTER TABLE public.products
    ADD COLUMN IF NOT EXISTS test_group_id bigint
    REFERENCES public.test_groups(id) ON DELETE SET NULL;

-- 2) 옵션 표기 컬럼
ALTER TABLE public.products
    ADD COLUMN IF NOT EXISTS option_name  text;      -- 형태 옵션명(2뎁스 한 행)
ALTER TABLE public.products
    ADD COLUMN IF NOT EXISTS option_label text;      -- 말머리(옵션 행 prefix)
ALTER TABLE public.products
    ADD COLUMN IF NOT EXISTS is_common    boolean NOT NULL DEFAULT false;  -- 공용 옵션 여부

-- 3) 검사군 내 옵션 정렬순서 (전역 sort_order 아님 — 검사군 내부 순서)
ALTER TABLE public.products
    ADD COLUMN IF NOT EXISTS sort_order   integer;   -- NULL=미지정(앱 레벨 폴백 정렬)

COMMENT ON COLUMN public.products.test_group_id IS '소속 검사군(FK → test_groups.id, 1:1). NULL=미보정/미분류. ON DELETE SET NULL(주문·매출 보호).';
COMMENT ON COLUMN public.products.option_name  IS '형태 옵션명(예 검사지/온라인코드(20)). 2뎁스 옵션 리스트 한 행의 표기.';
COMMENT ON COLUMN public.products.option_label IS '말머리(예 교사용 12~23개월용). 옵션 행 prefix. 소제목·열 아님.';
COMMENT ON COLUMN public.products.is_common    IS '공용 옵션 여부(지침서·매뉴얼 등 말머리 공통). 기본 false.';
COMMENT ON COLUMN public.products.sort_order   IS '검사군 내부 옵션 정렬순서(낮을수록 먼저). NULL=미지정. 전역 정렬 아님.';

-- =====================================================================
-- 끝. 기존 products 컬럼·데이터 무변경. category 무변경.
-- products RLS/GRANT 무변경(신규 컬럼 상속). order_items·매출 집계 무영향.
-- =====================================================================
