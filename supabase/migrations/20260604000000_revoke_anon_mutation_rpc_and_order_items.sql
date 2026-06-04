-- ============================================================================
-- Migration: anon 권한 차단 — 관리자 전용 mutation RPC + order_items anon SELECT
-- Date: 2026-06-04
-- Author: backend-engineer (CTO 위임 지시서)
--
-- [배경 / 확인된 취약점]
--   anon 키로 실제 탐침해 재현 완료된 라이브 보안홀:
--   (1) anon 이 mutation RPC `update_order_details(int,jsonb,jsonb)` 실행 가능
--       → 임의 주문 본문/품목 변조.
--   (2) anon 이 mutation RPC `bulk_update_order_status(bigint[],text)` 실행 가능
--       → 주문 상태 일괄 변경.
--   (3) anon 이 `order_items` 전체 SELECT 가능
--       ("Public can view order_items" 정책이 20260406 에서 생성된 뒤
--        20260407 은 orders 정책만 DROP, order_items 정책은 잔존).
--
--   근본 원인:
--   - mutation RPC 들이 PUBLIC(=anon 포함) EXECUTE 기본 부여 상태.
--   - order_items 의 anon SELECT 정책 잔존.
--
-- [이 마이그레이션이 하는 일]
--   A. 관리자 전용 mutation RPC 의 anon/PUBLIC EXECUTE 회수,
--      authenticated 에게만 EXECUTE 부여.
--   B. order_items 의 anon SELECT 정책 DROP.
--
-- [절대 건드리지 않는 것 — 고객 anon 경로 보존]
--   - 고객 주문 생성: create-order Edge Function 이 service_role 키로 직접 INSERT.
--     RPC/RLS 권한과 무관 → 무영향.
--   - 고객 주문 조회: get_order_by_token(uuid) (SECURITY DEFINER, 토큰 게이트).
--     anon EXECUTE 유지 필수 (20260407 에서 부여됨). 본 파일은 손대지 않음.
--   - 로그인 디렉터리: get_login_directory() anon EXECUTE 유지 (20260601 에서 처리).
--   - 고객 상태페이지는 get_order_by_token 이 order_items 를 JSON 으로 반환하므로
--     order_items 직접 anon SELECT 불필요 (프론트 src 전수 확인: 고객 경로에서
--     order_items 직접 select 없음. 직접 select 는 전부 어드민 authenticated 화면).
--
-- [멱등성]
--   REVOKE / GRANT / DROP POLICY IF EXISTS 는 반복 실행 안전.
--   bulk_update_order_status 는 repo 마이그레이션에 정의가 없어(대시보드 직접 생성)
--   인자 타입을 코드로 100% 확정 불가 → pg_proc 동적 조회로 시그니처 무관 회수.
--
-- [적용 방법]
--   - 프로덕션: Supabase 대시보드 > SQL Editor 에 본 파일 전체 붙여넣기 실행.
--     (또는 CTO 승인 후 `supabase db push`. 본 에이전트는 적용 금지.)
--
-- [롤백 — 권장하지 않음. 보안홀 재오픈됨]
--   파일 하단 "ROLLBACK" 주석 블록 참조.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- A. 관리자 전용 mutation RPC — anon/PUBLIC EXECUTE 회수, authenticated 만 허용
-- ----------------------------------------------------------------------------

-- A-1. update_order_details(int, jsonb, jsonb)
--      정의: 20260415_004_update_order_functions.sql (최종본). UPDATE orders + 품목 교체.
REVOKE EXECUTE ON FUNCTION public.update_order_details(int, jsonb, jsonb) FROM anon, PUBLIC;
GRANT  EXECUTE ON FUNCTION public.update_order_details(int, jsonb, jsonb) TO authenticated;

-- A-2. update_order_with_items(int, jsonb, jsonb)
--      정의: 20260415_004_update_order_functions.sql. update_order_details 와 동일 로직.
--      현재 프론트 직접 참조는 없으나(레거시) mutation 이므로 동일하게 잠금.
REVOKE EXECUTE ON FUNCTION public.update_order_with_items(int, jsonb, jsonb) FROM anon, PUBLIC;
GRANT  EXECUTE ON FUNCTION public.update_order_with_items(int, jsonb, jsonb) TO authenticated;

-- A-3. bulk_update_order_status(order_ids ..., new_status text)
--      repo 마이그레이션에 정의 없음 = 대시보드에서 직접 생성된 함수.
--      인자 배열 타입(int[] vs bigint[])을 코드로 확정 불가하므로,
--      함수명이 'bulk_update_order_status' 인 모든 오버로드에 대해 동적으로
--      anon/PUBLIC EXECUTE 회수 + authenticated GRANT.
DO $$
DECLARE
  fn record;
  signature text;
BEGIN
  FOR fn IN
    SELECT p.oid,
           pg_catalog.pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_catalog.pg_proc p
    JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'bulk_update_order_status'
  LOOP
    signature := format('public.bulk_update_order_status(%s)', fn.args);
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM anon, PUBLIC;', signature);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated;', signature);
    RAISE NOTICE 'locked bulk_update_order_status signature: %', signature;
  END LOOP;
END;
$$;

-- ----------------------------------------------------------------------------
-- B. order_items — anon SELECT 정책 제거
--    "Public can view order_items" (20260406 생성). 고객 경로 불필요 (위 주석 참조).
--    authenticated 의 "Admins can view order_items" 정책(20251121)은 유지.
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Public can view order_items" ON public.order_items;

-- ============================================================================
-- ROLLBACK (보안홀 재오픈 — 비상시에만, CTO 승인하에)
-- ----------------------------------------------------------------------------
-- -- A 회수 되돌리기:
-- GRANT EXECUTE ON FUNCTION public.update_order_details(int, jsonb, jsonb) TO anon, PUBLIC;
-- GRANT EXECUTE ON FUNCTION public.update_order_with_items(int, jsonb, jsonb) TO anon, PUBLIC;
-- -- bulk_update_order_status: 실제 시그니처 확인 후 (예: bigint[], text)
-- -- GRANT EXECUTE ON FUNCTION public.bulk_update_order_status(bigint[], text) TO anon, PUBLIC;
--
-- -- B 정책 복구:
-- CREATE POLICY "Public can view order_items" ON public.order_items
--   FOR SELECT TO anon USING (true);
-- ============================================================================
