-- ============================================================================
-- 판매 실적 기반 학회 태그 일괄 부여 (2026-08-25 적용 완료 — 기록·재실행용)
-- ============================================================================
-- 건우님 지시: 각 학회에서 실제 판매된 상품에 그 학회 태그를 넣는다.
--   기준(건우님 확정): ① 판매된 전부(수량 1 포함) ② 검사는 판매된 옵션이 아니라
--   "판매된 검사군의 전 활성 옵션"에 태깅(오늘 확정한 '태그=검사군 속성' 방향과 일치,
--   NAS-PI형 옵션 간 불일치를 만들지 않는다).
--   제외 학회: 오티즘 · TEST · 대한개발자협회.
--
-- 판정 소스: orders(status paid/completed) × order_items × events.host_society.
--   취소·환불 주문은 실적으로 치지 않는다.
--
-- 멱등: tags 에 이미 해당 학회가 있으면 건드리지 않는다(중복 없음, 재실행 안전).
--   기존 태그는 보존하고 뒤에 덧붙인다(덮어쓰기 아님).
--
-- 2026-08-25 실행 결과:
--   대한신경정신의학회 +38 (대상 66, 기태그 28 — DSM류·SCID 옵션 등)
--   한국심리학회       +14 (SCID-5 시리즈 검사군 전체·K-WISC-V·K-STAI-YZ·로샤)
--   대한소아청소년과학회 +3 (읽기유창성및읽기이해 학생4·5·6)
--   대한치매학회        +0 (13종 전부 기태그 — 이전에 이미 정비돼 있었음)
--   사후 불변식(판매 상품·검사군에 태그 누락) = 0 통과.
--
-- 참고 발견:
--   · 치매학회 판매분 스냅샷 15건이 product_id 로는 삭제 상태였으나, 이름 매칭 13건이
--     전부 기태그. 미매칭 2건('슈퍼브레인 ... B단계'·'인지톡톡컬러링북1')은 현재
--     카탈로그에 없어 태깅 불가(정상).
--   · SCID-5 는 같은 약어의 검사군이 둘(시리즈/AMPD)이다. 한국심리학회는 시리즈만
--     판매했으므로 시리즈 검사군만 태깅됨 — 의도된 동작.
-- ============================================================================

WITH sold AS (
  SELECT e.host_society AS soc, oi.product_id, p.test_group_id
  FROM orders o
  JOIN order_items oi ON oi.order_id = o.id
  JOIN events e ON e.id = o.event_id
  JOIN products p ON p.id = oi.product_id
  WHERE o.status IN ('paid','completed')
    AND e.host_society NOT IN ('오티즘','TEST','대한개발자협회')
    AND e.host_society <> ''
),
targets AS (
  -- 평면 상품(도서·도구·검사군 없는 검사): 판매된 상품 자신
  SELECT DISTINCT s.soc, p.id
  FROM sold s JOIN products p ON p.id = s.product_id
  WHERE s.test_group_id IS NULL
  UNION
  -- 검사군 상품: 판매된 검사군의 전 활성 옵션
  SELECT DISTINCT s.soc, p.id
  FROM sold s JOIN products p ON p.test_group_id = s.test_group_id AND p.is_active
  WHERE s.test_group_id IS NOT NULL
)
UPDATE products p
SET tags = coalesce(p.tags, '{}') || ARRAY[t.soc]
FROM targets t
WHERE p.id = t.id
  AND NOT (coalesce(p.tags, '{}') @> ARRAY[t.soc]);

-- ── 사후 검증: 판매 상품(또는 소속 검사군 활성 옵션)에 해당 학회 태그 누락 → 항상 0 ──
WITH sold AS (
  SELECT e.host_society AS soc, oi.product_id, p.test_group_id
  FROM orders o
  JOIN order_items oi ON oi.order_id = o.id
  JOIN events e ON e.id = o.event_id
  JOIN products p ON p.id = oi.product_id
  WHERE o.status IN ('paid','completed')
    AND e.host_society NOT IN ('오티즘','TEST','대한개발자협회')
    AND e.host_society <> ''
),
targets AS (
  SELECT DISTINCT s.soc, p.id FROM sold s JOIN products p ON p.id = s.product_id WHERE s.test_group_id IS NULL
  UNION
  SELECT DISTINCT s.soc, p.id FROM sold s JOIN products p ON p.test_group_id = s.test_group_id AND p.is_active WHERE s.test_group_id IS NOT NULL
)
SELECT count(*) AS leak_should_be_0
FROM targets t JOIN products p ON p.id = t.id
WHERE NOT (coalesce(p.tags, '{}') @> ARRAY[t.soc]);
