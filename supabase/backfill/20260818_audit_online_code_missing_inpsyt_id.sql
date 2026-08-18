-- ============================================================================
-- [읽기 전용 감사 쿼리] 온라인코드 상품 포함 + orders.inpsyt_id 공란 주문
-- ----------------------------------------------------------------------------
--   목적: 온라인코드가 필요한데 inpsyt_id 를 못 받은 주문(사고 유형) 색출.
--   ※ 실행 전용 진단 SQL — UPDATE 없음. 마이그레이션 아님.
--   ※ 개인정보 미포함: 고객 이름·연락처·주소는 SELECT 하지 않는다(주문 id·상태·날짜·상품명까지).
--   실행 환경: Supabase 대시보드 SQL Editor. 아무 때나 안전(읽기 전용).
--
--   "inpsyt_id 공란" 정의: inpsyt_id IS NULL  OR  btrim(inpsyt_id) = ''.
--
--   두 버전:
--     V-A) order_items 스냅샷 기준(씨딩 전에도 동작). product_name/product_code 만 사용.
--          → 상품명에 '온라인' 있는 것만 잡힘. B버킷(상품명에 '온라인' 없는 SET)은 못 잡음.
--     V-B) products.includes_online_code 기준(씨딩 완료 후). 스냅샷 상품명 판정과 합집합.
--          → B버킷 중 사람이 true 로 확정한 것까지 잡힘.
--   두 버전 모두 status별 집계(-1) + 상세 목록(-2) 제공.
-- ============================================================================


-- ============================================================================
-- V-A. order_items 스냅샷 기준 (씨딩 전에도 사용 가능)
-- ============================================================================

-- (V-A-1) status 별 집계.
WITH online_orders AS (
  SELECT DISTINCT oi.order_id
  FROM public.order_items oi
  WHERE oi.product_name ILIKE '%온라인%'
)
SELECT o.status, count(*) AS cnt
FROM public.orders o
JOIN online_orders x ON x.order_id = o.id
WHERE o.inpsyt_id IS NULL OR btrim(o.inpsyt_id) = ''
GROUP BY o.status
ORDER BY cnt DESC;

-- (V-A-2) 상세 목록(개인정보 제외). 매칭된 온라인코드 상품명도 함께.
WITH matched_items AS (
  SELECT oi.order_id,
         string_agg(DISTINCT oi.product_name, ' | ') AS online_products
  FROM public.order_items oi
  WHERE oi.product_name ILIKE '%온라인%'
  GROUP BY oi.order_id
)
SELECT
  o.id            AS order_id,
  o.status,
  o.created_at,
  o.event_id,
  o.is_on_site_sale,
  m.online_products
FROM public.orders o
JOIN matched_items m ON m.order_id = o.id
WHERE o.inpsyt_id IS NULL OR btrim(o.inpsyt_id) = ''
ORDER BY o.created_at DESC;


-- ============================================================================
-- V-B. products.includes_online_code 기준 (씨딩 완료 후)
--   스냅샷 상품명 판정과 합집합 → B버킷 중 확정(true)된 상품 포함 주문까지 색출.
--   FK 완화(20260415_008)로 product 삭제된 스냅샷은 p 가 NULL → 상품명 판정으로 보완.
-- ============================================================================

-- (V-B-1) status 별 집계.
WITH online_orders AS (
  SELECT DISTINCT oi.order_id
  FROM public.order_items oi
  LEFT JOIN public.products p ON p.id = oi.product_id
  WHERE p.includes_online_code = true
     OR oi.product_name ILIKE '%온라인%'
)
SELECT o.status, count(*) AS cnt
FROM public.orders o
JOIN online_orders x ON x.order_id = o.id
WHERE o.inpsyt_id IS NULL OR btrim(o.inpsyt_id) = ''
GROUP BY o.status
ORDER BY cnt DESC;

-- (V-B-2) 상세 목록(개인정보 제외).
WITH matched_items AS (
  SELECT oi.order_id,
         string_agg(DISTINCT oi.product_name, ' | ') AS online_products
  FROM public.order_items oi
  LEFT JOIN public.products p ON p.id = oi.product_id
  WHERE p.includes_online_code = true
     OR oi.product_name ILIKE '%온라인%'
  GROUP BY oi.order_id
)
SELECT
  o.id            AS order_id,
  o.status,
  o.created_at,
  o.event_id,
  o.is_on_site_sale,
  m.online_products
FROM public.orders o
JOIN matched_items m ON m.order_id = o.id
WHERE o.inpsyt_id IS NULL OR btrim(o.inpsyt_id) = ''
ORDER BY o.created_at DESC;


-- ============================================================================
-- [참고] B버킷(165) 한계: 상품명에 '온라인'이 없고 아직 includes_online_code 가
--   NULL(미확인)인 SET(예 K-Bayley-4 SET)은 V-A·V-B 어느 쪽으로도 안 잡힌다.
--   이는 데이터로 판별 불가한 영역으로, 담당자가 해당 SET 을 true 로 확정한 뒤에야
--   V-B 에서 색출된다(=본 3상태 플래그를 도입한 이유).
-- ============================================================================
