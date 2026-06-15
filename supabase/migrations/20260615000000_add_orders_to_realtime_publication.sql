-- ============================================================================
-- orders 테이블을 Supabase Realtime publication에 추가 (신규 주문 실시간 알림)
-- Date: 2026-06-15
--
-- [목적]
--   - 어드민 헤더의 신규 주문 알림(토스트 + 종 뱃지 + 브라우저 알림)은 AdminLayout이
--     supabase Realtime 채널(postgres_changes, orders INSERT)을 구독해 동작한다.
--   - 그런데 orders 가 supabase_realtime publication 에 등록돼 있지 않아 INSERT 이벤트가
--     전혀 전달되지 않았다(실시간 알림이 처음부터 미동작). → publication 에 orders 추가.
--
-- [확인된 상태(적용 전)]
--   - supabase_realtime publication 존재(pubinsert=true)하나 등록 테이블 0개.
--   - orders.relreplident = 'd'(default) — INSERT 이벤트엔 충분(PK 기준). UPDATE/DELETE
--     컬럼 단위 추적이 필요하면 FULL 로 바꿔야 하나, 본 용도는 INSERT 감지뿐이라 불필요.
--
-- [RLS]
--   - Realtime postgres_changes 는 구독자의 RLS(SELECT) 정책을 따른다. 어드민(authenticated)은
--     orders SELECT 가능(주문관리 화면에서 조회) → 신규 주문 INSERT 이벤트 수신 가능.
--   - anon 등 권한 없는 구독자에겐 전달되지 않음(RLS 그대로) — 보안 완화 없음.
--
-- [적용]
--   - 2026-06-15 운영 긴급 수정으로 Management API(database/query)로 선적용됨.
--     이 파일은 재현/인수인계 기록용. 멱등(이미 등록돼 있으면 skip).
--
-- [롤백]
--   - alter publication supabase_realtime drop table public.orders;
-- ============================================================================

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'orders'
  ) then
    alter publication supabase_realtime add table public.orders;
  end if;
end $$;
