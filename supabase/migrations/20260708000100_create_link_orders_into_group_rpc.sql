-- 주문 연계(합배송) — 종합 상태 파생 헬퍼 + 연계 생성 RPC
-- 설계: docs/superpowers/specs/2026-07-07-주문연계-그룹모델-재설계-design.md §2, §4, §5.1
--
-- 멱등: CREATE OR REPLACE. 2회 실행 무에러.

-- ── 헬퍼: 자식 id 배열의 종합(파생) 상태 ─────────────────────────────
-- 규칙(§5.1): 취소/환불 제외한 활성 자식 기준으로 "가장 뒤처진 단계"를 반환.
--   pending < paid < completed. 활성 자식이 없으면 'cancelled'.
CREATE OR REPLACE FUNCTION public._derive_group_status(p_child_ids bigint[])
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN bool_or(status = 'pending')   THEN 'pending'
    WHEN bool_or(status = 'paid')      THEN 'paid'
    WHEN bool_or(status = 'completed') THEN 'completed'
    ELSE 'cancelled'
  END
  FROM orders
  WHERE id = ANY (p_child_ids)
    AND status NOT IN ('cancelled', 'refunded');
$$;

-- 내부 전용 헬퍼 — 직접 실행 권한 회수(정의자 RPC 내부에서만 호출).
REVOKE ALL ON FUNCTION public._derive_group_status(bigint[]) FROM PUBLIC;

-- ── RPC: 연계 생성 ───────────────────────────────────────────────
-- 단일 트랜잭션(플pgsql 함수는 암묵 트랜잭션):
--   1) 권한/입력 검증(edit, 2건+, 대표 포함, 중복/존재/이미그룹/학회일치/취소환불 배제)
--   2) Case B — 비대표 pending 자식의 배송비 0 처리 + final_payment 차감(paid/completed 불변)
--   3) 껍데기 INSERT(is_group_parent=true, event=자식공통, 대표 자식 name/phone/주소 동결복사,
--      final_payment=자식합, delivery_fee=0, status=종합 파생)
--   4) 자식 parent_order_id UPDATE
-- 반환: 생성된 껍데기 부모 id
CREATE OR REPLACE FUNCTION public.link_orders_into_group(
  p_child_ids   bigint[],
  p_rep_child_id bigint
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_parent_id bigint;
  v_event_id  bigint;
  v_rep       record;
  v_distinct  int;
  v_status    text;
  v_sum_final numeric;
BEGIN
  -- 1) 권한
  IF NOT public.has_permission('edit') THEN
    RAISE EXCEPTION '권한이 없습니다 (edit 필요).' USING ERRCODE = '42501';
  END IF;

  -- 1) 입력: 2건 이상, 대표 포함
  IF p_child_ids IS NULL OR array_length(p_child_ids, 1) IS NULL OR array_length(p_child_ids, 1) < 2 THEN
    RAISE EXCEPTION '연계에는 주문이 2건 이상 필요합니다.';
  END IF;
  IF NOT (p_rep_child_id = ANY (p_child_ids)) THEN
    RAISE EXCEPTION '대표 주문(%)이 연계 대상에 포함되어 있지 않습니다.', p_rep_child_id;
  END IF;

  -- 1) 중복/존재 검증
  SELECT count(*) INTO v_distinct FROM orders WHERE id = ANY (p_child_ids);
  IF v_distinct <> (SELECT count(DISTINCT x) FROM unnest(p_child_ids) x) THEN
    RAISE EXCEPTION '존재하지 않거나 중복된 주문이 포함되어 있습니다.';
  END IF;

  -- 1) 이미 그룹(자식이거나 껍데기)인 주문 거부
  IF EXISTS (
    SELECT 1 FROM orders
    WHERE id = ANY (p_child_ids)
      AND (parent_order_id IS NOT NULL OR is_group_parent = true)
  ) THEN
    RAISE EXCEPTION '이미 다른 합배송에 속했거나 합배송 컨테이너인 주문이 포함되어 있습니다.';
  END IF;

  -- 1) 취소/환불 주문 거부
  IF EXISTS (
    SELECT 1 FROM orders
    WHERE id = ANY (p_child_ids) AND status IN ('cancelled', 'refunded')
  ) THEN
    RAISE EXCEPTION '취소·환불된 주문은 합배송할 수 없습니다.';
  END IF;

  -- 1) 학회(event) 일치 검증
  IF (SELECT count(DISTINCT event_id) FROM orders WHERE id = ANY (p_child_ids)) <> 1 THEN
    RAISE EXCEPTION '서로 다른 학회의 주문은 합배송할 수 없습니다.';
  END IF;

  -- 대표 자식 동결 복사 원본
  SELECT id, customer_name, phone_number, shipping_address, event_id
    INTO v_rep
  FROM orders WHERE id = p_rep_child_id;
  v_event_id := v_rep.event_id;

  -- 2) Case B: 비대표 pending 자식만 배송비 0 + final_payment 차감(paid/completed 불변)
  UPDATE orders
  SET delivery_fee  = 0,
      final_payment = final_payment - delivery_fee
  WHERE id = ANY (p_child_ids)
    AND id <> p_rep_child_id
    AND status = 'pending'
    AND delivery_fee > 0;

  -- 자식 합(조정 후) — 껍데기 표시용 총액
  SELECT coalesce(sum(final_payment), 0) INTO v_sum_final
  FROM orders WHERE id = ANY (p_child_ids);

  -- 종합 상태 파생
  v_status := public._derive_group_status(p_child_ids);

  -- 3) 껍데기 INSERT (order_items 없음, delivery_fee 0)
  INSERT INTO orders (
    customer_name, phone_number, shipping_address, event_id,
    final_payment, delivery_fee, is_group_parent, status, status_history
  ) VALUES (
    v_rep.customer_name, v_rep.phone_number, v_rep.shipping_address, v_event_id,
    v_sum_final, 0, true, v_status,
    jsonb_build_array(jsonb_build_object('status', v_status, 'changed_at', now()))
  )
  RETURNING id INTO v_parent_id;

  -- 4) 자식 연결
  UPDATE orders SET parent_order_id = v_parent_id
  WHERE id = ANY (p_child_ids);

  RETURN v_parent_id;
END;
$$;

-- edit 권한 사용자(로그인)만. anon 불가.
REVOKE ALL ON FUNCTION public.link_orders_into_group(bigint[], bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.link_orders_into_group(bigint[], bigint) TO authenticated;
