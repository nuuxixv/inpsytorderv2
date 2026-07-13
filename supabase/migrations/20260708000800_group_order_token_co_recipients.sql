-- 합배송 고객 주문서 문구 재설계 — get_order_by_token 동일인(연락처) 판정 + 타인 이름 목록 (보안/문구)
-- 설계: docs/superpowers/specs/2026-07-09-합배송-고객주문서-노출최소화-design.md §2.0, §2.1, §3.1
--
-- 배경(왜 바꾸나):
--   직전 최신 정의(20260708000700)는 합배송이면 대표자명(representative_name)을 껍데기
--   스냅샷(g.customer_name)으로 무조건 내려주고, 대표 화면에 "함께 배송되는 타인" 명단이 없었다.
--   그러나 합배송 참여자는 (a) 동일인의 재/추가주문 · (b) 지인 대표 수령이 섞일 수 있고,
--   스펙 §2.1 의 안내 문구는 "동일인 여부(연락처 일치)" 와 "대표 여부"로 4분기한다:
--     1. 연계가 전부 본인(모든 참여 연락처 == 본인)        → "묶음배송 예정입니다."
--     2. 비대표 화면(대표가 타인)                          → "{대표명} 님의 주소지로 함께 배송됩니다."
--     3. 대표 화면(타인 섞임)                              → "{타인 이름들} 님의 주문 상품이 함께 배송됩니다."
--     4. 미세 엣지: 비대표 화면인데 그 대표가 본인 연락처   → 본인 이름 노출 방지 → "묶음배송 예정입니다."
--   이 4분기를 프론트가 렌더하려면 응답에 다음 두 파생이 필요하다(연락처 비교는 함수 내부에서만):
--     · representative_name : 비대표 & "대표가 본인과 다른 연락처" 일 때만 대표명, 아니면 NULL
--                             → 분기 2 는 이름 존재, 분기 1·4 는 NULL(→"묶음배송 예정입니다.")
--     · co_recipient_names  : 대표 화면일 때만, 본인 연락처와 다른 참여자 이름 distinct(타인 명단)
--                             → 분기 3. 비대표엔 빈 배열(PII 차단 — 비대표에 타인 명단 내리지 않음)
--
--   중요(대표 재위임 정합): 대표 판정·연락처 비교는 껍데기 스냅샷(g.customer_name)이 아니라
--   "대표자식 r"(r.id = g.representative_child_id)의 실값을 쓴다. 대표가 재위임되면
--   representative_child_id 가 가리키는 현재 대표 자식의 실 연락처/이름으로 판정해야 정합.
--
--   응답에는 boolean 과 이름(text·text[])만 담긴다. 타인의 연락처·주소·금액·상품은 여전히 미반환.
--   000700 이 이미 형제 상세(child_orders[]) 를 응답에서 제거했고, 본 마이그레이션은 그 위에
--   representative_name 을 조건부로 정교화하고 co_recipient_names(text[]) 만 추가한다.
--
-- append-only 원칙: 기존 마이그레이션 파일은 절대 수정하지 않는다. 이 신규 파일이
--   20260708000700 의 get_order_by_token 본문을 CREATE OR REPLACE 로 덮어쓴다(최신이 승리).
--   000700 이 직전 최신 정의였고, 그 이후 이 함수를 재정의한 마이그레이션은 없다.
--   000700 의 반환 구조(본인 필드 11종·events·order_items·is_grouped·is_representative)는
--   전부 그대로 유지하고, representative_name 파생만 보정 + co_recipient_names 만 신설한다.
--
-- 멱등: CREATE OR REPLACE FUNCTION + GRANT 만 수행. 스키마 변경 없음. 2회 실행 무에러.
--
-- 함수 속성 유지: LANGUAGE sql, SECURITY DEFINER, STABLE, SET search_path = public,
--                 GRANT EXECUTE TO anon, authenticated.


-- ─────────────────────────────────────────────────────────────────────────────
-- ▣ 적용 가이드 (자체 완결 — 이 블록만 보고 적용 가능)
-- ─────────────────────────────────────────────────────────────────────────────
--   어디에: Supabase Dashboard → 좌측 메뉴 SQL Editor → New query
--   무엇을: 이 파일(20260708000800_group_order_token_co_recipients.sql)의
--           "실행 SQL 시작" ~ "실행 SQL 끝" 사이 전체를 복사해 붙여넣기.
--           (상단 주석·하단 검증 쿼리 주석은 실행에 영향 없음 — 통째로 붙여도 무방)
--   몇 개: SQL 세트 1개(get_order_by_token 재정의 + GRANT). 순서 고민 불필요.
--   실행: 우측 하단 Run(또는 Ctrl+Enter) 1회. "Success. No rows returned" 나오면 정상.
--   repo 원본 경로:
--     supabase/migrations/20260708000800_group_order_token_co_recipients.sql
--   되돌리기: 스키마 변경이 없어 위험 낮음. 문제 시 20260708000700 의 함수 본문을
--            CREATE OR REPLACE 로 다시 실행하면 이전 동작(대표명 무조건 노출·명단 없음)으로 복귀.
--   주의: 프론트(OrderStatusPage)가 이 응답 shape 에 의존한다. 프론트 배포와 순서를 맞춘다.
--         본 변경은 필드 "추가"(co_recipient_names)와 representative_name "조건부 NULL화" 뿐이라
--         하위호환에 가깝다. 다만 구 프론트는 대표명이 상황에 따라 사라지므로 프론트 배포를
--         뒤따르게 하는 것을 권장한다.
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
      -- ── 본인(표시 대상) 주문 필드 ── (000700 과 동일)
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
      -- ── events (공개 8컬럼) — 000700 과 동일 ──
      (
        SELECT json_build_object(
          'id', e.id, 'name', e.name, 'discount_rate', e.discount_rate,
          'tags', e.tags, 'start_date', e.start_date, 'end_date', e.end_date,
          'estimated_delivery_date', e.estimated_delivery_date, 'venue', e.venue
        )
        FROM events e
        WHERE e.id = d.event_id
      ) AS events,
      -- ── order_items — 000700 과 동일 구조(본인 주문 품목만) ──
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
      -- ── 합배송 파생 필드 ──
      --      g = 표시 대상의 껍데기(부모, is_group_parent). 단일 주문은 g 없음 → is_grouped=false.
      --      r = 대표 자식(r.id = g.representative_child_id). 대표명·연락처의 "실값" 소스.
      --          (스냅샷 g.customer_name 이 아니라 r 을 써야 대표 재위임에 정합)
      (g.id IS NOT NULL)                                        AS is_grouped,
      (g.id IS NOT NULL AND d.id = g.representative_child_id)   AS is_representative,
      -- representative_name: 비대표 & "대표가 본인과 다른 연락처" 일 때만 대표명, 아니면 NULL.
      --   · 분기 2(비대표·대표 타인)      → 대표명(string)
      --   · 분기 4(비대표·대표 본인연락처) → NULL   (본인 이름 노출 방지 → "묶음배송 예정입니다.")
      --   · 대표 본인 화면 / 단일 주문     → NULL
      --   연락처 비교는 함수 내부에서만; 응답엔 이름(text)만.
      CASE
        WHEN NOT (g.id IS NOT NULL AND d.id = g.representative_child_id)
         AND r.phone_number IS DISTINCT FROM d.phone_number
        THEN r.customer_name
        ELSE NULL
      END                                                       AS representative_name,
      -- co_recipient_names: 대표(is_representative) 화면일 때만, 본인 연락처와 "다른" 참여자
      --   이름을 distinct·정렬로 나열(분기 3). 취소/환불 제외. 동일인(본인 재주문분) 제외.
      --   비대표 화면이면 빈 배열(text[]) — 비대표에 타인 명단을 내리지 않는다(PII 차단).
      CASE
        WHEN (g.id IS NOT NULL AND d.id = g.representative_child_id) THEN (
          SELECT coalesce(array_agg(DISTINCT c.customer_name ORDER BY c.customer_name), '{}'::text[])
          FROM orders c
          WHERE c.parent_order_id = g.id
            AND c.status NOT IN ('cancelled', 'refunded')
            AND c.phone_number IS DISTINCT FROM d.phone_number
        )
        ELSE '{}'::text[]
      END                                                       AS co_recipient_names
    FROM target tg
    JOIN orders d ON d.id = tg.display_id
    LEFT JOIN orders g
      ON g.id = d.parent_order_id
     AND g.is_group_parent = true
    LEFT JOIN orders r
      ON r.id = g.representative_child_id
  ) result;
$$;

GRANT EXECUTE ON FUNCTION public.get_order_by_token(uuid) TO anon, authenticated;

-- ===== 실행 SQL 끝 ===========================================================


-- ─────────────────────────────────────────────────────────────────────────────
-- ▣ 검증 쿼리 (SQL Editor 에서 개별 실행 — 실제 토큰/ID 로 치환)
-- ─────────────────────────────────────────────────────────────────────────────
--
-- [1] 비대표 자식(대표 = 타인) 토큰 → 대표명 노출, 명단은 빈 배열, 타 PII 부재
--   SELECT public.get_order_by_token('<비대표-자식(대표=타인)-access_token>'::uuid);
--   기대:
--     · is_grouped = true, is_representative = false
--     · representative_name = 대표자식(r) 이름 (string)
--     · co_recipient_names = []  ← 비대표엔 타인 명단을 내리지 않음(PII 차단)
--     · customer_name/phone_number/final_payment/order_items = "본인" 값
--     · 응답 JSON 에 child_orders / parent_order_id / is_group_parent /
--       representative_child_id 키 부재, 대표의 phone_number/shipping_address 부재
--
-- [2] 비대표 자식(대표 = 본인 연락처) 토큰 → 대표명 NULL (분기 4)
--   SELECT public.get_order_by_token('<비대표-자식(대표=본인연락처)-access_token>'::uuid);
--   기대:
--     · is_grouped = true, is_representative = false
--     · representative_name = null   ← 대표가 본인 연락처 → 이름 미노출("묶음배송 예정입니다.")
--     · co_recipient_names = []
--
-- [3] 대표 자식(타인 섞임) 토큰 → 타인 이름 목록, 동일인 재주문 이름 제외 (분기 3)
--   SELECT public.get_order_by_token('<대표-자식(타인 포함)-access_token>'::uuid);
--   기대:
--     · is_grouped = true, is_representative = true
--     · co_recipient_names = [본인 연락처와 다른 참여자 이름들, distinct·오름차순]
--       (본인과 연락처 같은 재주문분 이름은 제외 / 취소·환불 제외)
--     · representative_name = null  (대표 본인 화면)
--
-- [4] 대표 자식(참여자 전부 동일인 = 본인 연락처) 토큰 → 명단 빈 배열 (분기 1)
--   SELECT public.get_order_by_token('<대표-자식(전부 동일인)-access_token>'::uuid);
--   기대:
--     · is_grouped = true, is_representative = true
--     · co_recipient_names = []   ← 전부 본인 연락처 → "묶음배송 예정입니다."
--     · representative_name = null
--
-- [5] 단일(비그룹) 토큰 → 기존 필드 보존, 파생 모두 비활성
--   SELECT public.get_order_by_token('<단일-주문-access_token>'::uuid);
--   기대:
--     · is_grouped = false, is_representative = false
--     · representative_name = null, co_recipient_names = []
--     · id/customer_name/phone_number/shipping_address/final_payment/delivery_fee/
--       status/created_at/customer_request/is_on_site_sale/status_history/events/
--       order_items 모두 기존과 동일하게 존재
--
-- [부가] 껍데기 토큰 → 대표 자식 뷰로 강등([3]/[4]와 동일 shape)
--   SELECT public.get_order_by_token('<껍데기(is_group_parent)-access_token>'::uuid);
--   경계: 해당 껍데기의 representative_child_id 가 NULL 이면 결과 없음(NULL 반환).
--
-- [부가] shape 회귀 확인 — 키 집합 점검(정확히 17키)
--   SELECT jsonb_object_keys(public.get_order_by_token('<토큰>'::uuid)::jsonb) ORDER BY 1;
--   기대 키(정확히 이 집합):
--     co_recipient_names, created_at, customer_name, customer_request, delivery_fee,
--     events, final_payment, id, is_grouped, is_on_site_sale, is_representative,
--     order_items, phone_number, representative_name, shipping_address, status,
--     status_history
-- ─────────────────────────────────────────────────────────────────────────────
