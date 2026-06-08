-- 보안: events 신규 내부필드(attendee_ids/note/marketing_cost)가 anon에 노출되는 것 차단.
-- events는 공개 주문페이지(OrderPage) 때문에 anon SELECT 허용이나, RLS가 행 단위라
-- 컬럼 제한이 없어 anon이 임의 컬럼을 PostgREST로 직접 select 가능했음.
-- 행 RLS 정책(Public can view events, USING(true))은 그대로 유지 — 컬럼 GRANT 레이어만 조정.
-- 멱등: REVOKE/GRANT 재실행 안전.

REVOKE SELECT ON public.events FROM anon;

GRANT SELECT (
  id, name, discount_rate, tags, start_date, end_date,
  estimated_delivery_date, order_url_slug, venue, created_at
) ON public.events TO anon;

-- 비노출(화이트리스트 제외): attendee_ids, note, marketing_cost
--   (+ event_year/host_society/event_season/status — anon 미사용이라 공개 안 함)
-- 신규 events 컬럼 추가 시: 공개가 필요하면 위 GRANT에 한 줄 추가.
--   누락해도 방향이 안전(신규 컬럼 자동 비노출 → 누출 아님, 최악도 화면 깨짐).
