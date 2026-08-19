-- =====================================================================
-- [초안 / DRAFT — 적용 금지] 온라인코드 추적 컬럼
--   products.includes_online_code  (상품에 온라인코드 포함 여부, 3상태)
--   orders.has_online_code         (주문에 온라인코드 상품 포함 여부, 서버 판정 기록)
-- =====================================================================
-- 상태: 설계 검토용 초안. CTO 검수 + 건우님 승인 전 SQL Editor 실행 금지.
--
-- 배경:
--   기존 온라인코드 감지는 클라이언트 상품명 문자열 판정뿐(OrderPage.jsx).
--   SET 208개(검사) 중 207개가 상품명·옵션명 어디에도 '온라인'이 없어 전량 미감지 →
--   SET 구매 주문에서 orders.inpsyt_id 공란 사고(예 #234·#237 K-Bayley-4 SET).
--   DB에 구성품 정보가 없으므로 사람이 입력하는 3상태 플래그가 유일한 해법.
--
-- ---------------------------------------------------------------------
-- 1) products.includes_online_code — 3상태(반드시 구분)
-- ---------------------------------------------------------------------
--   NULL  = 미확인. 상품 담당자 확인 대기(전수조사 B버킷 165개가 이 상태로 추적됨).
--           "미확인 SET을 추적하는 유일한 수단" → DEFAULT 금지(3상태 붕괴 방지).
--   true  = 온라인코드 포함.
--   false = 온라인코드 확실히 없음(도서·도구 전량, 검사 A버킷 등).
--
--   DEFAULT 없음 이유: 기존 전 상품이 NULL(미확인)로 채워져야 씨딩 스크립트가
--     "무엇을 아직 안 찍었는지"를 NULL 개수로 추적할 수 있다. DEFAULT false 를 주면
--     미확인(NULL)과 확정 미포함(false)이 섞여 B버킷 추적이 불가능해진다.
--
-- ---------------------------------------------------------------------
-- 2) orders.has_online_code — 서버 판정 기록(3상태)
-- ---------------------------------------------------------------------
--   NULL  = 레거시/미평가(본 기능 이전 주문, 또는 구 create-order). 감사 쿼리로 사후 조회.
--   true  = create-order 가 결제 시점에 "온라인코드 상품 포함"으로 판정.
--   false = create-order 가 "미포함"으로 판정.
--
--   판정 정본: create-order (서버). 판정식(합집합) =
--     product.includes_online_code === true  OR  product.name.includes('온라인').
--     클라이언트 문자열 판정을 신뢰하지 않음(가격 서버 재계산과 동일 원칙).
--   DEFAULT 없음 이유: 기존 주문이 false 로 오염되면 "미평가"와 "확정 미포함"이 섞임.
--     레거시는 NULL 로 남기고, 필요 시 backfill 스크립트로 true 만 소급 표시.
--   용도: 어드민 출고 화면 단일 컬럼 필터(.eq('has_online_code', true)).
--     order_items 스냅샷 재조회(join)보다 유리 —
--       (a) FK 완화(20260415_008) 로 product 삭제돼도 값 보존(재조회는 유실 가능),
--       (b) B버킷 SET은 상품명에 '온라인'이 없어 스냅샷 name 재조회로는 절대 안 잡힘 →
--           결제 시점 서버 판정을 박제해 두는 편이 견고,
--       (c) 결제 시점 판정 박제(가격 스냅샷과 동일 사상).
--     연 800건 규모 — 별도 테이블·인덱스 불필요. boolean 1개로 충분(오버엔지니어링 아님).
--
-- ---------------------------------------------------------------------
-- RLS / GRANT (변경 없음 — 근거)
-- ---------------------------------------------------------------------
--   products.includes_online_code:
--     products 는 컬럼 화이트리스트가 아니라 전체 SELECT 방식.
--       정책 "Public can view products" FOR SELECT TO anon, authenticated USING (true)
--       (20251121_apply_rbac_rls.sql:81), 컬럼 GRANT/REVOKE 없음(프론트가 select(*) 사용).
--     → 신규 컬럼을 anon 이 자동 상속해 읽음 = 고객 주문서(anon)가 판정에 사용 가능(요구사항 충족).
--       ※ events 처럼 REVOKE+화이트리스트 GRANT 하는 테이블이 아니므로 GRANT 문 불필요.
--     ※ get_order_by_token 의 row_to_json(p) 로 이 값이 고객 주문조회 JSON 에 노출되나
--       비민감(온라인코드 포함여부는 고객이 이미 아는 정보) — discount_override 와 동일 판단.
--
--   orders.has_online_code:
--     anon 은 orders 직접 SELECT 권한 없음(20260407_rls_token_based_access.sql 로 정책 제거).
--     고객 조회는 get_order_by_token(SECURITY DEFINER)뿐이고 명시 컬럼만 반환(SELECT * 아님)
--       → 신규 컬럼은 고객에게 노출되지 않음(추가 안 함).
--     어드민(authenticated)은 "Admins can view orders" 로 전체 컬럼 SELECT → 자동으로 읽음.
--     → GRANT 변경 불필요. anon 노출 없음.
--
-- 가법·멱등:
--   ADD COLUMN IF NOT EXISTS 2개 → 재실행 안전. 기존 컬럼·데이터·order_items 스냅샷 무영향.
--
-- ---------------------------------------------------------------------
-- [적용 순서] Supabase 대시보드 → SQL Editor → (검수·승인 후) 본 파일 전문 1회.
--   권장 순서: ① 본 마이그레이션 → ② products 씨딩 → ③ create-order 배포.
--   단 이 순서는 "권장"이며 강제 의존이 아니다. create-order 의 orders insert 는
--     has_online_code 컬럼 부재(42703 / PGRST204)를 감지해 그 필드만 빼고 재시도하므로,
--     함수가 마이그레이션보다 먼저 배포돼도 주문 생성은 정상 동작한다(값만 기록되지 않음).
--     Supabase 는 프리뷰가 없어 함수 배포가 곧 운영이고 학회 중 장애는 치명적이라,
--     배포 순서에 의존하지 않는 fail-safe 로 설계했다(메인 Claude 검수 반영).
-- ---------------------------------------------------------------------
--
-- [롤백] (원복 필요 시 — 데이터 손실 주의)
--   ALTER TABLE public.orders   DROP COLUMN IF EXISTS has_online_code;
--   ALTER TABLE public.products DROP COLUMN IF EXISTS includes_online_code;
-- =====================================================================

ALTER TABLE public.products
    ADD COLUMN IF NOT EXISTS includes_online_code boolean;

COMMENT ON COLUMN public.products.includes_online_code IS
  '온라인코드 포함여부(3상태). NULL=미확인(담당자 확인 대기, DEFAULT 금지), true=포함, false=확실히 없음. 사람이 입력. 온라인코드는 검사 전용(도서·도구 전량 false).';

ALTER TABLE public.orders
    ADD COLUMN IF NOT EXISTS has_online_code boolean;

COMMENT ON COLUMN public.orders.has_online_code IS
  '주문에 온라인코드 상품 포함여부(서버 판정 박제). NULL=레거시/미평가, true=포함, false=미포함. 판정식=products.includes_online_code=true OR 상품명 online. 정본=create-order. 어드민 출고 필터용.';

-- =====================================================================
-- 끝. 기존 products·orders 컬럼·데이터 무변경. RLS/GRANT 무변경(근거 위 주석).
--     과거 order_items 스냅샷 무영향.
-- =====================================================================
