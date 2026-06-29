-- =====================================================================
-- [초안 / DRAFT — 적용 금지] 기능4(B안): products.image_filename (상품 이미지 경로)
-- =====================================================================
-- 상태: 설계 검토용 초안. CTO 검수 + 건우님 승인 전 SQL Editor 실행 금지.
--
-- 목적:
--   product-images 버킷(20260619020000_DRAFT) 내 객체 경로를 상품 행에 저장.
--   상품 카드 썸네일·상세 이미지 렌더링용. NULL = 이미지 없음(플레이스홀더).
--
-- 파일명 매칭 — [B안] image_filename 컬럼 방식 채택 근거(설계서 §기능4):
--   - A안(product_code.ext 컨벤션, 컬럼 없음): 프론트가 product_code로 URL 조립.
--     단점 = 확장자 혼재(.webp/.jpg/.png) 강제 불가, 특수문자 코드, 재업로드 캐시 무효화
--     수단 부재. 운영자가 정확한 파일명을 코드와 맞춰야 해 실패가 조용함.
--   - B안(본 컬럼): 운영자가 실제 업로드한 객체 경로를 명시 저장 → 확장자·파일명 자유.
--     엑셀 업로드의 '이미지파일' 컬럼을 매핑하면 일괄 지정 가능. 권장.
--
-- 가법·멱등·RLS 무변경:
--   - 컬럼 1개 ADD IF NOT EXISTS, nullable, DEFAULT 없음 → 기존 전 행 NULL 안전.
--   - products RLS·GRANT 무변경. products select는 프론트가 'select(*)' 사용
--     (api/products.js:12) → 신규 컬럼 자동 포함, 별도 select 수정 불필요.
--
-- [영향 분석 — 엑셀 업로드(upload-products-excel)]
--   - upload-products-excel 은 productsData 배열을 onConflict:'product_code' 로 upsert.
--   - Postgres upsert(INSERT ... ON CONFLICT DO UPDATE)는 payload에 포함된 컬럼만 갱신.
--     → 엑셀 payload에 image_filename 키가 "없으면" 기존 값 보존(덮어쓰기 X). 안전.
--     → 엑셀에 '이미지파일' 컬럼을 추가·매핑하면 그때만 갱신. (프론트 파서 작업, 2차)
--   - 즉 본 컬럼 추가만으로는 기존 엑셀 업로드 동작 무변경. 운영자가 이미지를 비우려면
--     명시적으로 빈 값 매핑 필요(의도된 동작).
--
-- 적용:
--   Supabase 대시보드 → SQL Editor → (검수·승인 후) 본 파일 전문 1회 실행. 멱등.
--   ※ 버킷(20260619020000_DRAFT)과 함께 적용 권장(컬럼만 있고 저장소 없으면 무의미).
--
-- 롤백(전체 원복 1줄):
--   ALTER TABLE public.products DROP COLUMN IF EXISTS image_filename;
-- =====================================================================

ALTER TABLE public.products ADD COLUMN IF NOT EXISTS image_filename text;

COMMENT ON COLUMN public.products.image_filename IS
  'product-images 버킷 내 객체 경로(예: PITM000577.webp). NULL=이미지 없음(플레이스홀더). 엑셀 업로드 미포함 시 보존.';

-- =====================================================================
-- 끝. products 기존 컬럼·FK·RLS 전부 불변. nullable 컬럼 1개만 추가.
-- =====================================================================
