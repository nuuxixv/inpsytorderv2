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
-- ★★★ anon 공개 GRANT 필수 (이 마이그레이션의 핵심 — 컬럼 추가만으로 부족) ★★★
--   고객 주문서(OrderPage.jsx:106-110)는 로그인 전 anon 역할로 events를 직접 select함.
--   anon은 events에 대해 "컬럼 화이트리스트 SELECT" 방식(20260608020000 →
--   20260616010000 핫픽스에서 동일 목록 재선언). 화이트리스트에 없는 컬럼을
--   anon이 select하면 RLS 평가 전 단계에서 42501이 발생함.
--   → visible_categories를 주문서 select에 추가하려면 anon 화이트리스트에 반드시 포함.
--   본 마이그레이션은 핫픽스 화이트리스트(10개)에 visible_categories를 더한
--   11개 목록을 멱등 재선언함(REVOKE 후 컬럼 한정 GRANT) — 핫픽스와 한 블록으로 정합.
--
-- 가법·멱등·RLS 무변경:
--   - 컬럼 1개 ADD IF NOT EXISTS, nullable, DEFAULT NULL. 기존 행 안전(NULL=전체노출).
--   - events RLS 정책 상속, 변경 0. events.tags 등 기존 컬럼 전부 불변.
--   - anon GRANT는 화이트리스트에 visible_categories만 추가(가법). 다른 컬럼 권한 불변.
--   - authenticated는 핫픽스에서 테이블 레벨 SELECT 보유 → visible_categories 자동 포함.
--     (별도 GRANT 불필요. 본 파일은 authenticated 권한을 일절 건드리지 않음.)
--   - EventFormDialog upsert(관리 컬럼만 지정)는 미지정 컬럼을 건드리지 않음 →
--     visible_categories 미포함 저장 시 기존값 보존.
--
-- 보안 점검(anon 공개 적정성):
--   - visible_categories = "노출할 대분류 이름 배열"(예: {'도구'}). 운영자가 고객에게
--     보여줄 상품 분류 자체이므로 정의상 공개 정보. 민감정보 아님.
--   - anon 비노출 내부필드(attendee_ids/note/marketing_cost 등)는 본 파일에서도 계속
--     화이트리스트 제외 유지 → anon 비노출 불변. 정보 노출면 확대 = visible_categories 1개뿐.
--
-- 적용 위치/순서(자체완결 — 앞 메시지 참조 금지):
--   Supabase 대시보드 → SQL Editor → (검수·승인 후) 본 파일 전문 1회 실행. 멱등.
--   * 20260616010000 핫픽스가 선행 적용된 상태를 전제(둘 다 멱등이라 순서 무관히 수렴).
--
-- 롤백(전체 원복):
--   ALTER TABLE public.events DROP COLUMN IF EXISTS visible_categories;
--   -- 컬럼을 DROP하면 anon 화이트리스트의 visible_categories GRANT도 자동 소멸하므로
--   -- GRANT 별도 롤백 불필요. anon 다른 컬럼 권한·authenticated 권한은 영향 없음.
-- =====================================================================

ALTER TABLE public.events ADD COLUMN IF NOT EXISTS visible_categories text[];

COMMENT ON COLUMN public.events.visible_categories IS
  '행사 주문서에 노출할 대분류(products.category) 화이트리스트. NULL 또는 빈 배열 = 제한 없음(전체 노출). 값이 있을 때만 해당 대분류 상품만 노출. events.tags(C1 태그필터)와 별개 슬롯. anon 공개 컬럼(노출 대분류는 공개 정보).';

-- ---------------------------------------------------------------------
-- anon 화이트리스트 재선언: 핫픽스(20260616010000) 10개 + visible_categories.
--   REVOKE 후 컬럼 한정 GRANT — GRANT/REVOKE는 멱등이라 재실행 안전(권한 상태 수렴).
--   * 본 컬럼이 아직 없으면 GRANT가 실패하므로, 위 ALTER ... ADD COLUMN 이후에 둠.
-- ---------------------------------------------------------------------
REVOKE SELECT ON public.events FROM anon;

GRANT SELECT (
  id, name, discount_rate, tags, start_date, end_date,
  estimated_delivery_date, order_url_slug, venue, created_at,
  visible_categories
) ON public.events TO anon;
-- anon 비노출(화이트리스트 제외, 핫픽스와 동일 유지):
--   attendee_ids, note, marketing_cost
--   (+ event_year/host_society/event_season/status/draft_done/application_done/
--      payment_resolution_done/prep_note/created_by 등 — anon 미사용이라 공개 안 함)

-- (선택) 배열 필터 성능 — 연 800건·행사 수십 규모라 인덱스 불필요(오버엔지니어링 방어).
-- 필터는 고객 단에서 클라이언트 메모리 처리(ProductSelectionStep)이므로 DB 인덱스 무관.

-- =====================================================================
-- [검증 쿼리] 적용 후 SQL Editor에서 실행해 anon 화이트리스트를 확인하세요.
--   anon: 위 11개 컬럼만 SELECT 로 나와야 함(visible_categories 포함, 그 외 추가/누락 없을 것).
--
-- SELECT grantee, privilege_type, column_name
-- FROM information_schema.role_column_grants
-- WHERE table_name = 'events' AND grantee = 'anon'
-- ORDER BY column_name;
-- =====================================================================
-- 끝. events.tags / status / discount_rate 등 기존 컬럼 전부 불변.
-- authenticated 권한·RLS 정책 무변경. orders·order_items 영향 0.
-- =====================================================================
