-- =====================================================================
-- [초안 / DRAFT — 적용 금지] 검사군 마스터 테이블 (test_groups)
-- =====================================================================
-- 상태: 설계 검토용 초안. CTO 검수 + 건우님 승인 전 SQL Editor 실행 금지.
-- 근거: DOCS/PRD_검사위계.md §6 데이터모델.
--
-- 목적:
--   검사 상품(약 1,100행)을 "검사군(한글 검사명)" 단위로 묶어 2뎁스로 진열하기 위한
--   마스터 테이블. 1뎁스 카드 = 검사군(검사명 메인 + 약어 좌상단 보조 + "옵션 N개"),
--   펼치면 소속 옵션(개별 product)을 세로 리스트로 노출.
--   운영자가 검사군을 분리/병합/명명·정렬 보정하는 진실 소스.
--
-- 상품 ↔ 검사군 연결 방식 (1:1, FK 있음 — products 쪽에서 정의):
--   - products.test_group_id (bigint, nullable) → test_groups.id (별도 파일에서 ADD).
--   - 한 상품은 한 검사군에 속함(1:1). 공용 지침서도 각 검사군이 자체 보유(복제 안 함).
--   - test_group_id 가 NULL 인 상품(미보정 신규 등)은 첫단어 자동 편입/미분류 처리(앱 레벨).
--
-- abbr(약어)에 UNIQUE 제약을 걸지 않는 이유 (중요):
--   - 실측 확인: SCID-5 등 "1약어 → N검사명" 사례가 존재(같은 약어가 여러 검사군에 등장).
--   - 또한 abbr 는 nullable — 약어 없는 검사군이 존재(한글 검사명만 있는 경우).
--   - 따라서 유일키는 surrogate PK(id)만. abbr 은 표시 라벨일 뿐 식별자가 아님.
--   - (subcategories/badges 마스터는 name/parent+name UNIQUE 였으나, 검사군은
--     abbr·name 모두 중복 가능성이 실데이터로 확인되어 자연 유일키를 두지 않음.)
--
-- 매출 집계 무영향:
--   매출 집계·대시보드는 products.category(대분류)만 사용(이미 검증).
--   검사군은 진열(노출) 전용 — 본 테이블은 집계 경로에 일절 끼지 않음.
--
-- order_items 무영향:
--   옵션 = 개별 product. 담기·주문·정산은 기존 product 단위 그대로.
--   order_items 스냅샷 4필드 계약 유지 → 주문 로직 무변경. 본 테이블은 진열 계층만 추가.
--
-- category 컬럼 무변경:
--   test_groups.category 는 검사군의 대분류 힌트(진열 그룹핑용, nullable) — 신규 컬럼일 뿐,
--   products.category 를 건드리지 않음. products.category 정합은 앱 레벨 책임.
--
-- 가법·멱등·RLS:
--   - 신규 테이블 1개 + 정책 + GRANT. 기존 객체 무변경.
--   - CREATE TABLE IF NOT EXISTS / DROP POLICY IF EXISTS 후 재생성 → 재실행 안전(멱등).
--   - RLS는 products 동형(완화 아님): Public SELECT / edit=insert·update / master=delete.
--   - GRANT: 신규 테이블은 명시 GRANT가 없으면 authenticated가 42501로 막힘
--     (선례: 20260616010000_fix_events_authenticated_grant). 따라서 GRANT 명시.
--
-- ---------------------------------------------------------------------
-- [적용] Supabase 대시보드 → SQL Editor → (검수·승인 후) 본 파일 전문 1회 실행.
--        본 파일(test_groups) 먼저, 그다음 products FK 컬럼 추가 파일 실행.
-- ---------------------------------------------------------------------
--
-- [롤백] (전체 원복 필요 시 SQL Editor에 붙여넣기)
--   -- products FK 참조를 먼저 정리하거나 SET NULL 후 아래 실행 권장.
--   DROP TABLE IF EXISTS public.test_groups;  -- 정책·GRANT 함께 제거됨
-- =====================================================================

-- 1) 테이블
CREATE TABLE IF NOT EXISTS public.test_groups (
    id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    abbr        text,                            -- 약어(영문/코드). NULL 허용(약어 없는 검사군 존재). UNIQUE 아님(1약어→N검사명 실측)
    name        text    NOT NULL,                -- 한글 검사명(1뎁스 카드 메인). 필수
    category    text,                            -- 대분류 힌트(진열 그룹핑용, nullable). products.category 무변경
    sort_order  integer NOT NULL DEFAULT 0,      -- 검사군 진열 정렬용(낮을수록 먼저)
    is_active   boolean NOT NULL DEFAULT true,   -- 검사군 노출여부(false=숨김, 데이터 보존)
    created_at  timestamp with time zone NOT NULL DEFAULT now()
    -- abbr·name 에 UNIQUE 제약 없음 (surrogate PK만 유일키). 위 헤더 주석 참조.
);

COMMENT ON TABLE public.test_groups IS
  '검사군 마스터(2뎁스 진열의 1뎁스). 한글 검사명(name)이 주인공, 약어(abbr)는 보조 라벨. 상품과는 products.test_group_id FK로 1:1 연결. abbr/name 모두 중복 가능(1약어→N검사명 실측)이라 surrogate PK(id)만 유일키. 매출 집계·order_items 무관.';
COMMENT ON COLUMN public.test_groups.abbr IS '약어(영문/코드, 예 K·BASC-3). NULL 허용(약어 없는 검사군). UNIQUE 아님 — 같은 약어가 여러 검사군에 등장(SCID-5 등 실측).';
COMMENT ON COLUMN public.test_groups.name IS '한글 검사명(카드 1뎁스 메인 표기). NOT NULL.';
COMMENT ON COLUMN public.test_groups.category IS '대분류 힌트(진열 그룹핑용). NULL 허용. products.category 를 건드리지 않음 — 정합은 앱 레벨.';
COMMENT ON COLUMN public.test_groups.sort_order IS '검사군 진열 정렬(낮을수록 먼저). 프론트 ASC.';
COMMENT ON COLUMN public.test_groups.is_active IS 'false=검사군 카드 미노출(데이터 보존).';

-- 2) RLS (products 동형 — 완화 아님)
ALTER TABLE public.test_groups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view test_groups"   ON public.test_groups;
DROP POLICY IF EXISTS "Admins can insert test_groups" ON public.test_groups;
DROP POLICY IF EXISTS "Admins can update test_groups" ON public.test_groups;
DROP POLICY IF EXISTS "Admins can delete test_groups" ON public.test_groups;

CREATE POLICY "Public can view test_groups"   ON public.test_groups FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Admins can insert test_groups" ON public.test_groups FOR INSERT TO authenticated WITH CHECK (public.has_permission('edit'));
CREATE POLICY "Admins can update test_groups" ON public.test_groups FOR UPDATE TO authenticated USING (public.has_permission('edit'));
CREATE POLICY "Admins can delete test_groups" ON public.test_groups FOR DELETE TO authenticated USING (public.has_permission('master'));

-- 3) GRANT (테이블 레벨 — RLS 평가 전 권한 레이어. 신규 테이블 필수, 42501 방지)
GRANT SELECT                         ON public.test_groups TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.test_groups TO authenticated;
-- 실제 행 차단은 위 RLS 정책이 수행(GRANT는 게이트만 연다). master/edit 구분은 RLS에서.

-- =====================================================================
-- 끝. products 스키마 변경 0(FK 컬럼은 20260630010000_DRAFT에서 별도 추가).
-- category 컬럼 무변경. order_items 스냅샷 영향 0. 매출 집계 무영향.
-- =====================================================================
