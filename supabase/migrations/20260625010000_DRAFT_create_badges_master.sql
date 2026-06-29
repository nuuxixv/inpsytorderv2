-- =====================================================================
-- [초안 / DRAFT — 적용 금지] 배지 마스터 테이블 (badges)
-- =====================================================================
-- 상태: 설계 검토용 초안. CTO 검수 + 건우님 승인 전 SQL Editor 실행 금지.
--
-- 목적:
--   건우님이 설정 화면에서 배지를 직접 관리(추가 → 이름·색·우선순위)하기 위한
--   마스터 테이블. 예: "특가(빨강)" 등록.
--   상품 카드에 노출할 배지 라벨·색·정렬을 일관되게 관리.
--
-- 상품 ↔ 배지 연결 방식 (자연키, FK 미설정):
--   - 상품은 products.badges(text[], 20260619000000_DRAFT)에 배지 "이름"들을 저장.
--   - badges.name 과 products.badges 원소를 "이름 자연키"로 매칭.
--   - FK를 걸지 않는 이유(text[] 원소엔 애초에 FK 불가 + 엑셀 호환):
--     · 엑셀 '배지' 컬럼에 임의 값이 들어와도 upsert가 통과해야 함.
--     · 마스터 미등록 배지 이름은 UI에서 색 미지정·"미등록"으로 폴백(데이터 계약).
--   - 기존 is_popular / is_new boolean(20251022045615 / 20260313044014)과 공존.
--     삭제하지 않음 — 표시·필터·엑셀 로직이 광범위 의존. badges는 확장 슬롯.
--
-- priority(우선순위) 용도:
--   - 한 상품에 배지가 여러 개일 때 카드에서 보일 순서/상한 결정에 사용.
--   - 숫자가 낮을수록 먼저(앞쪽) 표시한다는 계약(프론트에서 ASC 정렬). 동률은 name.
--
-- 매출 집계 무영향:
--   배지는 카드 표시 전용. 매출 집계·대시보드는 category만 사용(이미 검증).
--
-- 가법·멱등·RLS:
--   - 신규 테이블 1개 + 정책 + GRANT. 기존 객체 무변경.
--   - CREATE TABLE IF NOT EXISTS / DROP POLICY IF EXISTS 후 재생성 → 재실행 안전(멱등).
--   - RLS는 products 동형(완화 아님): Public SELECT / edit=insert·update / master=delete.
--   - GRANT 명시(신규 테이블 42501 방지, 선례 20260616010000).
--
-- ---------------------------------------------------------------------
-- [적용] Supabase 대시보드 → SQL Editor → (검수·승인 후) 본 파일 전문 1회 실행.
-- ---------------------------------------------------------------------
--
-- [롤백] (전체 원복 필요 시 SQL Editor에 붙여넣기)
--   DROP TABLE IF EXISTS public.badges;  -- 정책·GRANT 함께 제거됨
-- =====================================================================

-- 1) 테이블
CREATE TABLE IF NOT EXISTS public.badges (
    id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name        text    NOT NULL,              -- 배지 라벨(전역 유일). products.badges 원소와 자연키 매칭
    color       text,                           -- 카드 배지 색상(HEX 등). NULL=기본색
    priority    integer NOT NULL DEFAULT 0,     -- 카드 다중 배지 정렬·상한용(낮을수록 먼저). 동률은 name
    is_active   boolean NOT NULL DEFAULT true,  -- 비활성 시 신규 선택지에서 숨김(데이터 보존)
    created_at  timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT badges_name_unique UNIQUE (name)
);

COMMENT ON TABLE public.badges IS
  '배지 마스터(노출 메타데이터: 색·우선순위). 상품과는 products.badges(text[]) 원소=name 자연키로 연결(FK 미설정 — text[]·엑셀 호환). is_popular/is_new와 공존. 매출 집계 무관.';
COMMENT ON COLUMN public.badges.priority IS '카드 다중 배지 정렬·상한용. 낮을수록 먼저 표시(프론트 ASC). 동률은 name.';
COMMENT ON COLUMN public.badges.color IS '카드 배지 색상. NULL=기본색.';
COMMENT ON COLUMN public.badges.is_active IS 'false=신규 선택지에서 숨김(기존 상품 데이터·라벨은 보존).';

-- 2) RLS (products 동형 — 완화 아님)
ALTER TABLE public.badges ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view badges"   ON public.badges;
DROP POLICY IF EXISTS "Admins can insert badges" ON public.badges;
DROP POLICY IF EXISTS "Admins can update badges" ON public.badges;
DROP POLICY IF EXISTS "Admins can delete badges" ON public.badges;

CREATE POLICY "Public can view badges"   ON public.badges FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Admins can insert badges" ON public.badges FOR INSERT TO authenticated WITH CHECK (public.has_permission('edit'));
CREATE POLICY "Admins can update badges" ON public.badges FOR UPDATE TO authenticated USING (public.has_permission('edit'));
CREATE POLICY "Admins can delete badges" ON public.badges FOR DELETE TO authenticated USING (public.has_permission('master'));

-- 3) GRANT (테이블 레벨 — RLS 평가 전 권한 레이어. 신규 테이블 필수)
GRANT SELECT                         ON public.badges TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.badges TO authenticated;
-- 실제 행 차단은 위 RLS 정책이 수행. master/edit 구분은 RLS에서.

-- =====================================================================
-- 끝. products 스키마 변경 0(badges 컬럼은 20260619000000_DRAFT에서 별도 추가).
-- is_popular/is_new 불변. order_items 스냅샷 영향 0. 매출 집계 무영향.
-- =====================================================================
