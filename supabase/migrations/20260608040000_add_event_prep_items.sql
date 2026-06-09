-- ============================================================================
-- events 준비물 체크리스트 추가 (A10 L2 준비물)
-- Date: 2026-06-08
--
-- [목적]
--   - A10 L2 학회 준비물(가져갈 상품/물품) 체크리스트를 events 에 직접 저장.
--   - 연 8일·학회 1건 단위 표시 전용 → 별도 테이블/CRUD/RLS 신설 안 함.
--     jsonb 단일 컬럼이 적합(과설계 회피).
--
-- [설계]
--   - prep_items jsonb DEFAULT '[]'::jsonb
--       배열 구조: [{ "id": string, "label": string, "qty": number, "done": boolean }]
--         - id    : 항목 식별자(프론트 생성, 정렬/토글 키)
--         - label : 품목명
--         - qty   : 수량
--         - done  : 체크(준비 완료) 여부
--   - DEFAULT '[]'::jsonb → 기존 행도 ADD COLUMN 시 빈 배열로 backfill(준비물 없음) 처리.
--   - 단일 학회당 소량 항목 표시 전용. 인덱스 불필요(검색/조인 대상 아님).
--
-- [RLS — 무영향]
--   - events RLS는 20251121_apply_rbac_rls.sql 의 행(row) 단위 정책으로 이미 정의됨:
--       SELECT  anon/authenticated  USING (true)              (events:view)
--       INSERT  authenticated       has_permission('edit')    (events:edit)
--       UPDATE  authenticated       has_permission('edit')    (events:edit)
--       DELETE  authenticated       has_permission('master')  (master)
--   - 컬럼 단위 정책이 아니므로 신규 컬럼은 위 정책에 자동 상속됨(읽기 view / 쓰기 edit).
--   - 본 마이그레이션은 RLS 정책을 일절 생성/변경/삭제하지 않음(완화 없음).
--
-- [anon 비노출]
--   - 20260608020000_revoke_anon_events_columns.sql 의 anon GRANT 화이트리스트에
--     prep_items 를 추가하지 않음 → anon 자동 비노출(내부 운영 필드).
--   - GRANT 미포함 신규 컬럼은 anon SELECT 불가가 기본 → 누출 없음.
--
-- [멱등성]
--   - ADD COLUMN IF NOT EXISTS 만 사용 → 재실행 안전. backfill/UPDATE 없음
--     (DEFAULT '[]'::jsonb 가 기존 행 채움).
--
-- [적용]
--   - CI 미사용. 건우님이 Supabase 대시보드 SQL Editor에 본문 복붙 수동 적용.
--
-- [롤백]
--   - ALTER TABLE public.events DROP COLUMN IF EXISTS prep_items;
-- ============================================================================

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS prep_items jsonb DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.events.prep_items IS 'A10 L2 준비물 체크리스트: [{id,label,qty,done}] (anon 비노출)';
