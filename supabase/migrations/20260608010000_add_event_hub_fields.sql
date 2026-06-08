-- ============================================================================
-- events 운영필드 4개 추가 (A10 Event Hub List)
-- Date: 2026-06-08
--
-- [목적]
--   - A10 학회 통합 목록(Event Hub) 운영필드 신설. 사양: design-system/specs/A10_EventHubList.md §3.
--   - L1 목록(장소·참석자) + L2 강등 저장(비고·비용) 4필드를 events에 직접 부여.
--
-- [설계]
--   - venue          text     : 장소 (L1 노출)
--   - attendee_ids   uuid[]   : 참석자 = user_profiles.id 참조 배열 (L1 칩 압축)
--   - note           text     : 비고 (L2 강등, 다이얼로그 입력 / L1 미노출)
--   - marketing_cost integer  : 비용(원) (L2 강등, 다이얼로그 입력 / L1 미노출)
--   - 전부 NULL 허용·기본값 없음·backfill 불필요(신규 운영필드, 기존 행은 NULL 유지).
--   - attendee_ids 는 user_profiles.id 참조이나 FK 미설정(사양 §4: 연 800건 규모,
--     삭제된 uuid는 표시단 join 실패 시 "(삭제)" 처리로 방어). 인덱스 불필요.
--   - 타입 주의: events.id 는 bigint, attendee_ids 원소는 user_profiles.id(uuid).
--     서로 다른 컬럼/테이블이므로 타입 충돌 없음.
--
-- [RLS — 무영향]
--   - events RLS는 20251121_apply_rbac_rls.sql 의 행(row) 단위 정책으로 이미 정의됨:
--       SELECT  anon/authenticated  USING (true)              (events:view)
--       INSERT  authenticated       has_permission('edit')    (events:edit)
--       UPDATE  authenticated       has_permission('edit')    (events:edit)
--       DELETE  authenticated       has_permission('master')  (master)
--   - 컬럼 단위 정책이 아니므로 신규 4컬럼은 위 정책에 자동 상속됨.
--   - 본 마이그레이션은 RLS 정책을 일절 생성/변경/삭제하지 않음(완화 없음).
--
-- [멱등성]
--   - ADD COLUMN IF NOT EXISTS 만 사용 → 재실행 안전. backfill/UPDATE 없음.
--
-- [적용]
--   - CI 미사용. 건우님이 Supabase 대시보드 SQL Editor에 본문 복붙 수동 적용.
--
-- [롤백]
--   - ALTER TABLE public.events DROP COLUMN IF EXISTS venue;
--   - ALTER TABLE public.events DROP COLUMN IF EXISTS attendee_ids;
--   - ALTER TABLE public.events DROP COLUMN IF EXISTS note;
--   - ALTER TABLE public.events DROP COLUMN IF EXISTS marketing_cost;
-- ============================================================================

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS venue          text,
  ADD COLUMN IF NOT EXISTS attendee_ids   uuid[],
  ADD COLUMN IF NOT EXISTS note           text,
  ADD COLUMN IF NOT EXISTS marketing_cost integer;

COMMENT ON COLUMN public.events.venue          IS 'A10 장소 (L1 노출)';
COMMENT ON COLUMN public.events.attendee_ids   IS 'A10 참석자 = user_profiles.id 참조 배열 (FK 미설정, 표시단 방어)';
COMMENT ON COLUMN public.events.note           IS 'A10 비고 (L2 강등, L1 미노출)';
COMMENT ON COLUMN public.events.marketing_cost IS 'A10 비용(원) (L2 강등, L1 미노출)';
