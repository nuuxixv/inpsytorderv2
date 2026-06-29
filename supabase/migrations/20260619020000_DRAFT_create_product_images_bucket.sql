-- =====================================================================
-- [초안 / DRAFT — 적용 금지] 기능4: product-images Storage 버킷 (상품 이미지)
-- =====================================================================
-- 상태: 설계 검토용 초안. CTO 검수 + 건우님 승인 전 SQL Editor 실행 금지.
--
-- 목적:
--   상품 카드 썸네일/상세 이미지 저장소. 상품은 공개 주문페이지(anon)에서 노출되므로
--   이미지도 공개 읽기(public read)가 필요. 업로드/삭제는 authenticated(어드민)만.
--
-- ※ 기존 event-images 버킷(20260608060000)과 정책 방향이 "다름" — 의도적:
--   - event-images: public=false(비공개) — 학회 내부 자료라 서명URL.
--   - product-images: public=true(공개)  — 상품 카드가 anon에 노출되므로 공개 URL.
--   - 두 버킷은 별개. 기존 event-images 정책 변경/삭제 없음.
--
-- 파일명 매칭(본 설계서 §기능4 — 2안 비교 후 추천안):
--   추천 = [B안] products.image_filename 컬럼(별도 마이그레이션 20260619030000 초안)에
--          저장된 경로로 매칭. 코드 컨벤션(product_code.ext) 강제보다 유연
--          (확장자 혼재·파일명 특수문자·재업로드 대응). 본 버킷은 저장소만 제공.
--   → A안(product_code.ext 컨벤션)을 택하면 image_filename 컬럼 불필요(프론트가 코드로 URL 조립).
--      설계서에서 trade-off 명시. 버킷 정책 자체는 두 안 공통.
--
-- 정책(public read · authenticated write):
--   - SELECT: public(anon+authenticated) — 공개 읽기.
--   - INSERT/UPDATE/DELETE: authenticated 전용(어드민 업로드·교체·삭제).
--   - 멱등: drop policy if exists 선행 + on conflict do nothing.
--   - storage.objects RLS는 Supabase가 이미 활성 → enable 불필요.
--
-- RLS 완화 없음:
--   - public.* 테이블 정책 무변경. storage.objects에 제약 추가만.
--   - 공개 읽기는 "상품 이미지"라는 본디 공개 자산에 한정(버킷 단위 격리).
--
-- 적용:
--   Supabase 대시보드 → SQL Editor → (검수·승인 후) 본 파일 전문 1회 실행. 멱등.
--
-- 롤백:
--   drop policy if exists "product_img_select_public" on storage.objects;
--   drop policy if exists "product_img_insert_auth"  on storage.objects;
--   drop policy if exists "product_img_update_auth"  on storage.objects;
--   drop policy if exists "product_img_delete_auth"  on storage.objects;
--   delete from storage.buckets where id = 'product-images';  -- 객체 선삭제 필요
-- =====================================================================

-- 1) 버킷 (공개)
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;

-- 2) 정책
drop policy if exists "product_img_select_public" on storage.objects;
drop policy if exists "product_img_insert_auth"  on storage.objects;
drop policy if exists "product_img_update_auth"  on storage.objects;
drop policy if exists "product_img_delete_auth"  on storage.objects;

-- 공개 읽기 (anon + authenticated)
create policy "product_img_select_public"
  on storage.objects for select
  to public
  using (bucket_id = 'product-images');

-- 업로드/교체/삭제 — authenticated 전용
create policy "product_img_insert_auth"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'product-images');

create policy "product_img_update_auth"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'product-images');

create policy "product_img_delete_auth"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'product-images');

-- =====================================================================
-- (선택·B안 채택 시 함께 적용) products.image_filename 컬럼:
--   ALTER TABLE public.products ADD COLUMN IF NOT EXISTS image_filename text;
--   COMMENT ON COLUMN public.products.image_filename IS
--     'product-images 버킷 내 객체 경로(예: PITM000577.webp). NULL=이미지 없음(플레이스홀더).';
--   * 엑셀 upsert에 '이미지파일' 컬럼을 매핑하면 운영자가 일괄 지정 가능.
--   * A안(product_code.ext 컨벤션) 채택 시 이 컬럼 불필요.
-- =====================================================================
