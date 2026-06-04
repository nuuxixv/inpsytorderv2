-- Migration: Add active_event_slug to site_settings (repo↔DB 정합성)
-- Date: 2026-06-05
--
-- 배경:
--   active_event_slug는 site_settings(단일 행, id=1) 테이블의 컬럼.
--   /go 단축링크가 GoRedirect.jsx에서 이 값을 읽어 활성 학회 주문 페이지로
--   리다이렉트하고(/order?events=<slug>), SettingsPage.jsx에서 설정한다.
--   값은 events.order_url_slug와 매칭되는 text 슬러그.
--
--   프로덕션 DB에는 이 컬럼이 대시보드에서 수동 추가되어 이미 존재하나,
--   repo에 컬럼 생성 마이그레이션이 없어 repo↔DB가 불일치한다(환경 재구축 시 누락 위험).
--   본 마이그레이션은 그 정합성을 맞추는 목적이며, 멱등이라 프로덕션에서는 no-op이다.
--
-- 타입/제약: text, nullable (SettingsPage가 미선택 시 null로 저장 → /go는 "활성 학회 없음" 처리).
-- 단일 행 구조: site_settings는 CHECK(id = 1)로 단 1행만 존재. 별도 인덱스/제약 불필요.
-- RLS: 컬럼 추가는 기존 정책(Public SELECT, master UPDATE)을 그대로 상속 — 변경 없음.

ALTER TABLE public.site_settings
    ADD COLUMN IF NOT EXISTS active_event_slug text;

-- 롤백 (필요 시 수동 실행 — 데이터 손실 주의):
-- ALTER TABLE public.site_settings DROP COLUMN IF EXISTS active_event_slug;
