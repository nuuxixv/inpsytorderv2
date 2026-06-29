-- =====================================================================
-- [초안 / DRAFT — 적용 금지] 소분류 마스터 테이블 (subcategories)
-- =====================================================================
-- 상태: 설계 검토용 초안. CTO 검수 + 건우님 승인 전 SQL Editor 실행 금지.
--
-- 목적:
--   건우님이 설정 화면에서 소분류를 직접 관리(추가 → 이름·색·정렬)하기 위한
--   마스터 테이블. 예: "상담(파랑, 소속=도구)" 등록.
--   상품 카드/필터에서 소분류 라벨·색을 일관되게 노출하기 위함.
--
-- 상품 ↔ 소분류 연결 방식 (자연키, FK 미설정):
--   - 상품은 기존 컬럼 products.sub_category(text)에 소분류 "이름"을 그대로 저장.
--   - subcategories.name 과 products.sub_category 를 "이름 자연키"로 매칭.
--   - FK를 걸지 않는 이유:
--     · 엑셀 업로드(upload-products-excel) 호환 — 엑셀에 임의 sub_category가 들어와도
--       upsert가 FK 위반 없이 통과해야 함. 마스터 미등록 값도 데이터로 보존.
--     · 미등록 sub_category 는 UI에서 "미등록"으로 표시(데이터 계약, 하단 주석 참조).
--     · 마스터는 "노출용 메타데이터(색·정렬)" 소스일 뿐, 상품 분류의 진실 소스는
--       여전히 products.sub_category 컬럼. 마스터 없는 분류도 정상 영업 가능.
--   - parent_category 는 대분류(검사/도서/도구)와의 소속 관계를 나타냄.
--     products.category 와의 정합성은 UI/운영 책임(앱 레벨), DB 강제 아님.
--
-- 매출 집계 무영향:
--   매출 집계·대시보드는 products.category(대분류)만 사용(이미 검증).
--   소분류·배지는 노출 전용 — 본 테이블은 집계 경로에 일절 끼지 않음.
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
-- ---------------------------------------------------------------------
--
-- [롤백] (전체 원복 필요 시 SQL Editor에 붙여넣기)
--   DROP TABLE IF EXISTS public.subcategories;  -- 정책·GRANT 함께 제거됨
-- =====================================================================

-- 1) 테이블
CREATE TABLE IF NOT EXISTS public.subcategories (
    id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name            text    NOT NULL,
    parent_category text    NOT NULL,             -- 검사 / 도서 / 도구 (대분류 소속)
    color           text,                          -- 카드/칩 색상(HEX 등). NULL=기본색
    sort_order      integer NOT NULL DEFAULT 0,    -- 설정 화면·노출 정렬용
    is_active       boolean NOT NULL DEFAULT true, -- 비활성 시 신규 선택지에서 숨김(데이터 보존)
    created_at      timestamp with time zone NOT NULL DEFAULT now(),
    -- 같은 대분류 안에서 소분류 이름 중복 금지(자연키 매칭의 유일성 보장)
    CONSTRAINT subcategories_parent_name_unique UNIQUE (parent_category, name)
);

COMMENT ON TABLE public.subcategories IS
  '소분류 마스터(노출 메타데이터: 색·정렬). 상품과는 products.sub_category=name 자연키로 연결(FK 미설정 — 엑셀 업로드 호환). 매출 집계는 category만 사용하므로 본 테이블 무관.';
COMMENT ON COLUMN public.subcategories.parent_category IS '대분류 소속(검사/도서/도구). products.category 정합은 앱 레벨 책임, DB 강제 아님.';
COMMENT ON COLUMN public.subcategories.color IS '카드/칩 색상. NULL=기본색.';
COMMENT ON COLUMN public.subcategories.is_active IS 'false=신규 선택지에서 숨김(기존 상품 데이터·라벨은 보존).';

-- 2) RLS (products 동형 — 완화 아님)
ALTER TABLE public.subcategories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view subcategories"   ON public.subcategories;
DROP POLICY IF EXISTS "Admins can insert subcategories" ON public.subcategories;
DROP POLICY IF EXISTS "Admins can update subcategories" ON public.subcategories;
DROP POLICY IF EXISTS "Admins can delete subcategories" ON public.subcategories;

CREATE POLICY "Public can view subcategories"   ON public.subcategories FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Admins can insert subcategories" ON public.subcategories FOR INSERT TO authenticated WITH CHECK (public.has_permission('edit'));
CREATE POLICY "Admins can update subcategories" ON public.subcategories FOR UPDATE TO authenticated USING (public.has_permission('edit'));
CREATE POLICY "Admins can delete subcategories" ON public.subcategories FOR DELETE TO authenticated USING (public.has_permission('master'));

-- 3) GRANT (테이블 레벨 — RLS 평가 전 권한 레이어. 신규 테이블 필수)
GRANT SELECT                         ON public.subcategories TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.subcategories TO authenticated;
-- 실제 행 차단은 위 RLS 정책이 수행(GRANT는 게이트만 연다). master/edit 구분은 RLS에서.

-- =====================================================================
-- 끝. products 스키마 변경 0. order_items 스냅샷 영향 0. 매출 집계 무영향.
-- =====================================================================
