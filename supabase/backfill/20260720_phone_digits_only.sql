-- ============================================================================
-- [일회성 백필 스크립트] orders.phone_number → 숫자만 정규화(기존 데이터)
-- ----------------------------------------------------------------------------
--   ※ 이 파일은 마이그레이션이 아니다. supabase/migrations/ 에 두지 말 것
--     (순번 오염 방지). 트리거 마이그레이션
--     (20260720000000_phone_normalize_trigger.sql) 적용 완료 후,
--     기존 저장분(하이픈·공백·괄호 섞인 값)을 한 번 정리하는 수동 스크립트.
--
--   실행 환경: Supabase 대시보드 SQL Editor(role=postgres). 건우님 승인 후 수동 실행.
--   자동 CLI/자동 적용 아님.
--
--   정규식은 트리거와 동일: regexp_replace(phone_number, '\D', '', 'g')
--   → 비숫자 문자 전부 제거, 빈 문자열은 NULLIF 로 NULL 처리(트리거와 일관).
--
--   ※ 붙여넣기 전용 자체완결 스크립트다. "앞 메시지 참조" 없이 이 파일만으로 완결.
--
-- ── 실행 순서(엄수) ──────────────────────────────────────────────────────────
--   1) 트리거 마이그레이션 20260720000000_phone_normalize_trigger.sql 먼저 적용.
--   2) [사전스캔] 아래 SELECT 3종 실행 → 대상 건수·자리수 분포·이상치 눈으로 확인.
--      ⚠ 이상치(비정상 자리수: 8/9/10/11 외, 또는 0자리) 발견 시 백필 전에
--        메인 Claude / 건우님에게 회신하여 판단 받는다(무조건 밀어붙이지 말 것).
--   3) [백업] 백업 테이블 생성(원본 phone_number 아티팩트 보존).
--   4) [백필] UPDATE 실행.
--   5) [사후검증] 비숫자 잔존 0 확인 + before/after 카운트 비교.
--
-- ── 롤백 ─────────────────────────────────────────────────────────────────────
--   백업 테이블에서 정확 복원 가능(아래 [롤백] 블록 참조). 단 digits(숫자)가
--   정본이고 프론트 formatPhone 이 표시를 재구성하므로 통상 롤백은 불필요하다.
-- ============================================================================


-- ============================================================================
-- [사전스캔] (읽기 전용 — 백필 전 반드시 눈으로 확인)
-- ============================================================================

-- (S-1) 비숫자 문자를 포함한 행 수 = 이번 백필 대상 건수.
--       기대: 하이픈 저장분 다수. 0이면 이미 전부 숫자(백필 불필요).
SELECT count(*) AS rows_with_non_digit
FROM public.orders
WHERE phone_number ~ '\D';

-- (S-2) 숫자만 남겼을 때의 자리수 분포(전화번호 정상 범위 8~11자리 점검).
--       phone_number IS NULL 은 집계 제외(정규화 대상 아님).
--       기대: 대부분 10(구형 휴대폰/지역번호) 또는 11(휴대폰). 8·9·기타는 확인 요망.
SELECT
  CASE
    WHEN digits_len = 0  THEN '0 (빈값/문자만)'
    WHEN digits_len = 8  THEN '8'
    WHEN digits_len = 9  THEN '9'
    WHEN digits_len = 10 THEN '10'
    WHEN digits_len = 11 THEN '11'
    ELSE 'other'
  END                                      AS digit_length_bucket,
  count(*)                                 AS cnt
FROM (
  SELECT length(regexp_replace(coalesce(phone_number, ''), '\D', '', 'g')) AS digits_len
  FROM public.orders
  WHERE phone_number IS NOT NULL
) t
GROUP BY 1
ORDER BY 1;

-- (S-3) 자리수 이상치 샘플 20행(정상 범위 10·11 자리 밖).
--       원본 phone_number 와 정규화 예상값을 나란히 확인 → 진짜 이상치인지 판단.
--       ⚠ 여기서 뭔가 나오면 백필 전에 회신할 것.
SELECT
  id,
  phone_number                                                     AS raw_phone,
  NULLIF(regexp_replace(coalesce(phone_number, ''), '\D', '', 'g'), '') AS normalized_preview,
  length(regexp_replace(coalesce(phone_number, ''), '\D', '', 'g')) AS digits_len
FROM public.orders
WHERE phone_number IS NOT NULL
  AND length(regexp_replace(coalesce(phone_number, ''), '\D', '', 'g')) NOT IN (10, 11)
ORDER BY id
LIMIT 20;


-- ============================================================================
-- [백업] 원본 아티팩트 보존(정확 복원용). 대상 = 비숫자 포함 행만.
--   멱등: CREATE TABLE IF NOT EXISTS. 이미 있으면 그대로 둔다(최초 원본 보존).
--   ⚠ 재실행 주의: 백필을 이미 돌린 뒤라면 이 SELECT 는 0행이 되므로, 반드시
--     "백필 전"에 이 백업을 먼저 만들어야 원본이 보존된다.
-- ============================================================================
CREATE TABLE IF NOT EXISTS public._phone_backfill_backup_20260720 AS
SELECT id, phone_number
FROM public.orders
WHERE phone_number ~ '\D';

-- 백업 건수 확인(사전스캔 S-1 과 동일해야 함).
SELECT count(*) AS backed_up_rows FROM public._phone_backfill_backup_20260720;


-- ============================================================================
-- [백필] 비숫자 포함 행만 숫자만 남기도록 UPDATE.
--   정규식은 트리거와 동일. 빈 문자열은 NULLIF 로 NULL 처리.
--   대상 한정(WHERE phone_number ~ '\D')으로 불필요한 쓰기 최소화.
--   불안하면 BEGIN; 으로 열고 아래 [사후검증] 확인 후 COMMIT/ROLLBACK 수동 진행.
-- ============================================================================
-- BEGIN;   -- (선택) 수동 트랜잭션으로 진행하려면 주석 해제

UPDATE public.orders
SET phone_number = NULLIF(regexp_replace(phone_number, '\D', '', 'g'), '')
WHERE phone_number ~ '\D';

-- COMMIT;  -- (선택) 위 BEGIN 을 열었다면 사후검증 후 COMMIT


-- ============================================================================
-- [사후검증] (백필 후 — 모두 기대값이어야 함)
-- ============================================================================

-- (V-1) 비숫자 잔존 0 확인. 기대: 0.
SELECT count(*) AS remaining_non_digit
FROM public.orders
WHERE phone_number ~ '\D';

-- (V-2) before/after 카운트 비교.
--       backed_up = 백업(=백필 전 비숫자 행 수), still_non_digit = 백필 후 잔존(기대 0),
--       normalized = 실제 정규화된 행 수. backed_up = normalized 이고 still = 0 이어야 정상.
SELECT
  (SELECT count(*) FROM public._phone_backfill_backup_20260720)        AS backed_up,
  (SELECT count(*) FROM public.orders WHERE phone_number ~ '\D')       AS still_non_digit,
  (SELECT count(*)
     FROM public._phone_backfill_backup_20260720 b
     JOIN public.orders o ON o.id = b.id
    WHERE o.phone_number IS DISTINCT FROM b.phone_number)              AS normalized;


-- ============================================================================
-- [롤백] 되돌리기 (통상 불필요 — digits 가 정본이고 formatPhone 이 표시 재구성)
-- ----------------------------------------------------------------------------
--   원본을 그대로 되돌리려면(백업 테이블 기준):
--
--     UPDATE public.orders o
--     SET phone_number = b.phone_number
--     FROM public._phone_backfill_backup_20260720 b
--     WHERE o.id = b.id;
--
--   복원 확인 후 백업 테이블 정리(원할 때):
--     DROP TABLE public._phone_backfill_backup_20260720;
-- ============================================================================
