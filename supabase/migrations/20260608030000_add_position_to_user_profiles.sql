-- ============================================================================
-- user_profiles.position 컬럼 추가 (지불증 직급 표시·정렬용)
-- Date: 2026-06-08
--
-- [목적]
--   - 지불증(A10 PaymentReceiptModal §5)에 멤버 직급(차장/과장/대리/사원) 표시·
--     정렬이 필요. user_profiles 에 직급 컬럼 신설. Dooray API 연동은 기각
--     (연 8일 운영에 외부 동기화 부채 = 과설계).
--
-- [설계 — department(20260602) 선례 답습하되 차이점 명시]
--   - position text, NULL 허용, 기본값 없음, backfill 없음.
--     · department 는 전원 동일값('마케팅운영팀')이 의미 있어 DEFAULT+backfill 했으나,
--       직급은 사람마다 달라 일괄 기본값이 무의미 → 빈 값(NULL) 시작 후 어드민이 개별 입력.
--   - 값 검증(CHECK) 두지 않음. 차장>과장>대리>사원 목록·정렬순서는 프론트
--     고정 드롭다운으로 통제(A10 §5). DB CHECK 는 값 추가 시 마이그레이션 부채만 발생.
--   - 로그인 셀렉터(get_login_directory RPC, 20260601)는 직급 불필요 → RPC 변경 없음(의도적).
--   - 어드민 조회는 20260607 "Authenticated can view profiles"(SELECT USING true)
--     정책이 신규 컬럼도 자동 포함. 쓰기는 service_role Edge Function
--     (update-user-profile)만 → RLS 정책 일절 변경 없음(20260601/20260607 구조 유지).
--
-- [멱등성]
--   - ADD COLUMN IF NOT EXISTS 만 → 반복 실행해도 안전. backfill 없음.
--
-- [적용] Supabase 대시보드 SQL Editor 에 본 파일 전체 실행 (또는 supabase db push).
-- [롤백]
--   - ALTER TABLE public.user_profiles DROP COLUMN IF EXISTS position;
-- ============================================================================

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS position text;

COMMENT ON COLUMN public.user_profiles.position IS
  '직급(차장/과장/대리/사원). 지불증 표시·정렬용. 값 검증은 프론트 고정 드롭다운.';
