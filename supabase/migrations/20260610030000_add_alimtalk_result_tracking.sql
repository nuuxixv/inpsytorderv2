-- ============================================================================
-- Migration: 알림톡 발송 결과 추적 컬럼 3개 + 감사로그 노이즈 목록 확장
-- Date: 2026-06-10
--
-- [배경]
--   기존에는 alimtalk_sent_at(성공 시각)만 있어 실패 여부·사유·마지막 시도
--   시각을 알 수 없었음. 발송 성공/실패를 orders 에 직접 기록한다.
--
-- [스키마 — frontend 와 계약 고정]
--   alimtalk_status        text         -- 'sent' | 'failed', null = 미시도
--   alimtalk_error         text         -- 실패 시 result_code + 메시지
--   alimtalk_attempted_at  timestamptz  -- 마지막 시도 시각
--   * 기존 alimtalk_sent_at(성공 시각)은 그대로 유지.
--
-- [백필]
--   alimtalk_sent_at IS NOT NULL 인 기존 행 → alimtalk_status = 'sent'.
--
-- [감사로그 노이즈 확장]
--   fn_audit_capture() 재정의(CREATE OR REPLACE). 신규 3컬럼은 시스템
--   bookkeeping 이므로 노이즈 목록(기존: alimtalk_sent_at, updated_at)에 추가.
--   그 외 로직(actor 식별·before/after·summary·원 트랜잭션 보호)은
--   20260608000000 과 완전 동일 — 노이즈 배열만 확장.
--
-- [RLS/보안]
--   - orders RLS 정책 변경 없음(기존 정책 상속).
--   - orders 에 anon SELECT 정책 없음(20260407 에서 제거, 토큰 RPC 만).
--   - get_order_by_token 은 orders 컬럼을 명시 select 하므로(20260608021000)
--     신규 3컬럼은 고객(토큰 보유자) 조회에 노출되지 않음. 수정 불필요.
--
-- [멱등] ADD COLUMN IF NOT EXISTS / 조건부 UPDATE / CREATE OR REPLACE.
--        반복 실행 안전.
-- [적용] 대시보드 SQL Editor 에 본 파일 전체 실행 (또는 supabase db push).
-- ============================================================================

-- (1) 컬럼 3개 추가
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS alimtalk_status text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS alimtalk_error text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS alimtalk_attempted_at timestamptz;

COMMENT ON COLUMN public.orders.alimtalk_status IS '알림톡 발송 결과: sent | failed, null=미시도';
COMMENT ON COLUMN public.orders.alimtalk_error IS '알림톡 실패 사유 (원샷 result_code + 메시지)';
COMMENT ON COLUMN public.orders.alimtalk_attempted_at IS '알림톡 마지막 시도 시각';

-- (2) 백필: 이미 발송 성공 기록이 있는 행은 status='sent'
--     (alimtalk_status IS NULL 조건으로 멱등 — 이후 failed 로 바뀐 행을 덮지 않음)
UPDATE public.orders
SET alimtalk_status = 'sent'
WHERE alimtalk_sent_at IS NOT NULL
  AND alimtalk_status IS NULL;

-- (3) 감사로그 노이즈 목록 확장 — 20260608000000 구조 그대로, v_noise 만 확장
CREATE OR REPLACE FUNCTION public.fn_audit_capture()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_noise      text[] := ARRAY[
    'alimtalk_sent_at', 'updated_at',
    'alimtalk_status', 'alimtalk_error', 'alimtalk_attempted_at'
  ]; -- 시스템 자동 필드(노이즈)
  v_claims     jsonb;
  v_actor_id   uuid;
  v_actor_name text;
  v_actor_role text;
  v_action     text;
  v_target_id  text;
  v_before     jsonb;
  v_after      jsonb;
  v_summary    text;
  v_pk         text;
BEGIN
  -- (0) 노이즈 억제: UPDATE 인데 노이즈 필드만 바뀌었으면 기록하지 않음.
  IF TG_OP = 'UPDATE'
     AND (to_jsonb(OLD) - v_noise) IS NOT DISTINCT FROM (to_jsonb(NEW) - v_noise) THEN
    RETURN NEW;
  END IF;

  -- (A) 행위자 식별: request.jwt.claims 파싱 (없으면 service_role/내부 경로)
  BEGIN
    v_claims := nullif(current_setting('request.jwt.claims', true), '')::jsonb;
  EXCEPTION WHEN others THEN
    v_claims := NULL;
  END;

  IF v_claims IS NOT NULL THEN
    v_actor_id   := nullif(v_claims->>'sub', '')::uuid;
    v_actor_role := v_claims->'app_metadata'->>'role';
    v_actor_name := coalesce(v_claims->'user_metadata'->>'name', 'system');
  ELSE
    v_actor_id := NULL;
    v_actor_role := NULL;
    IF TG_OP = 'INSERT' AND TG_TABLE_NAME IN ('orders', 'order_items') THEN
      v_actor_name := 'customer';
    ELSE
      v_actor_name := 'system';
    END IF;
  END IF;

  -- (B) action / before / after
  IF TG_OP = 'INSERT' THEN
    v_action := 'create'; v_before := NULL; v_after := to_jsonb(NEW);
  ELSIF TG_OP = 'UPDATE' THEN
    v_action := 'update'; v_before := to_jsonb(OLD); v_after := to_jsonb(NEW);
  ELSIF TG_OP = 'DELETE' THEN
    v_action := 'delete'; v_before := to_jsonb(OLD); v_after := NULL;
  END IF;

  v_pk := coalesce(v_after->>'id', v_before->>'id');
  v_target_id := v_pk;

  -- (C) summary
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

  -- (D) 기록 — 어떤 실패도 원 트랜잭션을 깨지 않도록 예외 흡수
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
    NULL;
  END;

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
EXCEPTION WHEN others THEN
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;
