-- 주문 연계(합배송) — 그룹 배송비 버그 hotfix 2건
-- 설계: docs/superpowers/specs/2026-07-07-주문연계-그룹모델-재설계-design.md §4, §8
--
-- append-only 원칙: 기존 마이그레이션 파일은 절대 수정하지 않는다. 최신 정의를 이 신규
--   파일에 CREATE OR REPLACE 로 두어 "최신이 승리"한다. 이 파일은 아래 2개 함수의
--   20260708000400 정의(= 현재 유효 정의, representative_child_id 로직 포함)를 덮어쓴다.
--   · link_orders_into_group        ← 20260708000400 line 45-147 를 복제 후 수정
--   · reassign_group_representative  ← 20260708000400 line 151-276 을 복제 후 수정
--   (get_order_by_token 은 변경 없음 → 여기서 재정의하지 않음. 000400 최신 유지)
--
-- ── 버그1 (link_orders_into_group) ─────────────────────────────────────────
--   증상: 합배송으로 묶어도 "대표" 주문의 배송비가 면제/재계산되지 않았다.
--     기존 로직은 비대표 pending 자식의 배송비만 0으로 만들고, 대표의 배송비는
--     그대로 남겨 그룹에 배송비가 (대표분) 이중/과다로 남았다.
--   수정: 그룹 정가합(전체 자식 total_cost 합, 프론트 combinedListPrice 와 동일)으로
--     그룹 단위 배송비 v_fee 를 1건만 산정해 "대표"에 부과/면제한다.
--     - 대표 pending → 대표 delivery_fee 를 v_fee 로 재계산(차액을 final_payment 반영)
--     - 대표 paid/completed + 배송비 발생(Case B) → 금액 불변 원칙상 조정 불가 →
--       방어적 예외(프론트 blockedByCaseB 가 선차단하는 케이스)
--     - 대표 paid/completed + 무료(v_fee=0) → 금액 불변, 기존 배송비 유지
--     이 재계산은 v_sum_final(껍데기 표시 총액) 계산보다 앞서 수행해 대표 조정분이
--     껍데기 총액에 반영되게 한다.
--
-- ── 버그2 (reassign_group_representative) ───────────────────────────────────
--   증상: 대표 취소로 새 대표가 paid/completed 인 경우, 그 자식이 이미 낸 배송비를
--     무시하고 v_fee 전액을 현장 별도결제로 안내해 이중청구가 발생했다.
--   수정: delete_order_group(20260708000500 line 88) 과 동일한 "차액" 방식으로 교체.
--     이미 낸 배송비(v_new_rep.delivery_fee)를 공제하고 부족분만 현장 안내한다.
--
-- 멱등: CREATE OR REPLACE 뿐. 2회 실행 무에러.

-- ── 1) link_orders_into_group 개정 (버그1 수정) ─────────────────────────────
--   000400 본문 그대로 + DECLARE 4개 추가 + v_rep 에 status 추가 +
--   비대표 pending 0처리 UPDATE 직후 "대표 배송비 그룹단위 재계산" 블록 삽입
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
  v_threshold integer;   -- (버그1) 무료배송 임계
  v_ship_cost integer;   -- (버그1) 배송비 단가
  v_combined  numeric;   -- (버그1) 그룹 정가합
  v_fee       integer;   -- (버그1) 그룹 단위 배송비
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

  -- 대표 자식 동결 복사 원본 (버그1: status 추가 조회)
  SELECT id, customer_name, phone_number, shipping_address, event_id, status
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

  -- ── (버그1 수정) 대표 배송비를 "그룹 배송비 1건"으로 재계산 ────────────────
  -- 배송비 설정
  SELECT free_shipping_threshold, shipping_cost INTO v_threshold, v_ship_cost
  FROM site_settings WHERE id = 1;
  v_threshold := coalesce(v_threshold, 30000);
  v_ship_cost := coalesce(v_ship_cost, 3000);

  -- 그룹 정가합(프론트 combinedListPrice 와 동일: 전체 자식 total_cost 합)
  SELECT coalesce(sum(total_cost), 0) INTO v_combined
  FROM orders WHERE id = ANY (p_child_ids);
  v_fee := CASE WHEN v_combined >= v_threshold THEN 0 ELSE v_ship_cost END;

  -- 대표 배송비를 그룹 배송비 1건으로 재계산 (버그1 수정)
  IF v_rep.status = 'pending' THEN
    UPDATE orders
    SET final_payment = final_payment - delivery_fee + v_fee,
        delivery_fee  = v_fee
    WHERE id = p_rep_child_id;
  ELSIF v_fee > 0 THEN
    -- 결제완료 대표 + 배송비 발생(Case B): 금액 불변 원칙상 조정 불가.
    -- 프론트(blockedByCaseB)가 차단하는 케이스 → 방어적 거부.
    RAISE EXCEPTION '결제완료 주문은 묶음 배송지로 지정할 수 없습니다(배송비 조정 불가). 결제대기 주문을 배송지로 선택하세요.';
  END IF;
  -- (결제완료 대표 + 무료(v_fee=0): 금액 불변, 기존 배송비 유지)

  -- 자식 합(조정 후) — 껍데기 표시용 총액 (대표 재계산분 반영 후)
  SELECT coalesce(sum(final_payment), 0) INTO v_sum_final
  FROM orders WHERE id = ANY (p_child_ids);

  -- 종합 상태 파생
  v_status := public._derive_group_status(p_child_ids);

  -- 3) 껍데기 INSERT (order_items 없음, delivery_fee 0, 대표 자식 명시)
  INSERT INTO orders (
    customer_name, phone_number, shipping_address, event_id,
    final_payment, delivery_fee, is_group_parent, representative_child_id,
    status, status_history
  ) VALUES (
    v_rep.customer_name, v_rep.phone_number, v_rep.shipping_address, v_event_id,
    v_sum_final, 0, true, v_rep.id,
    v_status,
    jsonb_build_array(jsonb_build_object('status', v_status, 'changed_at', now()))
  )
  RETURNING id INTO v_parent_id;

  -- 4) 자식 연결
  UPDATE orders SET parent_order_id = v_parent_id
  WHERE id = ANY (p_child_ids);

  RETURN v_parent_id;
END;
$$;

REVOKE ALL ON FUNCTION public.link_orders_into_group(bigint[], bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.link_orders_into_group(bigint[], bigint) TO authenticated;

-- ── 2) reassign_group_representative 개정 (버그2 수정) ──────────────────────
--   000400 본문 그대로 + paid/completed 분기(000400 line 221-224)를 "차액" 방식으로 교체.
--   v_new_rep 는 이미 delivery_fee 를 SELECT 하므로 추가 조회 불필요.
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
      -- paid/completed: 이미 낸 배송비를 공제하고 부족분만 현장 별도결제 안내
      -- (delete_order_group 과 동일한 차액 방식 — 이중청구 방지)
      v_onsite_amt   := greatest(0, v_fee - coalesce(v_new_rep.delivery_fee, 0));
      v_needs_onsite := v_onsite_amt > 0;
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

  -- 껍데기 배송지/이름/연락처 + 대표 식별자를 새 대표로 위임
  UPDATE orders
  SET shipping_address        = v_new_rep.shipping_address,
      customer_name           = v_new_rep.customer_name,
      phone_number            = v_new_rep.phone_number,
      representative_child_id = p_new_rep_child_id
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

-- ─────────────────────────────────────────────────────────────────────────
-- 검증 시나리오 (수동/psql 대조용, site_settings: threshold=30000, ship=3000 가정)
--
-- [버그1-a] 무료전환: pending 2건, 각 total_cost 20000·delivery_fee 3000
--   (final_payment 각 23000). combinedListPrice = 40000 >= 30000 → v_fee=0.
--   link 후:
--     · 비대표 자식: delivery_fee 0, final 20000 (기존 로직)
--     · 대표 자식:   delivery_fee 0, final 20000 (23000 - 3000)  ← 버그1 수정 효과
--     · 그룹 실배송비 합 = 0
--
-- [버그1-b] Case B(배송비 존치): pending 2건, 각 total_cost 10000·delivery_fee 3000.
--   combinedListPrice = 20000 < 30000 → v_fee=3000.
--   link 후:
--     · 비대표 자식: delivery_fee 0 (기존 로직)
--     · 대표 자식:   delivery_fee 3000 유지 (final 13000 - 3000 + 3000 = 13000)
--     · 그룹 배송비 = 대표 1건분(3000)만 부과
--
-- [버그1-c] 방어: 대표 paid + Case B(v_fee=3000)
--   → RAISE EXCEPTION '결제완료 주문은 묶음 배송지로 지정할 수 없습니다...'
--   (프론트 blockedByCaseB 선차단, 백엔드 2차 방어)
--
-- [버그2-a] 이중청구 방지: 새 대표 paid + delivery_fee 3000, 재계산 v_fee=3000
--   → onsite_amt = max(0, 3000 - 3000) = 0, needs_onsite_fee = false
--   (이전 정의는 v_fee 전액 3000 을 현장청구 → 이미 낸 3000 과 이중청구)
--
-- [버그2-b] 부족분만 청구: 새 대표 paid + delivery_fee 0, 재계산 v_fee=3000
--   → onsite_amt = max(0, 3000 - 0) = 3000, needs_onsite_fee = true
-- ─────────────────────────────────────────────────────────────────────────
