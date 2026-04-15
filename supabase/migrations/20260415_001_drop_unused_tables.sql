-- 미사용 테이블 정리
-- kv_store_96e26515, user_roles, roles 테이블은 코드/마이그레이션/프론트엔드 어디에도 참조되지 않음.
-- 실행 전 Supabase 대시보드에서 데이터 유무를 확인할 것.

DROP TABLE IF EXISTS public.kv_store_96e26515 CASCADE;
DROP TABLE IF EXISTS public.user_roles CASCADE;
DROP TABLE IF EXISTS public.roles CASCADE;
