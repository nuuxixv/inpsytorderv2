-- 합배송 고객 주문서 노출 최소화 — get_order_by_token 응답 단계 개인정보 차단 (보안)
-- 설계: docs/superpowers/specs/2026-07-09-합배송-고객주문서-노출최소화-design.md §2, §3.1
--
-- 배경(왜 바꾸나):
--   기존 get_order_by_token(최신 유효 정의 = 20260708000400 line 280-349)은 토큰이
--   그룹 자식/껍데기일 때 root(껍데기)로 정규화한 뒤 child_orders[] 배열에 참여자 전원의
--   customer_name·phone_number·final_payment·order_items 를 담아 반환했다.
--   → 어떤 참여자든 자기 토큰으로 다른 참여자의 이름·연락처·금액·상품을 모두 볼 수 있었다.
--   프론트에서 숨겨도 네트워크 응답에 PII 가 남으므로 실질 노출이다.
--   본 마이그레이션은 "응답 자체"에서 형제 상세를 제거한다:
--     · 어떤 토큰으로도 "표시 대상 order 1건"의 본인 정보만 반환
--     · 합배송이면 대표자 "이름(representative_name)"만 파생 노출(대표 연락처·주소는 미반환)
--     · child_orders / parent_order_id / is_group_parent / representative_child_id 는 반환 금지
--
-- append-only 원칙: 기존 마이그레이션 파일은 절대 수정하지 않는다. 최신 정의를 이 신규 파일에
--   CREATE OR REPLACE 로 둔다(최신이 승리). 이 파일이 20260708000400 의 get_order_by_token
--   본문을 덮어쓴다(000300→000400 순으로 개정돼 왔고, 000600 은 이 함수를 재정의하지 않으므로
--   000400 이 직전 최신이었다).
--
-- 멱등: CREATE OR REPLACE FUNCTION + GRANT 만 수행. 스키마 변경 없음. 2회 실행 무에러.
--
-- 함수 속성 유지: LANGUAGE sql, SECURITY DEFINER, STABLE, SET search_path = public,
--                 GRANT EXECUTE TO anon, authenticated.


-- ─────────────────────────────────────────────────────────────────────────────
-- ▣ 적용 가이드 (자체 완결 — 이 블록만 보고 적용 가능)
-- ─────────────────────────────────────────────────────────────────────────────
--   어디에: Supabase Dashboard → 좌측 메뉴 SQL Editor → New query
--   무엇을: 이 파일(20260708000700_restrict_get_order_by_token_group.sql)의
--           "실행 SQL 시작" ~ "실행 SQL 끝" 사이 전체를 복사해 붙여넣기.
--           (상단 주석·하단 검증 쿼리 주석은 실행에 영향 없음 — 통째로 붙여도 무방)
--   몇 개: SQL 세트 1개(get_order_by_token 재정의 + GRANT). 순서 고민 불필요.
--   실행: 우측 하단 Run(또는 Ctrl+Enter) 1회. "Success. No rows returned" 나오면 정상.
--   repo 원본 경로:
--     supabase/migrations/20260708000700_restrict_get_order_by_token_group.sql
--   되돌리기: 스키마 변경이 없어 위험 낮음. 문제 시 20260708000400 의 함수 본문을
--            CREATE OR REPLACE 로 다시 실행하면 이전 동작으로 복귀(단, PII 노출 복귀 주의).
--   주의: 프론트(OrderStatusPage)가 이 응답 shape 에 의존한다. 프론트 배포와 순서를 맞춘다
--         (백엔드 먼저 적용해도 프론트는 신규 필드만 추가로 소비 → 하위호환. child_orders 를
--          쓰던 구 프론트는 합배송 화면이 비게 되므로 프론트 배포를 뒤따르게 한다).
-- ─────────────────────────────────────────────────────────────────────────────


-- ===== 실행 SQL 시작 =========================================================

CREATE OR REPLACE FUNCTION public.get_order_by_token(p_token uuid)
RETURNS json
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  -- 1) 토큰 주인 order 식별 (껍데기도 유효 access_token 을 보유 — 엣지 C 실재)
  WITH tok AS (
    SELECT o.id, o.parent_order_id, o.is_group_parent, o.representative_child_id
    FROM orders o
    WHERE o.access_token = p_token
  ),
  -- 2) "표시 대상 order" 결정:
  --      껍데기(is_group_parent) → 대표 자식(representative_child_id)  [엣지 C]
  --                                (NULL 이면 표시 대상 없음 → 최종 결과 없음)
  --      자식/단일               → 본인
  target AS (
    SELECT
      CASE
        WHEN t.is_group_parent THEN t.representative_child_id
        ELSE t.id
      END AS display_id
    FROM tok t
  )
  SELECT row_to_json(result)
  FROM (
    SELECT
      -- ── 본인(표시 대상) 주문 필드 ──
      d.id,
      d.customer_name,
      d.phone_number,
      d.shipping_address,
      d.final_payment,
      d.delivery_fee,
      d.status,
      d.created_at,
      d.customer_request,
      d.is_on_site_sale,
      d.status_history,
      -- ── events (공개 8컬럼) — 000400 line 305-311 과 동일 ──
      (
        SELECT json_build_object(
          'id', e.id, 'name', e.name, 'discount_rate', e.discount_rate,
          'tags', e.tags, 'start_date', e.start_date, 'end_date', e.end_date,
          'estimated_delivery_date', e.estimated_delivery_date, 'venue', e.venue
        )
        FROM events e
        WHERE e.id = d.event_id
      ) AS events,
      -- ── order_items — 000400 line 313-323 단일분기와 1:1 동일 구조 ──
      (
        SELECT json_agg(
          json_build_object(
            'quantity', oi.quantity,
            'price_at_purchase', oi.price_at_purchase,
            'products', (SELECT row_to_json(p) FROM products p WHERE p.id = oi.product_id)
          )
        )
        FROM order_items oi
        WHERE oi.order_id = d.id
      ) AS order_items,
      -- ── 합배송 파생 필드 (껍데기 g 를 조인해 파생, 형제 PII 는 일절 미반환) ──
      --      g = 표시 대상의 껍데기(부모). 단일 주문은 g 없음 → is_grouped=false.
      (g.id IS NOT NULL)                                        AS is_grouped,
      (g.id IS NOT NULL AND d.id = g.representative_child_id)   AS is_representative,
      g.customer_name                                          AS representative_name
    FROM target tg
    JOIN orders d ON d.id = tg.display_id
    LEFT JOIN orders g
      ON g.id = d.parent_order_id
     AND g.is_group_parent = true
  ) result;
$$;

GRANT EXECUTE ON FUNCTION public.get_order_by_token(uuid) TO anon, authenticated;

-- ===== 실행 SQL 끝 ===========================================================


-- ─────────────────────────────────────────────────────────────────────────────
-- ▣ 검증 쿼리 (SQL Editor 에서 개별 실행 — 실제 토큰/ID 로 치환)
-- ─────────────────────────────────────────────────────────────────────────────
--
-- [1] 비대표 자식 토큰 → 타 참여자 PII 부재 · 대표는 이름만
--   SELECT public.get_order_by_token('<비대표-자식-access_token>'::uuid);
--   기대:
--     · is_grouped = true, is_representative = false
--     · customer_name/phone_number/final_payment/order_items = "본인" 값
--     · representative_name = 대표자명(껍데기.customer_name) 만 존재
--     · 응답 JSON 에 child_orders / parent_order_id / is_group_parent /
--       representative_child_id 키 부재
--     · 대표의 phone_number/shipping_address(연락처·주소) 부재 — representative_name 만
--
-- [2] 대표 자식 토큰 → is_representative:true
--   SELECT public.get_order_by_token('<대표-자식-access_token>'::uuid);
--   기대: is_grouped = true, is_representative = true,
--         representative_name = 본인명(대표 = 자기 자신), 본인 필드 정상, child_orders 부재
--
-- [3] 단일(비그룹) 토큰 → 기존 필드 보존
--   SELECT public.get_order_by_token('<단일-주문-access_token>'::uuid);
--   기대: is_grouped = false, is_representative = false, representative_name = null,
--         id/customer_name/phone_number/shipping_address/final_payment/delivery_fee/
--         status/created_at/customer_request/is_on_site_sale/status_history/events/
--         order_items 모두 기존과 동일하게 존재
--
-- [4] 껍데기 토큰 → 대표 자식 뷰로 강등 · 형제 PII/집계액 없음
--   SELECT public.get_order_by_token('<껍데기(is_group_parent)-access_token>'::uuid);
--   기대: 대표 자식 order 로 강등되어 [2]와 동일 shape
--         (is_grouped=true, is_representative=true, representative_name=대표명),
--         껍데기의 집계 final_payment 나 형제 order_items 노출 없음.
--   경계: 해당 껍데기의 representative_child_id 가 NULL 이면 결과 없음(NULL 반환).
--
-- [부가] shape 회귀 확인 — 키 집합 점검
--   SELECT jsonb_object_keys(public.get_order_by_token('<토큰>'::uuid)::jsonb) ORDER BY 1;
--   기대 키(정확히 이 집합): created_at, customer_name, customer_request, delivery_fee,
--     events, final_payment, id, is_grouped, is_on_site_sale, is_representative,
--     order_items, phone_number, representative_name, shipping_address, status,
--     status_history
-- ─────────────────────────────────────────────────────────────────────────────
