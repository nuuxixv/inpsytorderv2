-- ============================================================================
-- [일회성 씨딩 스크립트] products.includes_online_code 3버킷 채우기
-- ----------------------------------------------------------------------------
--   ※ 이 파일은 마이그레이션이 아니다. supabase/migrations/ 에 두지 말 것(순번 오염 방지).
--   ※ 붙여넣기 전용 자체완결 스크립트. "앞 메시지 참조" 없이 이 파일만으로 완결.
--   실행 환경: Supabase 대시보드 SQL Editor(role=postgres). 건우님 승인 후 수동 실행.
--
-- ── 선행 조건(엄수) ──────────────────────────────────────────────────────────
--   1) 20260818010000_DRAFT_add_online_code_columns.sql 적용(includes_online_code 존재).
--   2) products.test_group_id 컬럼 적용 + 검사군 보정 완료
--      (20260630010000_DRAFT_add_products_test_group_columns.sql).
--      ⚠ test_group_id 가 미보정 상태면 A/B 분리가 어긋난다. 아래 [사전스캔] P2~P4 의
--        기대 카운트(208 / 43 / 165)와 실측이 다르면 씨딩을 멈추고 회신할 것.
--
-- ── 판정 규칙(전수조사 C:\tmp\SET_온라인코드_전수조사.md 기준, 우선순위 순) ────────
--   R1 (true) : 상품명에 '온라인' 포함  → 온라인코드 상품 그 자체.  [최우선]
--   R2 (false): category IN ('도서','도구')  → 온라인코드는 검사 전용.
--   R3 (false): 검사 SET 상품 중 A버킷 —
--                 test_group_id IS NULL  OR  같은 검사군에 '온라인' 옵션이 0개.
--   그 외      : NULL 유지(=사람이 찍어야 함).
--                 = B버킷(같은 검사군에 온라인 옵션 존재하는 SET, 165) + 나머지 미분류 검사.
--   모든 UPDATE 는 includes_online_code IS NULL 인 행만 건드림(멱등 + 사람이 수동 확정한
--   값 보존).
--
-- ── 예상 카운트(도메인: 검사 1,126 / 도서 3,392 / 도구 75 = 총 4,593) ────────────
--   true  = 432    (전량 검사, 상품명 '온라인' 포함. 도서·도구엔 '온라인' 명 0 가정)
--   false = 3,510  = 도서·도구 전량 3,467 + 검사 A버킷 SET 43
--   NULL  = 651    = B버킷 165 + 나머지 미분류 검사 486
--   합계  = 432 + 3,510 + 651 = 4,593  ✓
--
--   ⚠ 위임 지시서의 "false ≈ 57 + 3,467" 은 단순 합산이라 14 를 중복 계산한다.
--     A버킷 57개 중 도서 8 + 도구 6 = 14 는 이미 "도서·도구 전량 3,467"에 포함되므로,
--     실제 distinct false = 3,467 + (검사 A버킷 43) = 3,510 이 정답. 아래 [사후검증]에서
--     이 값과 대조한다.
--
-- ── 진행 순서 ────────────────────────────────────────────────────────────────
--   1) [사전스캔] P0~P5 실행 → 도메인·버킷 크기 눈으로 확인(기대값과 대조).
--      ⚠ 실측이 기대와 크게 다르면(특히 P2/P3) 씨딩 전에 회신.
--   2) [씨딩] BEGIN; 로 열고 R1~R3 UPDATE 실행.
--   3) [사후검증] V1~V2 확인. 기대(true 432 / false 3,510 / null 651)면 COMMIT, 아니면 ROLLBACK.
--
-- ── 정의: "SET 상품(검사)" 매처 ──────────────────────────────────────────────
--   name ILIKE '%set%'  OR  name LIKE '%세트%'
--   (SET/Set/set 및 한글 '세트' 포함. 검사 카테고리 내에서만 사용 → 오탐 위험 낮음.
--    UW-SET·Young 심리도식 세트 구성 옵션까지 포괄. P2 카운트로 검증.)
-- ============================================================================


-- ============================================================================
-- [사전스캔] (읽기 전용 — 씨딩 전 반드시 확인)
-- ============================================================================

-- (P0) 카테고리별 총량. 기대: 검사 1126 / 도서 3392 / 도구 75.
SELECT category, count(*) AS cnt
FROM public.products
GROUP BY category
ORDER BY category;

-- (P1) R1 대상: 상품명에 '온라인' 포함(=true 예정). 기대: 432(전량 검사).
SELECT
  count(*)                                                  AS r1_online_name_total,
  count(*) FILTER (WHERE category = '검사')                  AS r1_of_검사,
  count(*) FILTER (WHERE category IN ('도서','도구'))         AS r1_of_도서도구_should_be_0
FROM public.products
WHERE name ILIKE '%온라인%';

-- (P2) 검사 SET 유니버스(= A+B 후보). 기대: 208.
--      name-'온라인'(R1) 제외 → A/B 분리 대상만.
SELECT count(*) AS 검사_set_universe
FROM public.products
WHERE category = '검사'
  AND (name ILIKE '%set%' OR name LIKE '%세트%')
  AND name NOT ILIKE '%온라인%';

-- (P3) A버킷(검사 SET 중 test_group NULL 또는 온라인 옵션 0개). 기대: 43.
SELECT count(*) AS a_bucket_검사
FROM public.products s
WHERE s.category = '검사'
  AND (s.name ILIKE '%set%' OR s.name LIKE '%세트%')
  AND s.name NOT ILIKE '%온라인%'
  AND (
    s.test_group_id IS NULL
    OR NOT EXISTS (
      SELECT 1 FROM public.products sib
      WHERE sib.test_group_id = s.test_group_id
        AND sib.name ILIKE '%온라인%'
    )
  );

-- (P4) B버킷(검사 SET 중 같은 검사군에 온라인 옵션 존재 → NULL 유지). 기대: 165.
--      P3 + P4 = P2(208) 여야 한다.
SELECT count(*) AS b_bucket_검사
FROM public.products s
WHERE s.category = '검사'
  AND (s.name ILIKE '%set%' OR s.name LIKE '%세트%')
  AND s.name NOT ILIKE '%온라인%'
  AND s.test_group_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.products sib
    WHERE sib.test_group_id = s.test_group_id
      AND sib.name ILIKE '%온라인%'
  );

-- (P5) R2 대상: 도서·도구 전량(=false 예정). 기대: 3467.
--      그리고 도서·도구에 '온라인' 명이 있으면(=R1과 충돌) 확인 필요. 기대: 0.
SELECT
  count(*)                                        AS 도서도구_total_should_be_3467,
  count(*) FILTER (WHERE name ILIKE '%온라인%')     AS 도서도구_online_name_should_be_0
FROM public.products
WHERE category IN ('도서','도구');


-- ============================================================================
-- [씨딩] R1 → R2 → R3 순서로 UPDATE. 각 UPDATE 는 IS NULL 행만 건드림(멱등).
--   불안하면 BEGIN; 으로 열고 [사후검증] 확인 후 COMMIT/ROLLBACK.
-- ============================================================================
-- BEGIN;   -- (권장) 수동 트랜잭션으로 진행하려면 주석 해제

-- R1: 상품명에 '온라인' 포함 → true. (온라인코드 상품 자체) 기대 영향행: 432.
UPDATE public.products
SET includes_online_code = true
WHERE includes_online_code IS NULL
  AND name ILIKE '%온라인%';

-- R2: 도서·도구 전량 → false. (온라인코드는 검사 전용) 기대 영향행: 3467.
UPDATE public.products
SET includes_online_code = false
WHERE includes_online_code IS NULL
  AND category IN ('도서','도구');

-- R3: 검사 A버킷(SET & (test_group NULL OR 검사군에 온라인 옵션 0개)) → false.
--     하드코딩 목록 아님 — test_group_id + 검사군 온라인 옵션 유무로 유도(재실행 가능).
--     B버킷(온라인 옵션 있는 검사군의 SET)은 EXISTS 로 자동 제외 → NULL 유지.
--     기대 영향행: 43.
UPDATE public.products s
SET includes_online_code = false
WHERE s.includes_online_code IS NULL
  AND s.category = '검사'
  AND (s.name ILIKE '%set%' OR s.name LIKE '%세트%')
  AND s.name NOT ILIKE '%온라인%'
  AND (
    s.test_group_id IS NULL
    OR NOT EXISTS (
      SELECT 1 FROM public.products sib
      WHERE sib.test_group_id = s.test_group_id
        AND sib.name ILIKE '%온라인%'
    )
  );

-- COMMIT;  -- (위 BEGIN 열었으면) 사후검증 통과 후 COMMIT / 불일치면 ROLLBACK;


-- ============================================================================
-- [사후검증] (씨딩 후 — 모두 기대값이어야 함)
-- ============================================================================

-- (V1) 3상태 전체 분포. 기대: true 432 / false 3510 / null 651 / 합 4593.
SELECT
  count(*) FILTER (WHERE includes_online_code IS TRUE)  AS "true_expect_432",
  count(*) FILTER (WHERE includes_online_code IS FALSE) AS "false_expect_3510",
  count(*) FILTER (WHERE includes_online_code IS NULL)  AS "null_expect_651",
  count(*)                                              AS "total_expect_4593"
FROM public.products;

-- (V2) 카테고리 × 3상태 교차표(어긋난 곳 찾기용).
--   기대:
--     검사  : true 432 / false 43   / null 651
--     도서  : true 0   / false 3392 / null 0
--     도구  : true 0   / false 75   / null 0
SELECT
  category,
  count(*) FILTER (WHERE includes_online_code IS TRUE)  AS is_true,
  count(*) FILTER (WHERE includes_online_code IS FALSE) AS is_false,
  count(*) FILTER (WHERE includes_online_code IS NULL)  AS is_null,
  count(*)                                              AS total
FROM public.products
GROUP BY category
ORDER BY category;


-- ============================================================================
-- [롤백] 씨딩만 되돌리려면(컬럼은 유지, 값만 전부 NULL 로):
--   ⚠ 사람이 수동 확정한 값까지 지워지니 주의. 통상 불필요.
--     UPDATE public.products SET includes_online_code = NULL;
-- ============================================================================
