-- ============================================================================
-- Migration: event_views — L2 학회 상세 열람이력 (master 전용 뷰어)
-- Date: 2026-06-10
-- Author: backend-engineer (CTO 위임 지시서)
--
-- [목적]
--   게시판 bulletin_reads 처럼 L2 학회 상세 페이지 열람을 기록.
--   - 기록: RPC record_event_view(p_event_id) 한 줄 호출 (로그인 사용자만).
--   - 조회: master 만 (has_permission('master')) — 열람이력 뷰어 전용.
--
-- [bulletin_reads 와 다른 점 — 의도적 강화]
--   - user_name 컬럼 없음: 표시 이름은 클라이언트가 user_profiles 조인
--     (profileMap 선례) → 이름 변경에 안전.
--   - INSERT/UPDATE 정책을 클라이언트에 부여하지 않음:
--     쓰기 경로는 SECURITY DEFINER RPC 단일 경로 (audit_log 불변 패턴 답습).
--     → view_count 임의 조작(직접 upsert로 큰 값 세팅) 불가.
--
-- [RLS 요약]
--   - SELECT: master 만. INSERT/UPDATE/DELETE 정책 없음 → authenticated/anon 직접 쓰기 불가.
--   - RPC 가 user_id = auth.uid() 를 강제 (본인 행만 기록됨).
--   - anon: 테이블 권한 REVOKE + RPC EXECUTE 미부여 + 함수 내 auth.uid() NULL 가드.
--
-- [멱등성] IF NOT EXISTS / OR REPLACE / DROP POLICY IF EXISTS — 반복 실행 안전.
-- [적용] Supabase 대시보드 > SQL Editor 에 본 파일 전체 붙여넣기 실행.
-- [규모] 연 800건 서비스 — 인덱스는 PK(event_id, user_id)로 충분. 추가 인덱스 없음.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. 테이블 (frontend 계약 고정 스키마)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.event_views (
  event_id        bigint REFERENCES public.events(id) ON DELETE CASCADE,
  user_id         uuid   REFERENCES auth.users(id)    ON DELETE CASCADE,
  first_viewed_at timestamptz DEFAULT now(),
  last_viewed_at  timestamptz DEFAULT now(),
  view_count      integer     DEFAULT 1,
  PRIMARY KEY (event_id, user_id)
);

COMMENT ON TABLE public.event_views IS
  'L2 학회 상세 열람이력. 쓰기는 record_event_view RPC 단일 경로, 조회는 master 전용.';

-- ----------------------------------------------------------------------------
-- 2. RLS — SELECT 는 master 만. 쓰기 정책 미부여(RPC 전용 경로).
-- ----------------------------------------------------------------------------
ALTER TABLE public.event_views ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Master can view event_views" ON public.event_views;
CREATE POLICY "Master can view event_views"
  ON public.event_views
  FOR SELECT
  TO authenticated
  USING (public.has_permission('master'));

-- (의도적으로 INSERT/UPDATE/DELETE 정책 없음 → 직접 쓰기 차단, RPC 만 허용)

-- 방어 심화: anon 전체 차단 + authenticated 직접 쓰기 권한 제거
-- (RPC 는 SECURITY DEFINER = 테이블 소유자 권한으로 동작하므로 영향 없음)
REVOKE ALL ON TABLE public.event_views FROM anon;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.event_views FROM authenticated;

-- ----------------------------------------------------------------------------
-- 3. RPC record_event_view(p_event_id) — upsert: 최초 1회 INSERT,
--    이후 last_viewed_at 갱신 + view_count 증가. 클라이언트 호출 1줄.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.record_event_view(p_event_id bigint)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
BEGIN
  -- 비로그인(anon)·JWT 없음 → 조용히 무시 (열람 기록이 화면을 깨지 않게)
  IF v_user IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO public.event_views (event_id, user_id)
  VALUES (p_event_id, v_user)
  ON CONFLICT (event_id, user_id)
  DO UPDATE SET
    last_viewed_at = now(),
    view_count     = event_views.view_count + 1;
EXCEPTION WHEN foreign_key_violation THEN
  -- 존재하지 않는 event_id 는 무시 — 기록 실패가 페이지 로드를 깨지 않게
  NULL;
END;
$$;

COMMENT ON FUNCTION public.record_event_view(bigint) IS
  'L2 학회 상세 열람 기록. auth.uid() 강제 — 본인 행만 upsert. authenticated 전용.';

-- 함수 실행 권한: authenticated 만 (PUBLIC/anon 차단)
REVOKE ALL ON FUNCTION public.record_event_view(bigint) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.record_event_view(bigint) FROM anon;
GRANT EXECUTE ON FUNCTION public.record_event_view(bigint) TO authenticated;

-- ============================================================================
-- ROLLBACK (비상시에만, CTO 승인하에)
-- ----------------------------------------------------------------------------
-- DROP FUNCTION IF EXISTS public.record_event_view(bigint);
-- DROP POLICY IF EXISTS "Master can view event_views" ON public.event_views;
-- DROP TABLE IF EXISTS public.event_views;
-- ============================================================================
