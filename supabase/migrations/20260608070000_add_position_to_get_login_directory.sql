-- ============================================================================
-- get_login_directory() RPC 에 position(직급) 컬럼 추가
-- Date: 2026-06-08
--
-- [목적]
--   - 로그인 화면(LoginPage) 담당자 버튼에 "이름+직급" 표기 필요.
--   - position(직급) 은 user_profiles 에 이미 존재(20260608030000_add_position_to_user_profiles).
--   - 기존 RPC 는 id/name/role/email 만 반환 → position 한 컬럼만 증분 추가.
--
-- [변경 범위 — 최소]
--   - RETURNS TABLE 에 position text 컬럼 추가.
--   - SELECT 에 up.position 추가. ORDER BY·FROM 무변경.
--   - LANGUAGE sql / STABLE / SECURITY DEFINER / SET search_path = public 속성 전부 유지.
--   - anon, authenticated EXECUTE 권한·RLS·다른 정책 일절 무변경.
--   - 20260601 의 원본 정의 대비 diff 는 "position 한 컬럼 추가"가 전부.
--
-- [보안 메모]
--   - position 이 anon(로그인 전)에 노출됨. 단 이 RPC 는 이미 name/email/role 을 anon 에
--     노출 중인 내부 어드민 로그인 셀렉터 → 직급 추가는 미미한 증분(추가 부채 노트는 CTO 보고).
--   - PIN 해시·관리자 메모 등 그 외 컬럼은 여전히 반환되지 않음(SELECT 명시 컬럼만).
--
-- [멱등성]
--   - CREATE OR REPLACE 만 → 반복 실행 안전.
--   - 반환 시그니처(RETURNS TABLE)가 바뀌므로, 일부 PG 에서 CREATE OR REPLACE 가
--     "cannot change return type" 으로 거부될 수 있음. 그 경우에만 아래 DROP 후 재생성.
--     (DROP 후 GRANT 가 사라지므로, 본 파일 하단 GRANT 블록이 권한을 재부여함 → 안전.)
--
-- [적용] Supabase 대시보드 SQL Editor 에 본 파일 전체 실행 (또는 supabase db push).
-- [롤백]
--   - 20260601 의 get_login_directory 정의(id/name/role/email)로 CREATE OR REPLACE 재적용.
-- ============================================================================

-- 반환 타입이 바뀌므로 기존 함수를 먼저 제거(시그니처 충돌 회피). 인자 없는 단일 함수.
DROP FUNCTION IF EXISTS public.get_login_directory();

CREATE OR REPLACE FUNCTION public.get_login_directory()
RETURNS TABLE (id uuid, name text, role text, email text, "position" text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT up.id, up.name, up.role, up.email, up."position"
  FROM public.user_profiles up
  ORDER BY up.role, up.name;
$$;

-- 실행 권한 재부여(DROP 으로 사라진 GRANT 복구) — 20260601 과 동일.
REVOKE ALL ON FUNCTION public.get_login_directory() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_login_directory() TO anon, authenticated;
