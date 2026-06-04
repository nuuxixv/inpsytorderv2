-- ============================================================================
-- Migration: 감사 로그(audit_log) — 불변 변경 이력
-- Date: 2026-06-06
-- Author: backend-engineer (CTO 위임 지시서)
--
-- [목적]
--   누가(actor) 무엇을(action/target) 언제(created_at) 바꿨는지 단일 테이블에 기록.
--   - 데이터 변경(orders/order_items/events/products/site_settings): AFTER 트리거 자동 기록.
--   - 사용자관리(Auth app_metadata 변경): 트리거가 못 잡으므로 Edge Function 이 명시 기록.
--   - 로그인 기록: 하지 않음 (건우님 결정).
--   - 보존: 무기한 (TTL/파티셔닝 없음 — 연 800건 규모, 불필요).
--
-- [불변성 설계]
--   - SELECT 는 master 만 (has_permission('master')).
--   - INSERT/UPDATE/DELETE 정책은 부여하지 않음
--     → RLS 적용 대상(anon/authenticated)은 INSERT/UPDATE/DELETE 전부 불가.
--   - 실제 기록 경로:
--       (a) 트리거 함수 fn_audit_capture() = SECURITY DEFINER → RLS bypass 로 INSERT.
--       (b) Edge Function = service_role 키 → RLS bypass 로 INSERT.
--     둘 다 RLS 정책과 무관하게 쓰므로, INSERT 정책 부재가 기록을 막지 않음.
--   - master 라도 UPDATE/DELETE 정책이 없어 로그 수정·삭제 불가 (불변 보장).
--
-- [원 트랜잭션 보호 — 핵심]
--   트리거 함수는 절대 RAISE 하지 않음. 내부 예외는 모두 삼키고 NULL/원행을 리턴.
--   감사 기록 실패가 주문 저장 같은 원 트랜잭션을 깨뜨리면 안 되기 때문.
--
-- [멱등성]
--   CREATE TABLE/INDEX IF NOT EXISTS, CREATE OR REPLACE FUNCTION,
--   DROP POLICY/TRIGGER IF EXISTS 후 재생성 → 반복 실행 안전.
--
-- [적용 방법]
--   - 프로덕션: Supabase 대시보드 > SQL Editor 에 본 파일 전체 붙여넣기 실행.
--     (또는 CTO 승인 후 `supabase db push`. 본 에이전트는 적용 금지.)
--
-- [건드리지 않는 것]
--   - 20260406_add_status_history_to_orders.sql 의 trg_status_history /
--     append_status_history() (BEFORE UPDATE, orders) — 유지. 본 파일과 무관·무충돌.
--   - user_profiles 에는 트리거를 걸지 않음 (사용자관리는 Edge Function 명시 기록 → 중복 방지).
--
-- [롤백] 파일 하단 ROLLBACK 주석 참조.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. audit_log 테이블
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.audit_log (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  actor_id     uuid,                                   -- 행위자 Auth user id (system/customer 경로면 NULL)
  actor_name   text,                                   -- 행위자 이름 (없으면 'system'/'customer')
  actor_role   text,                                   -- 행위자 역할 (master/operator 등, 없으면 NULL)
  action       text NOT NULL,                          -- 'create'/'update'/'delete'/'role_change' 등
  target_table text NOT NULL,                          -- 대상 테이블/도메인 ('orders','user_auth' 등)
  target_id    text,                                   -- 대상 식별자 (PK 문자열화 — int/uuid 혼재 대응)
  before       jsonb,                                  -- 변경 전 스냅샷 (INSERT 시 NULL)
  after        jsonb,                                  -- 변경 후 스냅샷 (DELETE 시 NULL)
  summary      text,                                   -- 사람이 읽는 한 줄 요약
  created_at   timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.audit_log IS '불변 감사 로그. SECURITY DEFINER 트리거 + service_role Edge Function 만 INSERT. 수정·삭제 불가.';

-- 인덱스: 최신순 목록 / 행위자별 / 대상별 조회
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at   ON public.audit_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_actor_id     ON public.audit_log (actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_target       ON public.audit_log (target_table, target_id);

-- ----------------------------------------------------------------------------
-- 2. RLS — SELECT 는 master 만. INSERT/UPDATE/DELETE 정책 미부여(불변).
-- ----------------------------------------------------------------------------
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Master can view audit_log" ON public.audit_log;
CREATE POLICY "Master can view audit_log"
  ON public.audit_log
  FOR SELECT
  TO authenticated
  USING (public.has_permission('master'));

-- (의도적으로 INSERT/UPDATE/DELETE 정책 없음 → 불변 로그)

-- ----------------------------------------------------------------------------
-- 3. 트리거 함수 fn_audit_capture()  (SECURITY DEFINER, 절대 RAISE 금지)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_audit_capture()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_claims      jsonb;
  v_actor_id    uuid;
  v_actor_name  text;
  v_actor_role  text;
  v_action      text;
  v_target_id   text;
  v_before      jsonb;
  v_after       jsonb;
  v_summary     text;
  v_pk          text;
BEGIN
  -- (A) 행위자 식별: request.jwt.claims 파싱 (없으면 service_role/내부 경로)
  BEGIN
    v_claims := nullif(current_setting('request.jwt.claims', true), '')::jsonb;
  EXCEPTION WHEN others THEN
    v_claims := NULL;
  END;

  IF v_claims IS NOT NULL THEN
    -- 로그인 사용자(어드민) 경로
    v_actor_id   := nullif(v_claims->>'sub', '')::uuid;
    v_actor_role := v_claims->'app_metadata'->>'role';
    v_actor_name := coalesce(v_claims->'user_metadata'->>'name', 'system');
  ELSE
    -- claims 없음 = service_role 경유.
    -- orders/order_items 의 INSERT(=고객 주문 생성, create-order Edge Function)는 'customer',
    -- 그 외 내부 변경은 'system' 으로 분기.
    v_actor_id := NULL;
    v_actor_role := NULL;
    IF TG_OP = 'INSERT' AND TG_TABLE_NAME IN ('orders', 'order_items') THEN
      v_actor_name := 'customer';
    ELSE
      v_actor_name := 'system';
    END IF;
  END IF;

  -- (B) action / before / after / target_id 구성
  IF TG_OP = 'INSERT' THEN
    v_action := 'create';
    v_before := NULL;
    v_after  := to_jsonb(NEW);
  ELSIF TG_OP = 'UPDATE' THEN
    v_action := 'update';
    v_before := to_jsonb(OLD);
    v_after  := to_jsonb(NEW);
  ELSIF TG_OP = 'DELETE' THEN
    v_action := 'delete';
    v_before := to_jsonb(OLD);
    v_after  := NULL;
  END IF;

  -- target_id: 모든 대상 테이블이 'id' PK 보유 → 문자열화. 없으면 NULL.
  v_pk := coalesce(v_after->>'id', v_before->>'id');
  v_target_id := v_pk;

  -- (C) summary 한 줄 (한국어)
  v_summary := format('%s 가 %s 테이블 #%s 을(를) %s',
                      coalesce(v_actor_name, 'system'),
                      TG_TABLE_NAME,
                      coalesce(v_target_id, '?'),
                      CASE v_action
                        WHEN 'create' THEN '생성'
                        WHEN 'update' THEN '수정'
                        WHEN 'delete' THEN '삭제'
                        ELSE v_action
                      END);

  -- (D) 기록. 어떤 실패도 원 트랜잭션을 깨지 않도록 예외 흡수.
  BEGIN
    INSERT INTO public.audit_log (
      actor_id, actor_name, actor_role,
      action, target_table, target_id,
      before, after, summary
    ) VALUES (
      v_actor_id, v_actor_name, v_actor_role,
      v_action, TG_TABLE_NAME, v_target_id,
      v_before, v_after, v_summary
    );
  EXCEPTION WHEN others THEN
    -- 감사 기록 실패는 무시 (원 작업 보호). RAISE 금지.
    NULL;
  END;

  -- AFTER 트리거이므로 반환값은 무시되지만 컨벤션상 적절히 반환.
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
EXCEPTION WHEN others THEN
  -- 함수 본문 어디서든 예외가 새어나와도 원 트랜잭션 보호.
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

-- ----------------------------------------------------------------------------
-- 4. 트리거 부착 — orders, order_items, events, products, site_settings
--    AFTER INSERT/UPDATE/DELETE FOR EACH ROW.
--    user_profiles 에는 부착하지 않음 (Edge Function 명시 기록 → 중복 방지).
-- ----------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_audit_orders ON public.orders;
CREATE TRIGGER trg_audit_orders
  AFTER INSERT OR UPDATE OR DELETE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_capture();

DROP TRIGGER IF EXISTS trg_audit_order_items ON public.order_items;
CREATE TRIGGER trg_audit_order_items
  AFTER INSERT OR UPDATE OR DELETE ON public.order_items
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_capture();

DROP TRIGGER IF EXISTS trg_audit_events ON public.events;
CREATE TRIGGER trg_audit_events
  AFTER INSERT OR UPDATE OR DELETE ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_capture();

DROP TRIGGER IF EXISTS trg_audit_products ON public.products;
CREATE TRIGGER trg_audit_products
  AFTER INSERT OR UPDATE OR DELETE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_capture();

DROP TRIGGER IF EXISTS trg_audit_site_settings ON public.site_settings;
CREATE TRIGGER trg_audit_site_settings
  AFTER INSERT OR UPDATE OR DELETE ON public.site_settings
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_capture();

-- ============================================================================
-- ROLLBACK (비상시에만, CTO 승인하에)
-- ----------------------------------------------------------------------------
-- DROP TRIGGER IF EXISTS trg_audit_orders        ON public.orders;
-- DROP TRIGGER IF EXISTS trg_audit_order_items   ON public.order_items;
-- DROP TRIGGER IF EXISTS trg_audit_events        ON public.events;
-- DROP TRIGGER IF EXISTS trg_audit_products      ON public.products;
-- DROP TRIGGER IF EXISTS trg_audit_site_settings ON public.site_settings;
-- DROP FUNCTION IF EXISTS public.fn_audit_capture();
-- DROP POLICY IF EXISTS "Master can view audit_log" ON public.audit_log;
-- DROP TABLE IF EXISTS public.audit_log;
-- ============================================================================
