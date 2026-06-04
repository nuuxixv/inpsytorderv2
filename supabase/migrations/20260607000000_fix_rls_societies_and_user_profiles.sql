-- ============================================================================
-- Migration: RLS 보강 — societies(RLS 미설정) + user_profiles(anon 잔존 노출)
-- Date: 2026-06-07
--
-- [배경 / 확인된 노출 — anon 키로 실제 재현]
--   (1) public.societies : RLS 미설정(Supabase 어드바이저 Critical).
--       anon 이 학회 목록 SELECT + INSERT/UPDATE/DELETE 모두 가능.
--   (2) public.user_profiles : 20260601 이 RLS ENABLE + authenticated SELECT 로
--       막았어야 하나, anon 이 전원(이름/역할/email/부서) SELECT 가능 상태가 재현됨.
--       → 이름이 다른 잔존 anon SELECT 정책이 남았거나 RLS 가 꺼진 것으로 판단.
--       email 은 로그인 자격증명 → anon 노출 = 계정 enumeration 리스크.
--
-- [이 마이그레이션이 하는 일]
--   A. societies : RLS ENABLE. authenticated SELECT. 쓰기는 events:edit(+master) 만.
--   B. user_profiles : RLS ENABLE 재확인 + 기존 정책 전부 DROP(잔존 anon 정책 확실 제거)
--      후 authenticated SELECT 정책만 재생성. 쓰기 정책 없음(=service_role Edge Function
--      만 변경, RLS 우회). 로그인은 get_login_directory() RPC(SECURITY DEFINER) 유지.
--
-- [고객/어드민 경로 보존]
--   - societies 는 고객 주문 페이지에서 안 쓰임(어드민 전용 드롭다운) → authenticated SELECT 면 충분.
--   - user_profiles: AuthContext 가 본인 프로필을 authenticated 로 SELECT → 유지됨.
--     anon 로그인은 get_login_directory RPC 경유(직접 SELECT 아님) → 영향 없음.
--   - 두 테이블 쓰기는 어드민(events:edit / service_role Edge Function)만.
--
-- [멱등성] ENABLE RLS / DROP POLICY IF EXISTS / pg_policies 동적 드롭 → 반복 안전.
-- [적용] Supabase 대시보드 SQL Editor 에 본 파일 전체 실행 (또는 supabase db push).
-- [롤백] 파일 하단 주석 참조(보안 재오픈이므로 비권장).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- A. societies — RLS ENABLE + authenticated SELECT + events:edit 쓰기
-- ----------------------------------------------------------------------------
ALTER TABLE public.societies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can view societies" ON public.societies;
CREATE POLICY "Authenticated can view societies"
  ON public.societies FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "events_edit can insert societies" ON public.societies;
CREATE POLICY "events_edit can insert societies"
  ON public.societies FOR INSERT TO authenticated
  WITH CHECK (public.has_permission('events:edit'));

DROP POLICY IF EXISTS "events_edit can update societies" ON public.societies;
CREATE POLICY "events_edit can update societies"
  ON public.societies FOR UPDATE TO authenticated
  USING (public.has_permission('events:edit'))
  WITH CHECK (public.has_permission('events:edit'));

DROP POLICY IF EXISTS "events_edit can delete societies" ON public.societies;
CREATE POLICY "events_edit can delete societies"
  ON public.societies FOR DELETE TO authenticated
  USING (public.has_permission('events:edit'));

-- ----------------------------------------------------------------------------
-- B. user_profiles — RLS 재확인 + 기존 정책 전부 제거 후 authenticated SELECT 만
-- ----------------------------------------------------------------------------
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- 잔존 anon/public 정책을 이름 무관하게 전부 제거 (이게 노출 원인)
DO $$
DECLARE pol record;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'user_profiles'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.user_profiles;', pol.policyname);
  END LOOP;
END $$;

-- 인증 사용자만 조회 (본인/타 어드민 프로필 — AuthContext 등에서 사용)
CREATE POLICY "Authenticated can view profiles"
  ON public.user_profiles FOR SELECT TO authenticated USING (true);
-- 쓰기 정책 의도적으로 없음 → service_role Edge Function(invite/update-user-* )만 변경(RLS 우회).

-- ============================================================================
-- ROLLBACK (보안 재오픈 — 비상시에만)
-- -- A: DROP POLICY ... societies 4종 + ALTER TABLE public.societies DISABLE ROW LEVEL SECURITY;
-- -- B: user_profiles 는 원복 시 anon 노출 재발 — 권장하지 않음.
-- ============================================================================
