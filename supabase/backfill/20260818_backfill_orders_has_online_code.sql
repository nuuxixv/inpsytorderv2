-- ============================================================================
-- [일회성 백필 스크립트 · 선택] 레거시 orders.has_online_code = true 소급 표시
-- ----------------------------------------------------------------------------
--   ※ 선택 사항. create-order 는 신규 주문에 has_online_code 를 채우므로,
--     이 백필은 "과거 주문도 어드민 출고 필터(.eq('has_online_code', true))에
--     걸리게" 하고 싶을 때만 실행. 안 돌려도 감사 쿼리
--     (20260818_audit_online_code_missing_inpsyt_id.sql)로 레거시는 색출 가능.
--   ※ 마이그레이션 아님. 붙여넣기 전용 자체완결. 건우님 승인 후 수동 실행.
--
-- ── 선행 조건 ────────────────────────────────────────────────────────────────
--   1) 20260818010000_DRAFT_add_online_code_columns.sql 적용(has_online_code 존재).
--   2) (권장) products 씨딩 완료 — 그래야 includes_online_code 기준까지 반영됨.
--
-- ── 방침: true 만 소급 표시(멱등) ────────────────────────────────────────────
--   레거시 주문을 false 로 채우지 않는다. false 로 덮으면 "미평가(NULL)"와
--   "확정 미포함(false)"이 섞여 3상태가 붕괴한다. 판정이 명확히 양성인 주문만 true 로.
--   나머지는 NULL 유지("미평가" — 감사 쿼리 영역). has_online_code IS NULL 인 행만 건드림.
--
--   한계: B버킷(상품명에 '온라인' 없고 includes_online_code NULL)인 레거시 주문은
--     여기서도 안 잡힘(데이터로 판별 불가). 해당 SET 을 true 로 확정해야 잡힌다.
-- ============================================================================

-- (사전) 소급 대상 미리보기. 기대: 감사 V-B-1 집계 합과 근사(단, 이미 값 있는 건 제외).
SELECT count(*) AS will_flag_true
FROM public.orders o
WHERE o.has_online_code IS NULL
  AND EXISTS (
    SELECT 1
    FROM public.order_items oi
    LEFT JOIN public.products p ON p.id = oi.product_id
    WHERE oi.order_id = o.id
      AND (p.includes_online_code = true OR oi.product_name ILIKE '%온라인%')
  );

-- (백필) true 만 소급. IS NULL 가드로 멱등 + create-order 가 이미 채운 값 보존.
UPDATE public.orders o
SET has_online_code = true
WHERE o.has_online_code IS NULL
  AND EXISTS (
    SELECT 1
    FROM public.order_items oi
    LEFT JOIN public.products p ON p.id = oi.product_id
    WHERE oi.order_id = o.id
      AND (p.includes_online_code = true OR oi.product_name ILIKE '%온라인%')
  );

-- (사후검증) has_online_code 분포.
SELECT
  count(*) FILTER (WHERE has_online_code IS TRUE)  AS is_true,
  count(*) FILTER (WHERE has_online_code IS FALSE) AS is_false,
  count(*) FILTER (WHERE has_online_code IS NULL)  AS is_null,
  count(*)                                         AS total
FROM public.orders;

-- ============================================================================
-- [롤백] 소급분만 되돌리려면(신규 create-order 값과 구분이 안 되니 주의):
--   UPDATE public.orders SET has_online_code = NULL WHERE has_online_code IS TRUE;
--   ⚠ create-order 가 채운 true 도 함께 지워짐. 통상 롤백 불필요.
-- ============================================================================
