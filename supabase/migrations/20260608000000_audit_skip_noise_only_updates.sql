-- ============================================================================
-- Migration: 감사 로그 노이즈 억제 — 시스템 자동 필드만 바뀐 UPDATE는 기록 skip
-- Date: 2026-06-08
--
-- [배경]
--   주문 상태를 pending→paid 로 바꾸면 audit_log 에 2건이 쌓였음:
--     (1) status: pending→paid (사람이 한 실제 변경) — 기록 필요
--     (2) alimtalk_sent_at: null→시각 (결제완료 후 알림톡 발송시각 자동 기록) — 노이즈
--   (2)는 사람의 행동이 아니라 시스템 bookkeeping 이므로 감사 로그에서 제외한다.
--
-- [해결]
--   fn_audit_capture() 재정의(CREATE OR REPLACE). UPDATE 일 때, 노이즈 필드
--   (alimtalk_sent_at, updated_at)를 제거한 OLD/NEW 가 동일하면 = 의미있는 변경이
--   없으면 기록하지 않고 조용히 반환. 그 외 로직(actor 식별·before/after·summary·
--   원 트랜잭션 보호)은 20260606 과 동일.
--
-- [영향]
--   - 사람이 한 진짜 변경(status/금액/고객정보/품목/학회/상품/설정 등)은 그대로 기록.
--   - alimtalk_sent_at / updated_at 만 바뀐 자동 업데이트만 누락(의도).
--   - 트리거 자체는 그대로(함수만 교체). INSERT/DELETE 는 영향 없음.
--
-- [멱등] CREATE OR REPLACE FUNCTION. 반복 실행 안전.
-- [적용] 대시보드 SQL Editor 에 본 파일 실행 (또는 supabase db push).
-- ============================================================================

CREATE OR REPLACE FUNCTION public.fn_audit_capture()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_noise      text[] := ARRAY['alimtalk_sent_at', 'updated_at']; -- 시스템 자동 필드(노이즈)
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
