-- ============================================================================
-- Storage 버킷 event-images (L2 통합 에디터 이미지 · 비공개 + authenticated 전용)
-- Date: 2026-06-08
--
-- [목적]
--   - L2 통합 준비 노트(events.prep_note · Toast UI Editor) 본문에 삽입할 이미지
--     (학회 자료 등)의 업로드 저장소. 본문 HTML은 events.prep_note 에, 이미지 바이너리는
--     이 버킷에 분리 저장.
--
-- [설계 — 비공개 + 서명 URL]
--   - 버킷 event-images : public = false (비공개).
--     · 학회 자료·내부 운영 이미지이므로 공개 URL 금지. 프론트는 createSignedUrl 로
--       단기 서명 URL을 발급해 에디터/프리뷰에 표시.
--     · events 컬럼 anon 차단(20260608020000) 기조와 동일 — 내부 자료·매출 비노출.
--   - 신규 버킷(현재 Storage 사용처 0건 — storage.objects/buckets 정책 마이그레이션 없음).
--
-- [정책 — authenticated 전용, anon 전면 차단]
--   - storage.objects 에 대해 select/insert/delete 를 authenticated 롤에만 부여.
--   - anon 은 정책 부재로 전면 차단(RLS 기본 거부). update 미부여(이미지는 신규 업로드/삭제만).
--   - 멱등: 각 정책 drop policy if exists 선행.
--   - NOTE: storage.objects 의 RLS 는 Supabase 가 이미 활성화한 상태 → enable 불필요.
--           정책 신설만 수행(기존 storage 정책 변경/삭제 없음 — 현재 정책 0건).
--
-- [RLS — 완화 없음]
--   - public.* 테이블 정책 무변경. storage.objects 에 제약(authenticated 전용)을 추가만 함.
--   - anon 에 어떤 권한도 부여하지 않음.
--
-- [멱등성]
--   - insert ... on conflict (id) do nothing  (버킷 재생성 안전)
--   - drop policy if exists → create policy   (정책 재실행 안전)
--
-- [적용]
--   - CI 미사용. 건우님이 Supabase 대시보드 SQL Editor에 본문 복붙 수동 적용.
--     (Storage > buckets UI 로도 생성 가능하나, 정책 일관성 위해 SQL 권장.)
--
-- [롤백]
--   - drop policy if exists "event_img_select_auth" on storage.objects;
--   - drop policy if exists "event_img_insert_auth" on storage.objects;
--   - drop policy if exists "event_img_delete_auth" on storage.objects;
--   - delete from storage.buckets where id = 'event-images';  -- 버킷 내 객체 선삭제 필요
-- ============================================================================

-- 1) 버킷 (비공개)
insert into storage.buckets (id, name, public)
values ('event-images', 'event-images', false)
on conflict (id) do nothing;

-- 2) 정책 (authenticated 전용 · anon 차단)
drop policy if exists "event_img_select_auth" on storage.objects;
drop policy if exists "event_img_insert_auth" on storage.objects;
drop policy if exists "event_img_delete_auth" on storage.objects;

create policy "event_img_select_auth"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'event-images');

create policy "event_img_insert_auth"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'event-images');

create policy "event_img_delete_auth"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'event-images');
