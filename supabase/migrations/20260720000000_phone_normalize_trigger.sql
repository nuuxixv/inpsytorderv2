-- ============================================================================
-- orders.phone_number "숫자만 저장" 강제 트리거
-- ----------------------------------------------------------------------------
-- 배경: 연락처를 DB에는 숫자만 저장하고 표시할 때만 하이픈 포맷한다(건우님 결정
--       2026-07-15). 저장 경로가 10곳+ (create-order Edge Fn insert / NewOrderModal
--       직접 insert / OrderSections 직접 update / update RPC 5개 / 그룹 RPC 2개의
--       phone 복사)로 흩어져 있어 경로마다 정규화를 심는 대신, 테이블 트리거 1개로
--       INSERT·UPDATE 시점에 일괄 강제한다. 이후 프론트는 표시 시 formatPhone으로
--       하이픈을 재구성한다(별도 트랙, 파일 안 겹침).
--
-- 정규화 규칙:
--   phone_number = NULLIF(regexp_replace(coalesce(phone_number,''), '\D', '', 'g'), '')
--   · 숫자(\d) 외 문자(하이픈·공백·괄호 등) 전부 제거.
--   · 결과가 빈 문자열이면 NULL 로 저장(빈 문자열 축적 방지, 기존 nullable 스키마 존중).
--   · phone_number 가 NULL 이면 NULL 유지.
--
-- 멱등성:
--   · 함수는 CREATE OR REPLACE, 트리거는 DROP IF EXISTS 후 CREATE → 재적용 안전.
--   · 이미 숫자만 있는 값에 regexp_replace 를 다시 적용해도 동일 값 → 값 관점도 멱등.
--   · 그룹 RPC(link_orders_into_group / reassign_group_representative)가 대표의
--     phone_number 를 자식·껍데기로 "복사"하는데, 원본이 이미 정규화된 상태이므로
--     복사 시 UPDATE/INSERT 트리거가 재정규화해도 값이 바뀌지 않는다(멱등).
--
-- 적용: Supabase 대시보드 SQL Editor 에서 수동 실행(건우님 승인 후). CLI push 아님.
-- 주의: RLS 정책은 건드리지 않는다. 이 파일은 트리거 함수 + 트리거만 생성한다.
-- ============================================================================

-- 트리거 함수: BEFORE INSERT/UPDATE 시 NEW.phone_number 를 숫자만 남기도록 정규화.
-- SECURITY INVOKER(기본) — 테이블을 조회하지 않고 NEW 행만 변형하므로 승격 불필요.
-- SET search_path = public — 프로젝트 함수 관례. 사용 함수(regexp_replace/nullif/
-- coalesce)는 모두 pg_catalog 내장이라 안전하며 search_path 하이재킹 여지 없음.
CREATE OR REPLACE FUNCTION public.normalize_order_phone_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.phone_number := NULLIF(
    regexp_replace(coalesce(NEW.phone_number, ''), '\D', '', 'g'),
    ''
  );
  RETURN NEW;
END;
$$;

-- 트리거 재생성(멱등). INSERT·UPDATE 모두에 부착 — 모든 저장 경로를 한 지점에서 강제.
DROP TRIGGER IF EXISTS trg_normalize_order_phone_number ON public.orders;
CREATE TRIGGER trg_normalize_order_phone_number
  BEFORE INSERT OR UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.normalize_order_phone_number();
