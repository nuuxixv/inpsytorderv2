-- 주문 연계(합배송) — 대표 취소 위임 RPC
-- 설계: docs/superpowers/specs/2026-07-07-주문연계-그룹모델-재설계-design.md §4
--
-- 대표 자식 취소 시 즉각 위임. 프론트가 새 대표를 결정(남은 1개면 자동, 2개+면 선택 모달)해
-- 넘겨준다. 옛 대표의 status=cancelled 전환(카드 단말 취소 반영)은 프론트의 별도 status
-- 변경 경로가 담당한다(본 RPC는 배송지 위임 + 배송비 재계산 + 껍데기 갱신만 수행).
--
-- 배송비 재계산(옛 대표 상품 빠진 그룹 정가합 기준):
--   - 정가합 >= 무료임계 → 배송비 0(위임만)
--   - 배송비 발생 → 새 대표에 부과.
--       · 새 대표 pending  → delivery_fee/final_payment에 반영(결제 시 함께)
--       · 새 대표 paid/completed → 금액 자동변경 금지 → needs_onsite_fee=true 반환
--         (프론트가 현장 별도 결제 안내)
--
-- 멱등: CREATE OR REPLACE.
CREATE OR REPLACE FUNCTION public.reassign_group_representative(
  p_group_parent_id  bigint,
  p_old_rep_child_id bigint,
  p_new_rep_child_id bigint
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_parent   boolean;
  v_new_rep     record;
  v_threshold   integer;
  v_ship_cost   integer;
  v_combined    numeric;
  v_fee         integer;
  v_needs_onsite boolean := false;
  v_onsite_amt  integer := 0;
  v_active_ids  bigint[];
  v_status      text;
  v_shell_total numeric;
BEGIN
  IF NOT public.has_permission('edit') THEN
    RAISE EXCEPTION '권한이 없습니다 (edit 필요).' USING ERRCODE = '42501';
  END IF;

  IF p_new_rep_child_id = p_old_rep_child_id THEN
    RAISE EXCEPTION '새 대표는 취소되는 대표와 달라야 합니다.';
  END IF;

  -- 껍데기 확인
  SELECT is_group_parent INTO v_is_parent FROM orders WHERE id = p_group_parent_id;
  IF v_is_parent IS DISTINCT FROM true THEN
    RAISE EXCEPTION '합배송 컨테이너가 아닙니다 (id=%).', p_group_parent_id;
  END IF;

  -- 새 대표: 이 그룹의 활성 자식이어야
  SELECT id, customer_name, phone_number, shipping_address, status, delivery_fee, final_payment
    INTO v_new_rep
  FROM orders
  WHERE id = p_new_rep_child_id
    AND parent_order_id = p_group_parent_id
    AND status NOT IN ('cancelled', 'refunded');
  IF v_new_rep.id IS NULL THEN
    RAISE EXCEPTION '새 대표 후보(%)가 이 합배송의 활성 주문이 아닙니다.', p_new_rep_child_id;
  END IF;

  -- 배송비 설정(site_settings 우선, 없으면 기본값)
  SELECT free_shipping_threshold, shipping_cost INTO v_threshold, v_ship_cost
  FROM site_settings WHERE id = 1;
  v_threshold := coalesce(v_threshold, 30000);
  v_ship_cost := coalesce(v_ship_cost, 3000);

  -- 옛 대표 제외한 활성 자식 정가합
  SELECT coalesce(sum(total_cost), 0) INTO v_combined
  FROM orders
  WHERE parent_order_id = p_group_parent_id
    AND status NOT IN ('cancelled', 'refunded')
    AND id <> p_old_rep_child_id;

  v_fee := CASE WHEN v_combined >= v_threshold THEN 0 ELSE v_ship_cost END;

  -- 배송비 부과
  IF v_fee > 0 THEN
    IF v_new_rep.status = 'pending' THEN
      UPDATE orders
      SET final_payment = final_payment - delivery_fee + v_fee,
          delivery_fee  = v_fee
      WHERE id = p_new_rep_child_id;
    ELSE
      -- paid/completed: 금액 자동변경 금지 → 현장 별도 결제 안내
      v_needs_onsite := true;
      v_onsite_amt   := v_fee;
    END IF;
  ELSE
    -- 무료 전환: 새 대표에 잔여 배송비가 있으면 정리(pending에서만 금액 반영)
    IF v_new_rep.status = 'pending' AND v_new_rep.delivery_fee > 0 THEN
      UPDATE orders
      SET final_payment = final_payment - delivery_fee,
          delivery_fee  = 0
      WHERE id = p_new_rep_child_id;
    END IF;
  END IF;

  -- 껍데기 배송지/이름/연락처를 새 대표로 위임
  UPDATE orders
  SET shipping_address = v_new_rep.shipping_address,
      customer_name    = v_new_rep.customer_name,
      phone_number     = v_new_rep.phone_number
  WHERE id = p_group_parent_id;

  -- 껍데기 종합상태 + 총액 재계산(옛 대표 제외 활성 자식 기준)
  SELECT array_agg(id) INTO v_active_ids
  FROM orders
  WHERE parent_order_id = p_group_parent_id
    AND status NOT IN ('cancelled', 'refunded')
    AND id <> p_old_rep_child_id;

  v_status := public._derive_group_status(coalesce(v_active_ids, ARRAY[]::bigint[]));

  SELECT coalesce(sum(final_payment), 0) INTO v_shell_total
  FROM orders
  WHERE parent_order_id = p_group_parent_id
    AND status NOT IN ('cancelled', 'refunded')
    AND id <> p_old_rep_child_id;

  UPDATE orders
  SET status = v_status, final_payment = v_shell_total
  WHERE id = p_group_parent_id;

  RETURN json_build_object(
    'group_parent_id',  p_group_parent_id,
    'new_rep_child_id', p_new_rep_child_id,
    'delivery_fee',     v_fee,
    'needs_onsite_fee', v_needs_onsite,
    'onsite_fee_amount', v_onsite_amt,
    'shell_total',      v_shell_total,
    'group_status',     v_status
  );
END;
$$;

REVOKE ALL ON FUNCTION public.reassign_group_representative(bigint, bigint, bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reassign_group_representative(bigint, bigint, bigint) TO authenticated;
