-- ============================================================================
-- 보안 강화 3건 (2026-06-10 보안 검토 결과)
-- 적용: Supabase 대시보드 SQL Editor 수동 실행 (멱등)
-- ============================================================================

-- [중1] event-images 버킷 서버측 업로드 제한
--   클라이언트(PrepNoteEditor)만 5MB/타입 검증 중 → authenticated 계정이
--   supabase-js 직접 호출로 임의 타입·크기 업로드 가능했음. 버킷 레벨로 강제.
update storage.buckets
set file_size_limit = 5242880,            -- 5MB
    allowed_mime_types = array['image/jpeg','image/png','image/webp']
where id = 'event-images';

-- [낮1] get_order_by_token search_path 고정 (SECURITY DEFINER 모범규칙)
ALTER FUNCTION public.get_order_by_token(uuid) SET search_path = public;

-- [부채] events INSERT/UPDATE 권한 exact 전환
--   기존 has_permission('edit')는 partial match('%:edit') 때문에 orders:edit만
--   가진 출고 역할(fulfillment_book/test)도 DB 레벨에서 events 편집이 가능했음
--   (화면 게이팅으로만 차단). 'master' OR 'events:edit' exact로 교체.
--   onsite는 20260610000000에서 events:edit를 받으므로 정상 동작, 출고는 차단됨.
DROP POLICY IF EXISTS "Admins can insert events" ON public.events;
CREATE POLICY "Admins can insert events" ON public.events
  FOR INSERT TO authenticated
  WITH CHECK (public.has_permission('master') OR public.has_permission('events:edit'));

DROP POLICY IF EXISTS "Admins can update events" ON public.events;
CREATE POLICY "Admins can update events" ON public.events
  FOR UPDATE TO authenticated
  USING (public.has_permission('master') OR public.has_permission('events:edit'));

-- 비조치 결정(검토 기록):
--   products row_to_json 노출 — 민감 컬럼 없음(원가·마진 부재) + anon이 이미 전 행
--     SELECT 가능이라 RPC만 고쳐도 무의미. 향후 민감 컬럼 추가 시 컬럼 GRANT 필수.
--   get_login_directory email 노출 — signInWithPassword가 email 필요, 구조상 불가피. 수용.
--   event-images 타인 이미지 delete — 내부 소수 팀 공유 자산, 수용.
-- 백로그: 서명 URL TTL 1년 → 만료 시 prep_note 이미지 깨짐. 렌더 시 재서명 리팩터.
