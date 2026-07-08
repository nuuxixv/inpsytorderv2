-- 주문 연계(합배송) 껍데기 부모 모델 — 스키마
-- 설계: docs/superpowers/specs/2026-07-07-주문연계-그룹모델-재설계-design.md §1
--
-- 목적:
--   1) is_group_parent: 표시·집계 전용 "껍데기 부모" 주문 플래그(신규).
--   2) parent_order_id: 이미 운영 DB에는 존재(코드 전반에서 사용)하나 리포지토리
--      마이그레이션에는 컬럼 정의가 없었음 → 멱등 정식화(컬럼 + FK).
--   3) 조회 성능용 부분 인덱스.
--
-- 백필 금지: 본 마이그레이션은 기존 데이터를 변경하지 않는다.
--   is_group_parent 는 NOT NULL DEFAULT false 이므로 기존 행은 모두 false 로 채워진다.
--   기존에 parent_order_id 가 설정된 행이 있는지는 아래 "적용 가이드"의 선(先)확인 쿼리로 점검한다.
--
-- 멱등: 2회 실행해도 에러 없음(ADD COLUMN IF NOT EXISTS / CREATE INDEX IF NOT EXISTS /
--       FK·제약 존재 여부 DO 블록 가드).

-- 1) 껍데기 부모 플래그
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS is_group_parent boolean NOT NULL DEFAULT false;

-- 2) parent_order_id 컬럼 멱등 정식화
--    (운영 DB에 이미 있으면 IF NOT EXISTS 로 스킵 — 데이터 불변)
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS parent_order_id bigint;

-- 2-b) FK 멱등 추가 — 컬럼 이름 기준으로 이미 FK 가 있으면(제약 이름 무관) 스킵.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_attribute a
      ON a.attrelid = c.conrelid AND a.attnum = ANY (c.conkey)
    WHERE c.conrelid = 'public.orders'::regclass
      AND c.contype = 'f'
      AND a.attname = 'parent_order_id'
  ) THEN
    ALTER TABLE public.orders
      ADD CONSTRAINT orders_parent_order_id_fkey
      FOREIGN KEY (parent_order_id) REFERENCES public.orders(id);
  END IF;
END $$;

-- 3) 부분 인덱스
--    자식 → 부모 조인/조회(get_order_by_token child_orders, 목록 트리)
CREATE INDEX IF NOT EXISTS idx_orders_parent_order_id
  ON public.orders (parent_order_id)
  WHERE parent_order_id IS NOT NULL;

--    껍데기 부모만 빠르게 걸러내기(매출 필터·목록 트리 루트)
CREATE INDEX IF NOT EXISTS idx_orders_is_group_parent
  ON public.orders (id)
  WHERE is_group_parent = true;
