-- =====================================================================
-- [초안 / DRAFT — 적용 금지] 기능3: 상품 배지 확장형 컬럼
-- =====================================================================
-- 상태: 설계 검토용 초안. CTO 검수 + 건우님 승인 전 SQL Editor 실행 금지.
--
-- 목적:
--   상품 카드에 노출할 "배지"를 운영자가 반자동(명시 지정)으로 부여.
--   기존 is_popular(인기)/is_new(신상품) boolean 자산을 보존하면서,
--   '오티즘 추천' 등 행사성·임시 배지를 추가 확장 가능하게 함.
--
-- 설계 결정(본 설계서 §기능3 참조):
--   - badges text[] 채택(확장형). is_special boolean(빠름) 대비:
--     · 연 1~2회 새 배지 수요(오티즘 등) → boolean은 추가마다 컬럼·코드 변경.
--     · text[]는 운영자가 값만 추가(스키마 무변경). tags 운영 패턴과 동형(학습비용 0).
--   - is_popular/is_new는 "삭제하지 않음". 표시·필터 로직이 이미 광범위 의존
--     (ProductSelectionStep viewMode, fetchProducts, 엑셀 입출력). badges와 공존.
--   - 자동 생성 금지: badges는 운영자 명시 입력(엑셀 '배지' 컬럼 or 관리 UI)으로만 채움.
--   - 마스터 연계(20260625010000_DRAFT_create_badges_master): 이 컬럼의 각 원소(라벨)는
--     badges.name 과 "이름 자연키"로 매칭되어 색·우선순위를 가져옴. FK 미설정(text[]·엑셀 호환).
--     마스터 미등록 라벨은 UI에서 기본색·"미등록" 폴백(데이터 계약).
--
-- 가법·멱등·RLS 무변경:
--   - 컬럼 1개 ADD IF NOT EXISTS. 기존 행은 NULL(=배지 없음)로 안전.
--   - products RLS(Public SELECT / edit·master mutation, 20251121) 상속, 변경 0.
--   - 엑셀 upsert(onConflict: product_code) 계약 불변. payload에 badges 미포함 시
--     기존값 보존(coalesce 아님 — upsert는 미지정 컬럼을 건드리지 않음). [§기능3 영향 분석]
--
-- 적용 위치/순서(자체완결 — 앞 메시지 참조 금지):
--   Supabase 대시보드 → SQL Editor → (검수·승인 후) 본 파일 전문 1회 실행. 멱등.
--
-- 롤백(전체 원복 필요 시 1줄):
--   ALTER TABLE public.products DROP COLUMN IF EXISTS badges;
-- =====================================================================

ALTER TABLE public.products ADD COLUMN IF NOT EXISTS badges text[];

COMMENT ON COLUMN public.products.badges IS
  '운영자 지정 배지 라벨 배열(반자동). 예: {''오티즘 추천''}. is_popular/is_new와 별개의 임의 라벨 확장 슬롯. NULL=배지 없음. 자동 생성 금지(운영자 명시 입력만).';

-- (선택) 배열 필터 성능 — 연 800건·상품 수천 규모라 인덱스 없이도 무방.
-- 필요 시에만 GIN 인덱스(현재는 생략 권장 — 오버엔지니어링 방어):
-- CREATE INDEX IF NOT EXISTS idx_products_badges ON public.products USING gin (badges);

-- =====================================================================
-- 끝. is_popular/is_new/is_recommend/tags 등 기존 컬럼 전부 불변.
-- order_items 스냅샷(product_name/code/category/list_price) 영향 0 — 배지는 카드 표시 전용.
-- =====================================================================
