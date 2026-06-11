-- ============================================================================
-- Storage 버킷 bulletin-images (A7 게시판 에디터 이미지 · 비공개 + authenticated 전용)
-- Date: 2026-06-11
--
-- [목적]
--   - A7 게시판(매뉴얼·공지) 글쓰기(Toast UI Editor) 본문에 삽입할 이미지의
--     업로드 저장소. 본문 HTML은 게시글 content 컬럼에, 이미지 바이너리는
--     이 버킷에 분리 저장. (L2 event-images 와 동일 설계, 게시판 전용으로 분리.)
--
-- [설계 — 비공개 + 서명 URL]
--   - 버킷 bulletin-images : public = false (비공개).
--     · 매뉴얼·내부 운영 이미지이므로 공개 URL 금지. 프론트는 createSignedUrl 로
--       단기 서명 URL을 발급해 에디터/프리뷰에 표시.
--     · event-images(20260608060000) 기조와 동일 — 내부 자료 비노출.
--   - 신규 버킷(event-images 와 별도 분리 — 게시판/학회 자료 저장소 격리).
--
-- [정책 — authenticated 전용, anon 전면 차단]
--   - storage.objects 에 대해 select/insert/delete 를 authenticated 롤에만 부여.
--   - anon 은 정책 부재로 전면 차단(RLS 기본 거부). update 미부여(이미지는 신규 업로드/삭제만).
--   - 멱등: 각 정책 drop policy if exists 선행.
--   - NOTE: storage.objects 의 RLS 는 Supabase 가 이미 활성화한 상태 → enable 불필요.
--           정책 신설만 수행(기존 storage 정책 변경/삭제 없음).
--
-- [RLS — 완화 없음]
--   - public.* 테이블 정책 무변경. storage.objects 에 제약(authenticated 전용)을 추가만 함.
--   - anon 에 어떤 권한도 부여하지 않음.
--
-- [멱등성]
--   - insert ... on conflict (id) do nothing  (버킷 재생성 안전)
--   - update ... where id=...                 (제한 재설정 안전)
--   - drop policy if exists → create policy   (정책 재실행 안전)
--
-- [적용]
--   - CI 미사용. 건우님이 Supabase 대시보드 SQL Editor에 본문 복붙 수동 적용.
--     (Storage > buckets UI 로도 생성 가능하나, 정책 일관성 위해 SQL 권장.)
--
-- [롤백]
--   - drop policy if exists "bulletin_img_select_auth" on storage.objects;
--   - drop policy if exists "bulletin_img_insert_auth" on storage.objects;
--   - drop policy if exists "bulletin_img_delete_auth" on storage.objects;
--   - delete from storage.buckets where id = 'bulletin-images';  -- 버킷 내 객체 선삭제 필요
-- ============================================================================

-- 1) 버킷 (비공개)
insert into storage.buckets (id, name, public)
values ('bulletin-images', 'bulletin-images', false)
on conflict (id) do nothing;

-- 1-1) 서버측 업로드 제한 (5MB / jpeg·png·webp) — 신설 시점부터 강제.
--   클라이언트 검증만으로는 authenticated 계정이 supabase-js 직접 호출로
--   임의 타입·크기 업로드 가능 → 버킷 레벨로 차단. (event-images 는 20260610010000 에서 뒤늦게 추가.)
update storage.buckets
set file_size_limit = 5242880,            -- 5MB
    allowed_mime_types = array['image/jpeg','image/png','image/webp']
where id = 'bulletin-images';

-- 2) 정책 (authenticated 전용 · anon 차단)
drop policy if exists "bulletin_img_select_auth" on storage.objects;
drop policy if exists "bulletin_img_insert_auth" on storage.objects;
drop policy if exists "bulletin_img_delete_auth" on storage.objects;

create policy "bulletin_img_select_auth"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'bulletin-images');

create policy "bulletin_img_insert_auth"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'bulletin-images');

create policy "bulletin_img_delete_auth"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'bulletin-images');
