-- 주문 연계(합배송) — 대표(rep) 자식 식별자 명시 노출 (갭 1)
-- 설계: docs/superpowers/specs/2026-07-07-주문연계-그룹모델-재설계-design.md §4, §5.1~5.3
--
-- 배경: 껍데기(is_group_parent) row 에 "어느 자식이 대표(배송지·배송비 담당)인지"를
--   가리키는 명시 컬럼이 없어 프론트가 배송지/이름/연락처 동결복사값을 자식들과 대조해
--   추정(inferRepChild)하고 있었다. 이 추정은 동명이인·동일주소·위임 후에 취약하다.
--   → 껍데기에 representative_child_id 를 명시 저장하고, 관련 RPC 3종이 이를
--     쓰기/위임/노출하도록 개정한다. (프론트는 inferRepChild 제거 가능)
--
-- 이 파일은 아래 3개 기존 마이그레이션의 함수 본문을 CREATE OR REPLACE 로 "덮어쓴다".
-- (append-only 원칙: 기존 파일은 수정하지 않고 최신 정의를 신규 파일에 둔다. 최신이 승리)
--   · 20260708000100_create_link_orders_into_group_rpc.sql       → link_orders_into_group
--   · 20260708000200_create_reassign_group_representative_rpc.sql → reassign_group_representative
--   · 20260708000300_rewrite_get_order_by_token_group.sql        → get_order_by_token
--
-- 멱등: ADD COLUMN IF NOT EXISTS / DO 블록 FK 가드 / CREATE OR REPLACE. 2회 실행 무에러.

-- ── 1) 껍데기 → 대표 자식 참조 컬럼 (nullable, 비그룹 주문은 NULL) ──────────
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS representative_child_id bigint;

-- 1-b) FK 멱등 추가 — 컬럼 이름 기준으로 이미 FK 가 있으면 스킵.
--      대표 자식은 소프트 취소(status)만 되고 하드 삭제되지 않으므로 ON DELETE 는 두지 않는다
--      (delete_order_group 은 자식 parent_order_id 를 먼저 NULL 로 풀고 껍데기를 삭제하므로
--       이 FK 와 충돌하지 않는다).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_attribute a
      ON a.attrelid = c.conrelid AND a.attnum = ANY (c.conkey)
    WHERE c.conrelid = 'public.orders'::regclass
      AND c.contype = 'f'
      AND a.attname = 'representative_child_id'
  ) THEN
    ALTER TABLE public.orders
      ADD CONSTRAINT orders_representative_child_id_fkey
      FOREIGN KEY (representative_child_id) REFERENCES public.orders(id);
  END IF;
END $$;

-- ── 2) link_orders_into_group 개정 — 껍데기 INSERT 시 representative_child_id 저장 ──
--   (20260708000100 본문과 동일 + representative_child_id 컬럼/값만 추가)
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

-- ── 3) reassign_group_representative 개정 — 위임 시 representative_child_id 갱신 ──
--   (20260708000200 본문과 동일 + 껍데기 UPDATE 에 representative_child_id 추가)
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

-- ── 4) get_order_by_token 개정 — 그룹 반환에 representative_child_id 포함 ──────
--   (20260708000300 본문과 동일 + 루트 select 에 r.representative_child_id 1줄 추가)
CREATE OR REPLACE FUNCTION public.get_order_by_token(p_token uuid)
RETURNS json
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  WITH tokenized AS (
    SELECT
      CASE
        WHEN o.is_group_parent            THEN o.id
        WHEN o.parent_order_id IS NOT NULL THEN o.parent_order_id
        ELSE o.id
      END AS root_id
    FROM orders o
    WHERE o.access_token = p_token
  )
  SELECT row_to_json(result)
  FROM (
    SELECT
      r.id, r.customer_name, r.phone_number, r.shipping_address,
      r.final_payment, r.delivery_fee, r.status, r.created_at,
      r.customer_request, r.is_on_site_sale, r.status_history,
      r.parent_order_id, r.is_group_parent, r.representative_child_id,
      (
        SELECT json_build_object(
          'id', e.id, 'name', e.name, 'discount_rate', e.discount_rate,
          'tags', e.tags, 'start_date', e.start_date, 'end_date', e.end_date,
          'estimated_delivery_date', e.estimated_delivery_date, 'venue', e.venue
        )
        FROM events e
        WHERE e.id = r.event_id
      ) AS events,
      (
        SELECT json_agg(
          json_build_object(
            'quantity', oi.quantity,
            'price_at_purchase', oi.price_at_purchase,
            'products', (SELECT row_to_json(p) FROM products p WHERE p.id = oi.product_id)
          )
        )
        FROM order_items oi
        WHERE oi.order_id = r.id
      ) AS order_items,
      (
        SELECT json_agg(
          json_build_object(
            'id', c.id,
            'customer_name', c.customer_name,
            'phone_number', c.phone_number,
            'final_payment', c.final_payment,
            'delivery_fee', c.delivery_fee,
            'status', c.status,
            'order_items', (
              SELECT json_agg(json_build_object(
                'quantity', ci.quantity,
                'price_at_purchase', ci.price_at_purchase,
                'products', (SELECT row_to_json(cp) FROM products cp WHERE cp.id = ci.product_id)
              ))
              FROM order_items ci WHERE ci.order_id = c.id
            )
          )
          ORDER BY c.id
        )
        FROM orders c WHERE c.parent_order_id = r.id
      ) AS child_orders
    FROM orders r
    JOIN tokenized t ON t.root_id = r.id
  ) result;
$$;

GRANT EXECUTE ON FUNCTION public.get_order_by_token(uuid) TO anon, authenticated;
