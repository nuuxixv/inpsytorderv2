-- ============================================================================
-- onsite(현장 마케팅) 학회 편집 권한 부여 + 생성자 기반 삭제 정책
-- Date: 2026-06-10 (건우님 확정 정책)
--
-- [확정 정책]
--   1. onsite도 학회/행사 편집 가능 → role 템플릿에 'events:edit' 추가
--   2. 삭제: master는 전체, onsite(events:edit)는 본인이 생성한 학회만
--   3. 게시판 권한은 부여하지 않음 (취소됨)
--
-- [설계]
--   A. events.created_by uuid DEFAULT auth.uid()
--      - 기존 행은 NULL = 생성자 불명 → 비-master 삭제 불가 (의도된 동작)
--      - events INSERT는 어드민 프론트의 authenticated 직접 insert
--        (EventManagementPage.jsx) → auth.uid()가 정상으로 채워짐.
--      - FK 미설정: 삭제된 사용자의 잔존 uuid는 어떤 auth.uid()와도 매칭되지
--        않아 무해. 연 800건 규모 — delete-user 흐름에 제약 추가하지 않음.
--      - anon 노출 없음: 20260608020000이 컬럼 화이트리스트 GRANT 방식이라
--        신규 컬럼은 자동 비노출. 본 마이그레이션은 GRANT를 추가하지 않음.
--   B. DELETE 정책 교체
--      기존  "Admins can delete events"            : has_permission('master')
--      신규  "Master or creator can delete events" : master 전체
--                                                  + events:edit 보유자의 본인 생성 행
--      - has_permission('events:edit')는 exact match만 통과
--        (20260415_009의 partial match는 '%:' || 'events:edit' 패턴이라 매칭 없음)
--        → orders:edit만 가진 출고 역할은 삭제 불가.
--      - INSERT/UPDATE 정책은 무변경 (has_permission('edit') 그대로).
--   C. role_templates.onsite.permissions에 'events:edit' 추가 (신규 초대자용)
--   D. 기존 onsite 사용자의 auth.users.raw_app_meta_data.permissions에도 추가
--      - has_permission()은 JWT claims(app_metadata.permissions)를 읽고,
--        프론트 hasPermission()도 session.user.app_metadata.permissions 기반.
--        role_templates는 초대 시점에만 복사되는 템플릿이라(invite-user)
--        템플릿 갱신만으로는 기존 사용자에게 반영되지 않음.
--      - 반영 시점: 다음 토큰 refresh(액세스 토큰 만료 주기, 기본 1시간 이내)
--        또는 로그아웃 후 재로그인 시 즉시.
--
-- [멱등성] ADD COLUMN IF NOT EXISTS / DROP POLICY IF EXISTS / 조건부 UPDATE.
--          재실행 안전 (permissions ? 'events:edit' 검사로 중복 추가 방지).
--
-- [롤백]
--   UPDATE public.role_templates
--     SET permissions = permissions - 'events:edit' WHERE slug = 'onsite';
--   UPDATE auth.users u
--     SET raw_app_meta_data = jsonb_set(u.raw_app_meta_data, '{permissions}',
--           (u.raw_app_meta_data -> 'permissions') - 'events:edit')
--     FROM public.user_profiles p
--     WHERE p.id = u.id AND p.role = 'onsite';
--   DROP POLICY IF EXISTS "Master or creator can delete events" ON public.events;
--   CREATE POLICY "Admins can delete events" ON public.events
--     FOR DELETE TO authenticated USING (public.has_permission('master'));
--   -- created_by 컬럼은 남겨도 무해 (원복 원하면 DROP COLUMN created_by)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- A. 생성자 추적 컬럼
-- ----------------------------------------------------------------------------
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS created_by uuid DEFAULT auth.uid();

COMMENT ON COLUMN public.events.created_by IS
  '행 생성자(auth.users.id). DEFAULT auth.uid(). 마이그레이션 이전 행은 NULL(생성자 불명 → master만 삭제 가능). DELETE RLS의 본인-생성 판정에 사용. anon 컬럼 화이트리스트(20260608020000) 미포함 = anon 비노출.';

-- ----------------------------------------------------------------------------
-- B. DELETE 정책 교체 — master 전체 OR (events:edit AND 본인 생성)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Admins can delete events" ON public.events;
DROP POLICY IF EXISTS "Master or creator can delete events" ON public.events;

CREATE POLICY "Master or creator can delete events"
  ON public.events
  FOR DELETE
  TO authenticated
  USING (
    public.has_permission('master')
    OR (public.has_permission('events:edit') AND created_by = auth.uid())
  );

-- ----------------------------------------------------------------------------
-- C. onsite 역할 템플릿에 events:edit 추가 (이후 초대되는 onsite에 자동 적용)
-- ----------------------------------------------------------------------------
UPDATE public.role_templates
SET permissions = permissions || '["events:edit"]'::jsonb,
    updated_at = now()
WHERE slug = 'onsite'
  AND NOT (permissions ? 'events:edit');

-- ----------------------------------------------------------------------------
-- D. 기존 onsite 사용자 JWT 메타데이터 반영
--    (user_profiles.role = 'onsite' 가 역할의 진실 소스 — invite-user가 slug 저장)
-- ----------------------------------------------------------------------------
UPDATE auth.users u
SET raw_app_meta_data = jsonb_set(
      coalesce(u.raw_app_meta_data, '{}'::jsonb),
      '{permissions}',
      coalesce(u.raw_app_meta_data -> 'permissions', '[]'::jsonb)
        || '["events:edit"]'::jsonb
    )
FROM public.user_profiles p
WHERE p.id = u.id
  AND p.role = 'onsite'
  AND NOT (coalesce(u.raw_app_meta_data -> 'permissions', '[]'::jsonb) ? 'events:edit');
