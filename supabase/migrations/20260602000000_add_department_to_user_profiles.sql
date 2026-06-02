-- ============================================================================
-- user_profiles.department 컬럼 추가 (어드민 사용자 관리 강화)
-- Date: 2026-06-02
--
-- [목적]
--   - 어드민 사용자에 소속 부서 정보 부여. master가 타 사용자의 부서를
--     조회/수정할 수 있도록 컬럼 신설.
--
-- [설계]
--   - department text, 기본값 '마케팅운영팀'. 기존 행은 NULL → 기본값으로 backfill.
--   - 로그인 셀렉터(get_login_directory RPC, 20260601)는 id/name/role/email만
--     반환하며 department는 로그인에 불필요하므로 RPC 변경 없음(의도적).
--   - 어드민 내부 조회는 20260601의 "Authenticated can view profiles"
--     (SELECT USING true) 정책으로 이미 커버됨 — 신규 컬럼도 자동 포함.
--   - INSERT/UPDATE/DELETE 정책은 20260601에서 미부여 → service_role
--     (Edge Function update-user-profile)만 변경 가능. 본 마이그레이션은
--     RLS 정책을 일절 건드리지 않음(충돌 없음).
--
-- [멱등성]
--   - ADD COLUMN IF NOT EXISTS / UPDATE ... WHERE department IS NULL.
--   - 반복 실행해도 안전(backfill은 NULL인 행만 대상).
--
-- [롤백]
--   - ALTER TABLE public.user_profiles DROP COLUMN IF EXISTS department;
-- ============================================================================

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS department text DEFAULT '마케팅운영팀';

-- 기존 행 backfill (DEFAULT는 신규 행에만 적용되므로 기존 NULL 행 채움)
UPDATE public.user_profiles
  SET department = '마케팅운영팀'
  WHERE department IS NULL;
