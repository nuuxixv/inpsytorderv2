-- =====================================================================
-- [초안 / DRAFT — 적용 금지] 행사별 노출 대분류 화이트리스트 컬럼
-- =====================================================================
-- 상태: 설계 검토용 초안. CTO 검수 + 건우님 승인 전 SQL Editor 실행 금지.
--
-- 목적:
--   행사(주문서)별로 고객에게 "노출할 대분류(category)"를 운영자가 지정.
--   예) 오티즘 행사 → {'도구'}만 노출 / 일반 학회 → {'검사','도서'} 노출.
--   고객 주문서(ProductSelectionStep)가 이 값으로 상품 목록을 1차 필터.
--
-- ★★★ 핵심 의미 규칙 (반드시 코드·운영 모두 동일 해석) ★★★
--   visible_categories IS NULL  → "제한 없음 = 전체 노출"
--   visible_categories = '{}'    → "제한 없음 = 전체 노출" (빈 배열도 동일 취급)
--   visible_categories = {...}   → 배열에 담긴 대분류에 속한 상품만 노출
--   → 기존 운영 행사는 전부 NULL 이므로, 본 컬럼 추가만으로는 노출 동작이
--     전혀 바뀌지 않음(전체 노출 유지). 값이 채워진 행사부터만 필터 발동.
--
-- 설계 결정(CTO 위임 지시서 §확정 사항):
--   - 신규 전용 컬럼 채택. events.tags 겸용 기각 — tags는 C1 주문서 태그필터
--     (eventTags ∩ products.tags)에 이미 쓰여 의미 충돌. 분리해 부작용 0.
--   - 값 = products.category 와 동일 도메인의 "대분류" 이름 배열.
--     (참고: 고객 화면은 '도구' → '검사'로 정규화 표시. 화이트리스트에는
--      운영자가 실제 분류 의도대로 '검사'/'도서'/'도구' 등을 그대로 저장.)
--
-- 가법·멱등·RLS 무변경:
--   - 컬럼 1개 ADD IF NOT EXISTS, nullable, DEFAULT NULL. 기존 행 안전(NULL=전체노출).
--   - events RLS 정책 상속, 변경 0. events.tags 등 기존 컬럼 전부 불변.
--   - EventFormDialog upsert(관리 컬럼만 지정)는 미지정 컬럼을 건드리지 않음 →
--     visible_categories 미포함 저장 시 기존값 보존.
--
-- 적용 위치/순서(자체완결 — 앞 메시지 참조 금지):
--   Supabase 대시보드 → SQL Editor → (검수·승인 후) 본 파일 전문 1회 실행. 멱등.
--
-- 롤백(전체 원복 필요 시 1줄):
--   ALTER TABLE public.events DROP COLUMN IF EXISTS visible_categories;
-- =====================================================================

ALTER TABLE public.events ADD COLUMN IF NOT EXISTS visible_categories text[];

COMMENT ON COLUMN public.events.visible_categories IS
  '행사 주문서에 노출할 대분류(products.category) 화이트리스트. NULL 또는 빈 배열 = 제한 없음(전체 노출). 값이 있을 때만 해당 대분류 상품만 노출. events.tags(C1 태그필터)와 별개 슬롯.';

-- (선택) 배열 필터 성능 — 연 800건·행사 수십 규모라 인덱스 불필요(오버엔지니어링 방어).
-- 필터는 고객 단에서 클라이언트 메모리 처리(ProductSelectionStep)이므로 DB 인덱스 무관.

-- =====================================================================
-- 끝. events.tags / status / discount_rate 등 기존 컬럼 전부 불변.
-- orders·order_items 영향 0 — 본 컬럼은 고객 상품목록 표시 필터 전용.
-- =====================================================================
