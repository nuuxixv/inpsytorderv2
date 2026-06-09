-- ============================================================================
-- events 진행상태 3 boolean 추가 (A10 L2 진행상태)
-- Date: 2026-06-08
--
-- [목적]
--   - A10 L2 진행상태를 단일 text(단계) 가 아닌 3개 독립 체크박스로 관리.
--   - 누적 진행 사양(건우님 A10 명시): 일부만 완료 가능
--     (예: "기안(O) 신청(O) 지결( )"). 단계 강제 없음 → 각 플래그 독립.
--
-- [설계]
--   - draft_done               boolean DEFAULT false : 기안 완료
--   - application_done         boolean DEFAULT false : 신청 완료
--   - payment_resolution_done  boolean DEFAULT false : 지결(지불결의) 완료
--   - 전부 DEFAULT false → 기존 행도 ADD COLUMN 시 false 로 backfill(미완료) 처리.
--   - 단계 간 종속(예: 신청 전 기안 필수) 미적용 — 독립 토글. 인덱스 불필요.
--
-- [RLS — 무영향]
--   - events RLS는 20251121_apply_rbac_rls.sql 의 행(row) 단위 정책으로 이미 정의됨:
--       SELECT  anon/authenticated  USING (true)              (events:view)
--       INSERT  authenticated       has_permission('edit')    (events:edit)
--       UPDATE  authenticated       has_permission('edit')    (events:edit)
--       DELETE  authenticated       has_permission('master')  (master)
--   - 컬럼 단위 정책이 아니므로 신규 3컬럼은 위 정책에 자동 상속됨(읽기 view / 쓰기 edit).
--   - 본 마이그레이션은 RLS 정책을 일절 생성/변경/삭제하지 않음(완화 없음).
--
-- [anon 비노출]
--   - 20260608020000_revoke_anon_events_columns.sql 의 anon GRANT 화이트리스트에
--     본 3컬럼을 추가하지 않음 → anon 자동 비노출(내부 운영 필드).
--   - 화이트리스트 미포함 신규 컬럼은 anon SELECT 불가가 기본 → 누출 없음.
--
-- [멱등성]
--   - ADD COLUMN IF NOT EXISTS 만 사용 → 재실행 안전. backfill/UPDATE 없음
--     (DEFAULT false 가 기존 행 채움).
--
-- [적용]
--   - CI 미사용. 건우님이 Supabase 대시보드 SQL Editor에 본문 복붙 수동 적용.
--
-- [롤백]
--   - ALTER TABLE public.events DROP COLUMN IF EXISTS draft_done;
--   - ALTER TABLE public.events DROP COLUMN IF EXISTS application_done;
--   - ALTER TABLE public.events DROP COLUMN IF EXISTS payment_resolution_done;
-- ============================================================================

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS draft_done              boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS application_done        boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS payment_resolution_done boolean DEFAULT false;

COMMENT ON COLUMN public.events.draft_done              IS 'A10 L2 진행상태: 기안 완료 (독립 토글, anon 비노출)';
COMMENT ON COLUMN public.events.application_done        IS 'A10 L2 진행상태: 신청 완료 (독립 토글, anon 비노출)';
COMMENT ON COLUMN public.events.payment_resolution_done IS 'A10 L2 진행상태: 지결 완료 (독립 토글, anon 비노출)';
