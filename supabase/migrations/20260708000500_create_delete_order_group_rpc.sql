-- 주문 연계(합배송) — 잘못 연계한 그룹 취소(교정) RPC (갭 2)
-- 설계: docs/superpowers/specs/2026-07-07-주문연계-그룹모델-재설계-design.md §3, §8
--
-- 원칙: "연계 해제"는 정책상 미지원(§3). 단, **마스터가 실수로 잘못 묶은 그룹을 취소**하는
--   예외 교정 경로만 허용한다. 그래서 edit 이 아니라 has_permission('master') 게이트.
--
-- 동작(단일 트랜잭션):
--   1) 각 자식의 배송비를 "자기 정가(total_cost) 기준"으로 독립 재계산
--      - total_cost >= 무료임계 → 배송비 0
--      - 미달                  → 배송비 부과(shipping_cost)
--      · pending 자식        → delivery_fee/final_payment 자동 반영
--      · paid/completed 자식 → 금액 불변(카드 특성상 사후 차감 불가).
--        재계산 배송비가 현재 배송비보다 크면 그 차액을 현장 별도결제로 안내
--        → needs_onsite_fee=true + total_onsite_fee_amount 누적
--   2) 자식 parent_order_id = NULL 로 독립 복원
--   3) 껍데기 row DELETE
-- 반환(json): { group_parent_id, restored_children[], needs_onsite_fee, total_onsite_fee_amount }
--
-- 결제완료 자식 금액 자동 변경 금지(대표취소 위임과 동일 원칙, §4·§8).
-- 멱등: CREATE OR REPLACE.
CREATE OR REPLACE FUNCTION public.delete_order_group(p_group_parent_id bigint)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_parent    boolean;
  v_threshold    integer;
  v_ship_cost    integer;
  v_child_ids    bigint[];
  v_child        record;
  v_fee          integer;
  v_onsite       integer;
  v_needs_onsite boolean := false;
  v_total_onsite integer := 0;
  v_children     json;
BEGIN
  -- 마스터 전용(삭제/원복 교정 경로) — edit 아님.
  IF NOT public.has_permission('master') THEN
    RAISE EXCEPTION '권한이 없습니다 (master 필요).' USING ERRCODE = '42501';
  END IF;

  -- 껍데기 확인
  SELECT is_group_parent INTO v_is_parent FROM orders WHERE id = p_group_parent_id;
  IF v_is_parent IS DISTINCT FROM true THEN
    RAISE EXCEPTION '합배송 컨테이너가 아닙니다 (id=%).', p_group_parent_id;
  END IF;

  -- 배송비 설정(site_settings 우선, 없으면 기본값 — reassign 과 동일)
  SELECT free_shipping_threshold, shipping_cost INTO v_threshold, v_ship_cost
  FROM site_settings WHERE id = 1;
  v_threshold := coalesce(v_threshold, 30000);
  v_ship_cost := coalesce(v_ship_cost, 3000);

  -- 자식 id 수집(parent 해제 전에 확보)
  SELECT array_agg(id) INTO v_child_ids
  FROM orders WHERE parent_order_id = p_group_parent_id;

  IF v_child_ids IS NULL THEN
    -- 자식 없는 비정상 껍데기 → 그대로 삭제
    DELETE FROM orders WHERE id = p_group_parent_id;
    RETURN json_build_object(
      'group_parent_id',         p_group_parent_id,
      'restored_children',       '[]'::json,
      'needs_onsite_fee',        false,
      'total_onsite_fee_amount', 0
    );
  END IF;

  -- 1) 자식별 배송비 원복
  FOR v_child IN
    SELECT id, status, coalesce(total_cost, 0) AS total_cost, delivery_fee
    FROM orders WHERE id = ANY (v_child_ids) ORDER BY id
  LOOP
    v_fee := CASE WHEN v_child.total_cost >= v_threshold THEN 0 ELSE v_ship_cost END;

    IF v_child.status = 'pending' THEN
      -- pending: 금액 자동 반영(현재 배송비와 다를 때만)
      IF v_child.delivery_fee IS DISTINCT FROM v_fee THEN
        UPDATE orders
        SET final_payment = final_payment - delivery_fee + v_fee,
            delivery_fee  = v_fee
        WHERE id = v_child.id;
      END IF;
    ELSE
      -- paid/completed 등: 금액 불변. 부족분(재계산 - 현재)만 현장 별도결제 안내.
      v_onsite := v_fee - coalesce(v_child.delivery_fee, 0);
      IF v_onsite > 0 THEN
        v_needs_onsite := true;
        v_total_onsite := v_total_onsite + v_onsite;
      END IF;
    END IF;
  END LOOP;

  -- 2) 독립 복원
  UPDATE orders SET parent_order_id = NULL WHERE id = ANY (v_child_ids);

  -- 원복된 자식 목록 스냅샷(복원·정산 후 최신값)
  SELECT json_agg(
    json_build_object(
      'id',            c.id,
      'customer_name', c.customer_name,
      'phone_number',  c.phone_number,
      'status',        c.status,
      'delivery_fee',  c.delivery_fee,
      'final_payment', c.final_payment
    ) ORDER BY c.id
  )
  INTO v_children
  FROM orders c WHERE c.id = ANY (v_child_ids);

  -- 3) 껍데기 삭제(자식 FK 는 위에서 NULL 로 풀렸으므로 안전)
  DELETE FROM orders WHERE id = p_group_parent_id;

  RETURN json_build_object(
    'group_parent_id',         p_group_parent_id,
    'restored_children',       coalesce(v_children, '[]'::json),
    'needs_onsite_fee',        v_needs_onsite,
    'total_onsite_fee_amount', v_total_onsite
  );
END;
$$;

-- master 만 실행(내부 게이트로 재차 방어). anon/일반 authenticated 로그인은 게이트에서 차단.
REVOKE ALL ON FUNCTION public.delete_order_group(bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_order_group(bigint) TO authenticated;
