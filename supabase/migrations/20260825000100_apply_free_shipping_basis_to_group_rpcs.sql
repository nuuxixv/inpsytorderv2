-- =====================================================================
-- 합배송 RPC 3종에 무료배송 판정 기준(free_shipping_basis) 확장 적용
-- =====================================================================
-- 배경:
--   2026-08-25 site_settings.free_shipping_basis(정가/할인가) 신설로 일반 판정
--   4경로(create-order 서버·CartBottomSheet·NewOrderModal·OrderSections)는 통일됐으나,
--   합배송 도메인의 서버 재판정 3곳은 정가(total_cost 합) 고정으로 남아 있었다:
--     · link_orders_into_group        — 묶음 생성 시 그룹 배송비 산정
--     · reassign_group_representative — 대표 취소 위임 시 잔여 그룹 배송비 재계산
--     · delete_order_group            — 합배송 해제 시 자식별 개별 배송비 원복
--   설정을 '할인가 기준'으로 바꾸면 일반 주문과 합배송이 서로 다른 기준으로 판정돼
--   불일치가 생긴다 → 3곳 모두 설정값을 따르도록 통일한다.
--
-- 판정 규칙 (create-order·constants/shipping.js 와 등가):
--   basis = 'discounted' → 할인가(실결제) 합 기준 / 그 외('list_price'·NULL·컬럼 부재) → 정가 합 기준.
--   합배송 합계 유도 (프론트 combinedOrderTotals 와 등가):
--     정가 합   = Σ total_cost
--     할인가 합 = Σ (final_payment - delivery_fee)
--   final_payment = 할인가 합 + delivery_fee 불변식은 배송비를 조정하는 모든 경로가
--   두 값을 함께 갱신해 유지하므로, 조정 전후 어느 시점에 합산해도 동일하다.
--
-- graceful fallback (create-order 와 동일 패턴):
--   free_shipping_basis 컬럼 미적용 환경에선 컬럼 포함 SELECT 가 통째로 실패해
--   threshold/shipping_cost 까지 잃는다 → undefined_column 예외에서 컬럼 없이 재조회하고
--   basis 는 NULL 로 남겨 정가 폴백을 탄다. 컬럼 마이그레이션(20260825000000)과의
--   적용 순서가 뒤바뀌어도 회귀 0.
--
-- 회귀 0 보장:
--   basis 가 NULL('미설정')이거나 'list_price'면 판정식이 기존과 동일(정가 합 >= 임계치).
--   0원 무료 규칙(create-order 의 basisAmount === 0 → 무료)은 합배송엔 기존에도 없었고
--   이번에도 도입하지 않는다(동작 무변경 우선 — 필요 시 별도 논의).
--
-- append-only 원칙: 기존 마이그레이션 파일은 절대 수정하지 않는다. 최신 정의를 이 신규
--   파일에 CREATE OR REPLACE 로 두어 "최신이 승리"한다. 이 파일은 아래 3개 함수의
--   현재 유효 정의를 덮어쓴다:
--     · link_orders_into_group        ← 20260708000600 정의 복제 후 수정
--     · reassign_group_representative ← 20260708000600 정의 복제 후 수정
--     · delete_order_group            ← 20260708000500 정의 복제 후 수정
--
-- 멱등: CREATE OR REPLACE 뿐. 2회 실행 무에러. RLS/GRANT 기존과 동일 재선언.
--
-- ---------------------------------------------------------------------
-- [적용] Supabase 대시보드 → SQL Editor → (검수·승인 후) 본 파일 전문 1회 실행.
--        권장 순서: 20260825000000(컬럼 추가) 먼저 → 본 파일. (graceful fallback 으로
--        순서가 역전돼도 회귀 0이나, 컬럼 선행을 권장.)
-- ---------------------------------------------------------------------
-- [롤백] 이전 정의로 원복하려면 아래 2개 파일의 전문을 순서대로 재실행:
--        1) supabase/migrations/20260708000500_create_delete_order_group_rpc.sql
--        2) supabase/migrations/20260708000600_fix_group_shipping_fee.sql
-- =====================================================================

-- ── 1) link_orders_into_group 개정 (basis 확장) ─────────────────────────────
--   000600 본문 그대로 + DECLARE 3개 추가(v_basis·v_combined_disc·v_basis_amt) +
--   설정 SELECT 를 graceful basis 조회로 교체 + 그룹 합산에 할인가 합 추가 + 판정식 교체
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
  v_threshold integer;   -- 무료배송 임계
  v_ship_cost integer;   -- 배송비 단가
  v_basis     text;      -- (basis 확장) 판정 기준 설정값
  v_combined  numeric;   -- 그룹 정가합
  v_combined_disc numeric; -- (basis 확장) 그룹 할인가합
  v_basis_amt numeric;   -- (basis 확장) 판정에 쓰는 합계
  v_fee       integer;   -- 그룹 단위 배송비
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

  -- ── 대표 배송비를 "그룹 배송비 1건"으로 재계산 ────────────────────────────
  -- 배송비 설정 (basis 확장: free_shipping_basis 는 신규 컬럼 — 미적용 환경에선 컬럼 포함
  -- SELECT 가 통째로 실패하므로 create-order 와 동일한 graceful fallback: 컬럼 없이
  -- 재조회하고 basis 는 NULL 로 남겨 정가 폴백을 탄다. 회귀 0.)
  BEGIN
    SELECT free_shipping_threshold, shipping_cost, free_shipping_basis
      INTO v_threshold, v_ship_cost, v_basis
    FROM site_settings WHERE id = 1;
  EXCEPTION WHEN undefined_column THEN
    SELECT free_shipping_threshold, shipping_cost INTO v_threshold, v_ship_cost
    FROM site_settings WHERE id = 1;
    v_basis := NULL;
  END;
  v_threshold := coalesce(v_threshold, 30000);
  v_ship_cost := coalesce(v_ship_cost, 3000);

  -- 그룹 정가합·할인가합 (프론트 combinedOrderTotals 와 동일한 유도).
  -- 할인가 합 = Σ(final_payment - delivery_fee). 직전 UPDATE(비대표 pending 배송비 0)가
  -- 두 값을 동액으로 함께 조정하므로 이 차의 합은 조정 전후 동일(불변식) — 미리보기와 등가.
  SELECT coalesce(sum(total_cost), 0),
         coalesce(sum(coalesce(final_payment, 0) - coalesce(delivery_fee, 0)), 0)
    INTO v_combined, v_combined_disc
  FROM orders WHERE id = ANY (p_child_ids);

  -- 판정 기준(설정): 'discounted' → 할인가 합, 그 외(NULL·'list_price') → 정가 합(현행 폴백)
  v_basis_amt := CASE WHEN v_basis = 'discounted' THEN v_combined_disc ELSE v_combined END;
  v_fee := CASE WHEN v_basis_amt >= v_threshold THEN 0 ELSE v_ship_cost END;

  -- 대표 배송비를 그룹 배송비 1건으로 재계산
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

-- ── 2) reassign_group_representative 개정 (basis 확장) ──────────────────────
--   000600 본문 그대로 + DECLARE 3개 추가 + 설정 SELECT graceful 교체 +
--   잔여 그룹 합산에 할인가 합 추가 + 판정식 교체
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
  v_basis       text;      -- (basis 확장) 판정 기준 설정값
  v_combined    numeric;
  v_combined_disc numeric; -- (basis 확장) 잔여 그룹 할인가합
  v_basis_amt   numeric;   -- (basis 확장) 판정에 쓰는 합계
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

  -- 배송비 설정(site_settings 우선, 없으면 기본값 — basis 는 graceful fallback, link 와 동일)
  BEGIN
    SELECT free_shipping_threshold, shipping_cost, free_shipping_basis
      INTO v_threshold, v_ship_cost, v_basis
    FROM site_settings WHERE id = 1;
  EXCEPTION WHEN undefined_column THEN
    SELECT free_shipping_threshold, shipping_cost INTO v_threshold, v_ship_cost
    FROM site_settings WHERE id = 1;
    v_basis := NULL;
  END;
  v_threshold := coalesce(v_threshold, 30000);
  v_ship_cost := coalesce(v_ship_cost, 3000);

  -- 옛 대표 제외한 활성 자식 정가합·할인가합 (프론트 combinedOrderTotals 와 동일한 유도)
  SELECT coalesce(sum(total_cost), 0),
         coalesce(sum(coalesce(final_payment, 0) - coalesce(delivery_fee, 0)), 0)
    INTO v_combined, v_combined_disc
  FROM orders
  WHERE parent_order_id = p_group_parent_id
    AND status NOT IN ('cancelled', 'refunded')
    AND id <> p_old_rep_child_id;

  -- 판정 기준(설정): 'discounted' → 할인가 합, 그 외(NULL·'list_price') → 정가 합(현행 폴백)
  v_basis_amt := CASE WHEN v_basis = 'discounted' THEN v_combined_disc ELSE v_combined END;
  v_fee := CASE WHEN v_basis_amt >= v_threshold THEN 0 ELSE v_ship_cost END;

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

-- ── 3) delete_order_group 개정 (basis 확장) ─────────────────────────────────
--   000500 본문 그대로 + DECLARE 2개 추가 + 설정 SELECT graceful 교체 +
--   자식별 원복 판정을 basis 기준으로 교체 (자식 개별 판정 — create-order 개별 주문 규칙과 정합)
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
  v_basis        text;    -- (basis 확장) 판정 기준 설정값
  v_child_ids    bigint[];
  v_child        record;
  v_basis_amt    numeric; -- (basis 확장) 자식별 판정에 쓰는 금액
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

  -- 배송비 설정(site_settings 우선, 없으면 기본값 — basis 는 graceful fallback, link 와 동일)
  BEGIN
    SELECT free_shipping_threshold, shipping_cost, free_shipping_basis
      INTO v_threshold, v_ship_cost, v_basis
    FROM site_settings WHERE id = 1;
  EXCEPTION WHEN undefined_column THEN
    SELECT free_shipping_threshold, shipping_cost INTO v_threshold, v_ship_cost
    FROM site_settings WHERE id = 1;
    v_basis := NULL;
  END;
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

  -- 1) 자식별 배송비 원복 — 판정 기준(정가/할인가)은 설정(basis) 경유.
  --    자식 개별 할인가 = final_payment - delivery_fee (불변식, create-order 개별 규칙과 정합)
  FOR v_child IN
    SELECT id, status, coalesce(total_cost, 0) AS total_cost,
           coalesce(final_payment, 0) - coalesce(delivery_fee, 0) AS discounted_total,
           delivery_fee
    FROM orders WHERE id = ANY (v_child_ids) ORDER BY id
  LOOP
    v_basis_amt := CASE WHEN v_basis = 'discounted' THEN v_child.discounted_total ELSE v_child.total_cost END;
    v_fee := CASE WHEN v_basis_amt >= v_threshold THEN 0 ELSE v_ship_cost END;

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

-- ─────────────────────────────────────────────────────────────────────────
-- 검증 시나리오 (수동/psql 대조용, threshold=30000, ship=3000 가정)
--
-- [회귀 0] basis NULL 또는 'list_price':
--   v_basis_amt = 정가 합 → 판정식이 000600/000500 정의와 완전 동일. 기존 시나리오
--   (000600 하단 버그1-a/b/c·버그2-a/b, 000500 자식별 원복) 결과 전부 불변.
--
-- [basis-1] link, basis='discounted': pending 2건,
--   각 total_cost 20000·할인 25% → 할인가 15000·delivery_fee 3000(final 18000).
--   정가합 40000(≥30000) / 할인가합 30000(≥30000) → 어느 기준이든 v_fee=0. 동작 동일.
--
-- [basis-2] link, basis='discounted' 판정 분기: pending 2건,
--   각 total_cost 16000·할인가 12500·delivery_fee 3000(final 15500).
--   정가합 32000 ≥ 30000 → 정가 기준이면 무료.
--   할인가합 25000 < 30000 → discounted 기준이면 v_fee=3000 (대표에 부과).
--   프론트 LinkPreviewDialog 미리보기(shippingBasisAmount 경유)와 일치해야 함.
--
-- [basis-3] reassign, basis='discounted': 잔여 자식 할인가합으로 v_fee 재계산.
--   프론트 ShippingPickModal 안내 금액과 일치해야 함.
--
-- [basis-4] delete, basis='discounted': 자식 개별 할인가(final-delivery)로 원복 판정.
--   해제 직후 개별 주문을 create-order 로 새로 만들었을 때와 같은 기준.
--
-- [graceful] free_shipping_basis 컬럼 미적용 DB에서 실행 → undefined_column 폴백으로
--   threshold/ship_cost 정상 조회 + 정가 판정(현행 동작). 에러 0.
-- ─────────────────────────────────────────────────────────────────────────
