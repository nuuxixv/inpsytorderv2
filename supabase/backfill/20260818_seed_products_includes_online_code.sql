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
--   2) [씨딩] BEGIN; 로 열고 R1~R4 UPDATE 실행.
--   3) [사후검증] V1~V2 확인. 판정은 절대 카운트가 아니라 V1-b·V1-c 불변식(전부 0)으로 한다.
--      참고 스냅샷: true 611 / false 3,498 / null 521 / total 4,630 (2026-08-19).
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

-- R1: 검사 중 상품명에 '온라인' 포함 → true. (온라인코드 상품 자체) 기대 영향행: 451.
UPDATE public.products
SET includes_online_code = true
WHERE includes_online_code IS NULL
  AND category = '검사'            -- ★ 검사로 한정. 온라인코드는 검사 전용이다.
  AND name ILIKE '%온라인%';
-- ★ category='검사' 한정 이유(실측 근거):
--   도서 5건이 상품명에 '온라인'을 포함한다 — '온라인상담개론(김환)',
--   '온라인마케팅성공마스터10단계(나연재)', '온라인상담의기술(이슬아)',
--   '온라인수업에서팀학습어떻게할까(박수정)', '온라인청년극우의성차별인종주의~(김정은)'.
--   전부 '온라인'을 주제로 다룬 책이고 온라인코드와 무관하다.
--   한정하지 않으면 규칙2(도서·도구→false)보다 먼저 걸려 true 로 오염되고,
--   고객이 이 책을 살 때 인싸이트 ID를 요구받는다. (현행 운영 코드의 오탐과 동일 원인)

-- R2: 도서·도구 전량 → false. (온라인코드는 검사 전용) 기대 영향행: 3467.
UPDATE public.products
SET includes_online_code = false
WHERE includes_online_code IS NULL
  AND category IN ('도서','도구');

-- ── SET 판별식에 대하여 ─────────────────────────────────────────────────────
--   SET 판별은 name 이 아니라 option_name 으로 한다.
--   name 기준은 검사명에 'SET'이 든 검사군에서 오탐한다 — 예: UW-SET 검사군의
--   '검사지(20)'·'온라인코드(10)'·'전문가지침서(1)'까지 SET로 잡혔다(실측 델타 17건).
--   option_name 에는 검사명이 섞이지 않아 이 오탐이 원천 해소된다.
--   접두 'SET%' 를 쓴다('%SET%' 보다 안전).

-- R3: 검사 SET 중 "검사군에 온라인코드 옵션이 있는" 것 → true. 기대 영향행: 160.
--     ★ 건우님 확정(2026-08-18): 해당 SET 160건 "전부 포함".
--       상품 담당자 확인 요청 목록(SET 상품 160건 / 검사 116종)을 그대로 true 로 확정.
--     자동 추론이 아니라 사람의 결정이다. 데이터만으로는 SET 구성품을 알 수 없다.
--     오류 방향도 안전하다 — 실제로 미포함인 SET가 섞여 있으면 고객에게 인싸이트 ID를
--     불필요하게 한 번 더 물을 뿐이고, 반대(코드를 줬는데 ID를 못 받는 사고)는 사라진다.
UPDATE public.products s
SET includes_online_code = true
WHERE s.includes_online_code IS NULL
  AND s.category = '검사'
  AND (s.option_name ILIKE 'SET%' OR s.option_name ILIKE '%세트%')
  AND s.test_group_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.products sib
    WHERE sib.test_group_id = s.test_group_id
      AND sib.is_active
      AND sib.option_name ILIKE '%온라인%'
  );

-- R4: 검사 SET 중 "검사군에 온라인코드 옵션이 0개"인 것 → false. 기대 영향행: 31.
--     그런 검사군은 모든 옵션이 실제로 온라인코드가 없으므로 false 가 옳다.
--     하드코딩 목록 아님 — test_group_id + 검사군 온라인 옵션 유무로 유도(재실행 가능).
UPDATE public.products s
SET includes_online_code = false
WHERE s.includes_online_code IS NULL
  AND s.category = '검사'
  AND (s.option_name ILIKE 'SET%' OR s.option_name ILIKE '%세트%')
  AND (
    s.test_group_id IS NULL
    OR NOT EXISTS (
      SELECT 1 FROM public.products sib
      WHERE sib.test_group_id = s.test_group_id
        AND sib.is_active
        AND sib.option_name ILIKE '%온라인%'
    )
  );

-- R5: 나머지 미분류 전량 → false. 기대 영향행: 520.
--     ★ 건우님 확정(2026-08-19): "상품명에 온라인코드/SET가 아닌 검사지·지침서·기록지 등은
--       전부 미확인 → 미포함으로." 검사 옵션의 잔여 NULL 을 비운다.
--     적용 전 변칙 스캔 결과(11건)는 전부 실물이라 false 가 옳다 —
--       '홀랜드 진로코드집(공용)(1)' 9건(인쇄 책자의 진로코드, 온라인코드 아님),
--       '유아 창의성 검사 활용법 CD(1)' 1건, '활동 프로그램 USB(...)(1)' 1건.
--     SET 는 제외한다(건우님 규칙). option_name 이 비어 매처가 못 잡는 행은
--       name 기준 SET 판정으로 보완 → 'K-CTC 유아 창의적 특성검사_SET(1)'(비활성) 1건만
--       NULL 로 남는다. 이게 유일한 잔여 미확인이며 판매되지 않아 무해하다.
UPDATE public.products
SET includes_online_code = false
WHERE includes_online_code IS NULL
  AND name NOT ILIKE '%온라인%'
  AND coalesce(option_name, '') NOT ILIKE '%온라인%'
  AND NOT (
    coalesce(option_name, '') ILIKE 'SET%'
    OR coalesce(option_name, '') ILIKE '%세트%'
    OR (coalesce(option_name, '') = '' AND (name ILIKE '%set%' OR name LIKE '%세트%'))
  );

-- COMMIT;  -- (위 BEGIN 열었으면) 사후검증 통과 후 COMMIT / 불일치면 ROLLBACK;


-- ============================================================================
-- [사후검증] (씨딩 후 — 모두 기대값이어야 함)
-- ============================================================================

-- (V1) 3상태 전체 분포. 기대: true 432 / false 3510 / null 651 / 합 4593.
SELECT
  count(*) FILTER (WHERE includes_online_code IS TRUE)  AS is_true,
  count(*) FILTER (WHERE includes_online_code IS FALSE) AS is_false,
  count(*) FILTER (WHERE includes_online_code IS NULL)  AS is_null,
  count(*)                                              AS total
FROM public.products;

-- (V1-b) 불변식 검증 — 절대 카운트가 아니라 "0이어야 하는 것"을 본다.
--   절대 카운트로 검증하지 않는 이유: 이 서비스는 학회 기간에 어드민이 상품을 실시간으로
--   등록·활성화한다. 실제로 본 스크립트 작성 중 검사 활성 상품이 1,126 → 1,133 으로 늘었다.
--   따라서 하드코딩한 기대치는 실행 시점에 반드시 틀어지고, 운영자는 정상인데도 STOP 하거나
--   반대로 경고를 무시하는 습관이 생긴다. 아래 3개는 데이터가 늘어도 항상 0이어야 한다.
--   ⚠ 하나라도 0이 아니면 STOP 하고 원인을 확인할 것.
SELECT
  -- 상품명에 '온라인'이 있는데 아직 미분류인 것 → 규칙 1 누락
  count(*) FILTER (
    WHERE name ILIKE '%온라인%' AND includes_online_code IS NULL
  ) AS leak_online_name_still_null,
  -- 도서·도구인데 미분류인 것 → 규칙 2 누락(온라인코드는 검사 전용)
  count(*) FILTER (
    WHERE category IN ('도서','도구') AND includes_online_code IS NULL
  ) AS leak_book_tool_still_null,
  -- 도서·도구인데 true 로 찍힌 것 → 상품명 오탐(예: '온라인 강의' 같은 도서)
  count(*) FILTER (
    WHERE category IN ('도서','도구') AND includes_online_code IS TRUE
  ) AS suspect_book_tool_true
FROM public.products;

-- (V1-c) 검사 SET 에 미분류가 남았는지 → 항상 0.
--   R3(true)·R4(false)가 검사 SET 전량을 덮으므로 잔여 NULL 이 있으면 판별식 사각지대다.
--   가장 흔한 원인은 option_name 이 NULL 인 SET 상품 → 아래 두 번째 쿼리로 분리 확인.
SELECT count(*) AS leak_set_still_null
FROM public.products s
WHERE s.includes_online_code IS NULL
  AND s.category = '검사'
  AND (s.option_name ILIKE 'SET%' OR s.option_name ILIKE '%세트%');

-- (V1-d) 판별식 사각지대 — 상품명은 SET 인데 option_name 이 비어 매처에 안 걸린 검사 상품.
--   2026-08-19 실측 = 1건. id 36099 'K-CTC 유아 창의적 특성검사_SET(1)'(PITM 구코드,
--   is_active=false, 검사군 없음). 판매되지 않으므로 NULL 유지로 무해 — 정상이다.
--   2건 이상이면 새로 생긴 사각지대이니 목록을 사람이 직접 확인할 것(자동 확정 금지).
SELECT count(*) AS blindspot_set_name_without_option_name
FROM public.products
WHERE category = '검사'
  AND (name ILIKE '%set%' OR name LIKE '%세트%')
  AND coalesce(option_name, '') = '';

-- (V2) 카테고리 × 3상태 교차표(어긋난 곳 찾기용).
--   2026-08-19 시뮬레이션 스냅샷(참고용 — 상품 등록으로 계속 변한다):
--     전체  : true 611 (이름 451 + SET 160) / false 4,018 / null 1 / total 4,630
--     검사  : true 611 / false 551 / null 1 (비활성 K-CTC SET 하나만 미확인)
--     도서  : false 3,392   ·   도구 : false 75
--     도서  : true 0 근처 / false ≈3,392 / null 0
--     도구  : true 0      / false 75     / null 0
--     검사  : true 대부분 / false = A버킷 / null = B버킷 165 + 미분류
--   판정은 위 (V1-b)·(V1-c) 불변식으로 한다. 아래 표는 눈으로 훑는 용도.
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
