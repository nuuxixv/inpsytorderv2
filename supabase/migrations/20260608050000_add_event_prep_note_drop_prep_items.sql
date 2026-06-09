-- ============================================================================
-- events 준비 노트(통합 리치 에디터 본문) 추가 + prep_items 제거 (L2 통합 에디터)
-- Date: 2026-06-08
--
-- [목적]
--   - L2 "준비 노트": 준비물 + 학회 자료(이미지) + 학회 정보를 통합 리치 에디터
--     (Toast UI Editor) 한 칸에 입력하기로 결정. 에디터 본문(HTML)을 events에 저장.
--   - 직전(20260608040000)에 추가한 prep_items(체크리스트 jsonb)는 통합 에디터로
--     대체되므로 제거. 해당 컬럼은 방금 추가됐고 실데이터 없음(DEFAULT '[]'만 존재).
--
-- [설계]
--   - prep_note text : 통합 에디터 HTML 본문 (NULL 허용·기본값 없음·backfill 불필요).
--     에디터 내 이미지는 Storage 버킷 event-images(별도 마이그레이션)에 업로드 후
--     서명 URL/경로를 본문 HTML에 포함. 본문 자체는 단일 text 컬럼으로 충분(연 800건,
--     학회 1건 단위 표시 전용 → 별도 테이블/CRUD 신설은 과설계).
--   - prep_items 제거: DROP COLUMN IF EXISTS (없어도 안전).
--   - 인덱스 불필요(검색/조인 대상 아님).
--
-- [RLS — 무영향]
--   - events RLS는 20251121_apply_rbac_rls.sql 의 행(row) 단위 정책으로 이미 정의됨:
--       SELECT  anon/authenticated  USING (true)              (events:view)
--       INSERT  authenticated       has_permission('edit')    (events:edit)
--       UPDATE  authenticated       has_permission('edit')    (events:edit)
--       DELETE  authenticated       has_permission('master')  (master)
--   - 컬럼 단위 정책이 아니므로 신규 prep_note 는 위 정책에 자동 상속됨(읽기 view / 쓰기 edit).
--   - 본 마이그레이션은 RLS 정책을 일절 생성/변경/삭제하지 않음(완화 없음).
--
-- [anon 비노출 — 엄수]
--   - 20260608020000_revoke_anon_events_columns.sql 의 anon GRANT 화이트리스트에
--     prep_note 를 추가하지 않음 → anon 자동 비노출(내부 학회 자료·매출 노출 방지).
--   - GRANT 미포함 신규 컬럼은 anon SELECT 불가가 기본 → 누출 없음.
--
-- [멱등성]
--   - ADD COLUMN IF NOT EXISTS / DROP COLUMN IF EXISTS 만 사용 → 재실행 안전.
--     backfill/UPDATE 없음.
--
-- [적용]
--   - CI 미사용. 건우님이 Supabase 대시보드 SQL Editor에 본문 복붙 수동 적용.
--
-- [롤백]
--   - ALTER TABLE public.events DROP COLUMN IF EXISTS prep_note;
--   - (prep_items 복원이 필요하면 20260608040000 본문 재실행)
-- ============================================================================

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS prep_note text;

ALTER TABLE public.events
  DROP COLUMN IF EXISTS prep_items;

COMMENT ON COLUMN public.events.prep_note IS 'L2 통합 준비 노트(Toast UI Editor HTML 본문): 준비물+학회자료+학회정보. 이미지는 Storage event-images 참조. (anon 비노출)';
