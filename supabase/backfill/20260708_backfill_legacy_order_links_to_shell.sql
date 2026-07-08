-- ============================================================================
-- [일회성 백필 스크립트] 구 모델(부모=실주문) 주문연계 → 껍데기 부모 모델 변환
-- ----------------------------------------------------------------------------
--   ※ 이 파일은 마이그레이션이 아니다. supabase/migrations/ 에 두지 말 것
--     (순번 오염 방지). 정식 SQL 6개 적용 완료 후 딱 한 번 수동 실행하는 스크립트.
--
--   설계: docs/superpowers/specs/2026-07-07-주문연계-그룹모델-재설계-design.md §1
--   대상 규모: 프로덕션 구 연계 1건 확인(parent_order_id IS NOT NULL = 1).
--             단, 스크립트는 N건 범용으로 동작한다.
--
-- ── 구 모델 → 새 모델 변환 개요 ─────────────────────────────────────────────
--   구 모델: 먼저 만든 실주문 P 가 부모(상품·금액 보유 + 부모 역할 겸함),
--            자식 C 가 parent_order_id = P.id. 배송비는 P 가 담당(자식은 0).
--   새 모델: 돈·상품 없는 껍데기 부모 G(is_group_parent=true) 가 컨테이너.
--            P·C 모두 G 의 자식(대칭). G 는 대표 자식 배송지 동결복사 +
--            representative_child_id + final_payment(자식합) 보유.
--
--   변환: 구 부모 P 는 배송지·배송비 담당이었으므로 새 구조에서 "대표 자식"이 된다.
--        → 껍데기 G 생성(rep=P) → 기존 자식들 + P 자신을 모두 G 의 자식으로 재연결.
--        → P 의 상품·금액·배송비는 그대로 둔다(대표라 배송비 유지).
--
-- ── 멱등(재실행 안전) ────────────────────────────────────────────────────────
--   대상 선정: "is_group_parent=false 이면서, 자신을 parent_order_id 로 가리키는
--             자식이 존재하는" 실주문 P 만 처리.
--   1회 실행 후 P.parent_order_id 는 G.id 로 채워지고, P 를 가리키던 자식들은
--   모두 G 를 가리키게 되어 "P 를 가리키는 자식"이 0이 된다 → 재실행 시 재선정 안 됨.
--   껍데기 G 는 is_group_parent=true 라 애초에 대상에서 제외.  ∴ 여러 번 돌려도 안전.
--
-- ── 실행 순서(엄수) ──────────────────────────────────────────────────────────
--   1) 정식 마이그레이션 6개 적용:
--        20260708000000 / 000100 / 000200 / 000300 / 000400 / 000500
--   2) [STEP 0] 대상 재확인 SELECT (아래) — 예상 건수·금액 눈으로 확인
--   3) [STEP 1] 백필 트랜잭션 실행
--   4) [STEP 2] 검증 쿼리 3종 — 모두 기대값(0건/0 diff) 확인
--   5) (검증 통과 후에야) 프론트엔드 배포
--
--   실행 환경: Supabase 대시보드 SQL Editor(role=postgres, 함수 owner).
--   _derive_group_status 는 REVOKE ALL FROM PUBLIC 이지만 owner(postgres)는 호출 가능.
--   ※ 만약 권한 오류가 나면 SQL Editor 가 postgres 로 도는지 확인할 것.
--
--   ※ 붙여넣기 전용 자체완결 스크립트다. "앞 메시지 참조" 없이 이 파일만으로 완결.
-- ============================================================================


-- ============================================================================
-- [STEP 0] 대상 재확인 (읽기 전용 — 실행 전 반드시 눈으로 확인)
--   구 부모 P 목록 + 자식수 + 예상 껍데기 총액(P.final_payment + 자식 final_payment 합)
--   기대: 프로덕션 현재 1행(P 1개). expected_shell_total 이 실제와 맞는지 확인.
-- ============================================================================
SELECT
  p.id                                              AS old_parent_id,
  p.customer_name,
  p.phone_number,
  p.event_id,
  p.status                                          AS parent_status,
  p.final_payment                                   AS parent_final,
  p.delivery_fee                                    AS parent_delivery_fee,
  count(c.id)                                       AS child_count,
  p.final_payment + coalesce(sum(c.final_payment), 0) AS expected_shell_total
FROM orders p
JOIN orders c ON c.parent_order_id = p.id
WHERE p.is_group_parent = false
GROUP BY p.id, p.customer_name, p.phone_number, p.event_id,
         p.status, p.final_payment, p.delivery_fee
ORDER BY p.id;


-- ============================================================================
-- [STEP 1] 백필 실행 (트랜잭션)
--   문제가 보이면 COMMIT 전에 ROLLBACK. 정상이면 COMMIT.
--   (Supabase SQL Editor 는 실행 단위 자동 커밋일 수 있으니, 불안하면
--    BEGIN 만 먼저 실행 → DO 실행 → STEP 2 검증 → 이상 없으면 COMMIT,
--    이상 있으면 ROLLBACK 순으로 수동 진행할 것)
-- ============================================================================
BEGIN;

DO $$
DECLARE
  v_p         record;
  v_child_ids bigint[];
  v_all_ids   bigint[];   -- 기존 자식 + P 자신
  v_status    text;
  v_sum       numeric;
  v_shell_id  bigint;
  v_count     int := 0;
BEGIN
  FOR v_p IN
    SELECT o.id, o.customer_name, o.phone_number, o.shipping_address,
           o.event_id, o.created_at
    FROM orders o
    WHERE o.is_group_parent = false          -- P 자신은 실주문(껍데기 아님)
      AND EXISTS (                            -- P 를 부모로 가리키는 자식이 있음(구 모델)
        SELECT 1 FROM orders c WHERE c.parent_order_id = o.id
      )
    ORDER BY o.id
  LOOP
    -- 이 구 부모의 기존 자식 id 수집(재연결 전에 확보)
    SELECT array_agg(c.id) INTO v_child_ids
    FROM orders c WHERE c.parent_order_id = v_p.id;

    -- 껍데기에 묶일 전체 자식 = 기존 자식 + 구 부모 P 자신
    v_all_ids := v_child_ids || v_p.id;

    -- 종합 상태 파생(취소/환불 제외 활성 자식 기준 — link RPC 와 동일 헬퍼)
    v_status := public._derive_group_status(v_all_ids);

    -- 표시용 총액 = 전체 자식(P 포함) final_payment 합
    SELECT coalesce(sum(final_payment), 0) INTO v_sum
    FROM orders WHERE id = ANY (v_all_ids);

    -- 1) 껍데기 G INSERT
    --    - is_group_parent=true, order_items 없음, delivery_fee=0
    --    - 배송지/이름/연락처 = 구 부모 P 동결복사(P 가 배송 담당이었음)
    --    - representative_child_id = P.id (P 가 대표)
    --    - final_payment = 자식합, created_at = P.created_at
    --    - access_token 은 컬럼 DEFAULT gen_random_uuid() 로 신규 생성
    INSERT INTO orders (
      customer_name, phone_number, shipping_address, event_id,
      final_payment, delivery_fee, is_group_parent, representative_child_id,
      status, status_history, created_at
    ) VALUES (
      v_p.customer_name, v_p.phone_number, v_p.shipping_address, v_p.event_id,
      v_sum, 0, true, v_p.id,
      v_status,
      jsonb_build_array(jsonb_build_object('status', v_status, 'changed_at', v_p.created_at)),
      v_p.created_at
    )
    RETURNING id INTO v_shell_id;

    -- 2) 기존 자식들 → G 로 재연결
    UPDATE orders SET parent_order_id = v_shell_id WHERE id = ANY (v_child_ids);

    -- 3) 구 부모 P 자신도 G 의 자식으로(상품·금액·배송비 불변)
    UPDATE orders SET parent_order_id = v_shell_id WHERE id = v_p.id;

    v_count := v_count + 1;
    RAISE NOTICE '구 부모 % → 껍데기 % 생성 (기존 자식 %건 + P 포함 총 %건, 총액 %, 상태 %)',
      v_p.id, v_shell_id,
      array_length(v_child_ids, 1), array_length(v_all_ids, 1), v_sum, v_status;
  END LOOP;

  RAISE NOTICE '백필 완료: 껍데기 %개 생성.', v_count;
END $$;

-- 검증(STEP 2) 통과를 확인한 뒤에만 COMMIT. 이상 있으면 ROLLBACK.
COMMIT;


-- ============================================================================
-- [STEP 2] 검증 쿼리 (백필 후 — 모두 기대값이어야 함)
-- ============================================================================

-- 2-1) 구 모델 잔존 여부: parent_order_id 가 "실주문(비껍데기)"을 가리키는 자식이 없어야.
--      기대: 0
SELECT count(*) AS dangling_old_links
FROM orders c
JOIN orders p ON p.id = c.parent_order_id
WHERE p.is_group_parent = false;

-- 2-2) 껍데기 총액 정합: 껍데기 final_payment == 자식 final_payment 합.
--      기대: 0행 (불일치 껍데기가 있으면 그 행이 뜬다)
SELECT
  g.id                                    AS shell_id,
  g.final_payment                         AS shell_total,
  coalesce(sum(c.final_payment), 0)       AS children_sum,
  g.final_payment - coalesce(sum(c.final_payment), 0) AS diff
FROM orders g
LEFT JOIN orders c ON c.parent_order_id = g.id
WHERE g.is_group_parent = true
GROUP BY g.id, g.final_payment
HAVING g.final_payment <> coalesce(sum(c.final_payment), 0);

-- 2-3) 대표 자식 정합: representative_child_id 가 실제 이 껍데기의 자식(=옛 P)이어야.
--      기대: 0행
SELECT
  g.id                       AS shell_id,
  g.representative_child_id,
  r.parent_order_id          AS rep_points_to
FROM orders g
LEFT JOIN orders r ON r.id = g.representative_child_id
WHERE g.is_group_parent = true
  AND (r.id IS NULL OR r.parent_order_id IS DISTINCT FROM g.id);

-- 2-4) (참고) 생성된 껍데기 + 자식 트리 한눈에 보기
SELECT
  g.id AS shell_id, g.customer_name AS shell_name, g.status AS shell_status,
  g.final_payment AS shell_total, g.representative_child_id AS rep_child,
  c.id AS child_id, c.status AS child_status,
  c.final_payment AS child_final, c.delivery_fee AS child_delivery,
  (c.id = g.representative_child_id) AS is_rep
FROM orders g
JOIN orders c ON c.parent_order_id = g.id
WHERE g.is_group_parent = true
ORDER BY g.id, c.id;


-- ============================================================================
-- [ROLLBACK] 되돌리기
-- ----------------------------------------------------------------------------
--   (A) 1순위 — COMMIT 전이라면 그냥 `ROLLBACK;` (STEP 1 을 BEGIN 만 열고
--       수동 진행한 경우). 가장 안전.
--
--   (B) 2순위 — 이미 COMMIT 했고, "아직 프론트 배포/실 연계 생성 전"이라면
--       (이 시점의 모든 is_group_parent 껍데기는 전부 백필 산물이므로) 아래로 원복:
--
--       BEGIN;
--         -- 옛 P 이외 자식들을 옛 부모(P=representative_child_id)로 되돌림(구 모델 복원)
--         UPDATE orders c
--         SET parent_order_id = g.representative_child_id
--         FROM orders g
--         WHERE g.is_group_parent = true
--           AND c.parent_order_id = g.id
--           AND c.id <> g.representative_child_id;
--         -- 옛 P 는 독립 최상위로 복원
--         UPDATE orders p
--         SET parent_order_id = NULL
--         FROM orders g
--         WHERE g.is_group_parent = true
--           AND p.id = g.representative_child_id;
--         -- 껍데기 삭제(자식 FK 는 위에서 모두 풀림)
--         DELETE FROM orders g WHERE g.is_group_parent = true;
--       COMMIT;
--
--       ⚠ (B)는 link_orders_into_group 로 만든 "진짜" 새 연계가 하나라도 생긴 뒤에는
--         금지(그 그룹까지 해체해버림). 반드시 프론트 배포 이전에만 사용.
-- ============================================================================
