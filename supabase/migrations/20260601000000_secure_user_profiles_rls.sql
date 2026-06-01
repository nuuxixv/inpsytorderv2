-- ============================================================================
-- user_profiles 보안: anon 전체 노출 차단 + 로그인 셀렉터용 최소 RPC 제공
-- Date: 2026-06-01
--
-- [문제]
--   - user_profiles 테이블에 RLS가 없어 anon(비로그인)이 `select('*')`로
--     전 직원의 email/name/role 등 모든 컬럼을 조회 가능 (LoginPage.jsx:112).
--   - email은 로그인 자격증명이므로 anon 노출 = 계정 enumeration 리스크.
--
-- [설계]
--   1. user_profiles에 RLS ENABLE → anon 직접 SELECT 전면 차단.
--   2. SECURITY DEFINER RPC get_login_directory()가 로그인 셀렉터에 필요한
--      최소 컬럼(id, name, role, email)만 anon에게 반환.
--      (email은 signInWithPassword 자격증명이라 불가피하게 포함. 부채 노트 참조)
--   3. 인증 사용자(authenticated)는 user_profiles를 SELECT 가능하도록 정책 추가.
--      → AuthContext(본인 name/role 조회), bulletins/feedback(작성자 이름 매핑,
--        임의 user_id 다수 조회)가 깨지지 않게 보존.
--   4. INSERT/UPDATE/DELETE는 정책 미부여 → service_role(invite-user 등 Edge
--      Function)만 가능. (service_role은 RLS 우회)
--
-- [멱등성]
--   - ENABLE RLS / DROP POLICY IF EXISTS / CREATE OR REPLACE FUNCTION 사용.
--   - 반복 실행해도 안전.
--
-- [롤백]
--   - 이 마이그레이션이 만든 정책/함수만 제거하고 RLS를 끄면 원복:
--       DROP POLICY IF EXISTS "Authenticated can view profiles" ON public.user_profiles;
--       REVOKE EXECUTE ON FUNCTION public.get_login_directory() FROM anon, authenticated;
--       DROP FUNCTION IF EXISTS public.get_login_directory();
--       ALTER TABLE public.user_profiles DISABLE ROW LEVEL SECURITY;
--     (DISABLE 시 anon 노출 문제로 되돌아가므로 운영 롤백은 신중히.)
-- ============================================================================

-- 1) RLS 활성화 (이미 켜져 있어도 안전)
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- 2) 기존 정책 정리 (멱등성 — 본 마이그레이션이 관리하는 정책만 대상)
DROP POLICY IF EXISTS "Authenticated can view profiles" ON public.user_profiles;
-- 과거에 임시로 만들어졌을 수 있는 광역 anon 정책이 있다면 함께 제거(있을 때만 동작)
DROP POLICY IF EXISTS "Public can view profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "Allow public read access" ON public.user_profiles;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.user_profiles;

-- 3) 인증 사용자 SELECT 정책
--    AuthContext(본인 조회) + bulletins/feedback(임의 user_id 다수 조회)를
--    모두 만족시켜야 하므로 authenticated 전체에 SELECT 허용.
--    (어드민 내부 사용자만 인증되며, 이름/역할 수준 정보 — 부채 노트 참조)
CREATE POLICY "Authenticated can view profiles"
  ON public.user_profiles
  FOR SELECT
  TO authenticated
  USING (true);

-- anon에 대한 직접 SELECT 정책은 의도적으로 만들지 않음 → anon 직접 조회 차단.

-- 4) 로그인 셀렉터용 SECURITY DEFINER RPC
--    anon이 호출 가능하되, 노출 컬럼을 id/name/role/email로 한정.
--    (PIN 해시·관리자 메모 등 그 외 컬럼이 존재하더라도 절대 반환되지 않음)
CREATE OR REPLACE FUNCTION public.get_login_directory()
RETURNS TABLE (id uuid, name text, role text, email text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT up.id, up.name, up.role, up.email
  FROM public.user_profiles up
  ORDER BY up.role, up.name;
$$;

-- 5) 실행 권한: anon/authenticated 허용, public(전체) 회수
REVOKE ALL ON FUNCTION public.get_login_directory() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_login_directory() TO anon, authenticated;
