-- ============================================================================
-- 핫픽스: events 테이블 authenticated SELECT GRANT 복구
-- ============================================================================
-- [장애 증상]
--   로그인 어드민(authenticated)이 events 조회 시
--   42501 "permission denied for table events" 발생.
--   (예: L2 학회 상세 getEventBySlug, EventManagementPage 목록 조회 실패)
--
-- [근본 원인]
--   20260608020000_revoke_anon_events_columns.sql 에서 anon 컬럼 화이트리스트를
--   적용하며 `REVOKE SELECT ... FROM anon` 후 anon에만 컬럼 한정 GRANT를 재부여함.
--   이 과정에서 authenticated 롤에 대한 테이블 레벨 SELECT GRANT가 보존되지 않았고,
--   repo 어디에도 authenticated용 명시 GRANT 문이 없어 권한이 소실됨.
--   행 RLS 정책("Public can view events", TO anon/authenticated, USING(true))은 정상이나,
--   컬럼/테이블 GRANT 레이어가 먼저 막혀 RLS 평가 전에 42501이 발생.
--
-- [적용 방법]
--   Supabase 대시보드 → SQL Editor 에 이 파일 전문을 붙여넣고 1회 실행.
--   GRANT/REVOKE는 멱등이므로 재실행해도 안전(권한 상태만 동일하게 수렴).
--   * supabase db push 불필요 — 대시보드 수동 실행 전용.
--
-- [롤백 방법]
--   본 핫픽스로 부여된 authenticated 권한을 되돌리려면:
--     REVOKE SELECT ON public.events FROM authenticated;
--   단, 이 경우 어드민 events 조회가 다시 42501로 막히므로 장애 복구 목적상
--   롤백은 권장하지 않음. anon 권한은 본 파일에서 변경 없음(20260608020000과 동일).
--
-- [영향 범위]
--   - authenticated: events 전 컬럼 SELECT 복구 (어드민 내부필드 읽기 정상화)
--   - anon: 변경 없음. 기존 화이트리스트(20260608020000와 동일) 멱등 재확인만 수행.
--   - INSERT/UPDATE/DELETE GRANT, RLS 정책: 일절 건드리지 않음(SELECT만).
-- ============================================================================

-- 1) 핵심 복구: authenticated 전 컬럼 SELECT (테이블 레벨, 컬럼 한정 아님)
--    어드민은 attendee_ids/note/marketing_cost/event_year/host_society/event_season/
--    status/draft_done/application_done/payment_resolution_done/prep_note/created_by 등
--    내부필드를 읽으므로 전 컬럼 SELECT 필요(src/api/events.js EVENT_DETAIL_COLUMNS).
GRANT SELECT ON public.events TO authenticated;

-- 2) 방어: anon 컬럼 화이트리스트 멱등 재확인.
--    20260608020000_revoke_anon_events_columns.sql 과 동일한 컬럼 목록 — 권한 불변.
--    (1번의 테이블 레벨 GRANT가 anon에 영향을 주지 않으나, 상태 명시를 위해 재선언.)
REVOKE SELECT ON public.events FROM anon;

GRANT SELECT (
  id, name, discount_rate, tags, start_date, end_date,
  estimated_delivery_date, order_url_slug, venue, created_at
) ON public.events TO anon;
-- anon 비노출(화이트리스트 제외): attendee_ids, note, marketing_cost
--   (+ event_year/host_society/event_season/status/draft_done/application_done/
--      payment_resolution_done/prep_note/created_by 등 — anon 미사용이라 공개 안 함)

-- ============================================================================
-- [검증 쿼리] 적용 후 아래를 SQL Editor에서 실행해 복구를 확인하세요.
--   - authenticated: 모든 events 컬럼이 SELECT 로 나와야 함
--   - anon: 위 화이트리스트 10개 컬럼만 SELECT 로 나와야 함(추가/누락 없을 것)
--
-- SELECT grantee, privilege_type, column_name
-- FROM information_schema.role_column_grants
-- WHERE table_name = 'events' AND grantee IN ('anon', 'authenticated')
-- ORDER BY grantee, column_name;
-- ============================================================================
