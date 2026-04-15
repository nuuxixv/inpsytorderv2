-- has_permission 함수 수정: 프론트엔드의 세분화된 권한(orders:view 등)과
-- DB RLS의 단순 권한(view, edit)을 모두 매칭할 수 있도록 개선
--
-- 기존 문제: RLS에서 has_permission('view')를 호출하는데,
-- JWT에는 'orders:view' 형태로 저장됨 → 매칭 실패 → master 외 전원 차단
--
-- 해결: 'view'를 요청하면 JWT에서 ':view'로 끝나는 모든 권한을 체크

CREATE OR REPLACE FUNCTION public.has_permission(required_perm text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT (
    -- Master has all permissions
    (get_current_user_permissions() ? 'master') OR
    -- Exact match (e.g., 'orders:view' = 'orders:view')
    (get_current_user_permissions() ? required_perm) OR
    -- Partial match: 'view' matches any 'xxx:view' in permissions
    (EXISTS (
      SELECT 1 FROM jsonb_array_elements_text(get_current_user_permissions()) AS perm
      WHERE perm LIKE '%:' || required_perm
    ))
  );
$$;
