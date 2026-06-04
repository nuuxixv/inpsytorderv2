# 사양 시트 — A9 감사 로그 (AuditLogPage)

> 이 시트는 감사 로그 화면의 정보·기능·데이터 구조의 단일 진실 소스다.
> 시안과 실서비스 구현은 이 시트의 모든 항목을 1:1로 반영해야 한다.
> 임의 단순화·통합·생략은 건우님의 명시적 승인 후 이 시트를 먼저 갱신한 다음에만 허용된다.
> 마지막 갱신: 2026-06-04 신설 (CPO 설계 기반, master 전용 읽기 전용 페이지).

## 참조 파일
- 실 컴포넌트: `inpsyt-order-frontend/src/components/AuditLogPage.jsx`
- API: `inpsyt-order-frontend/src/api/auditLog.js` (`getAuditLogs`, `getAuditActors`, `AUDIT_PAGE_SIZE`)
- 공통 컴포넌트: `inpsyt-order-frontend/src/components/ui/RoleChip.jsx` (A7 역할칩 4종 색 매핑 재사용)
- 라우팅: `inpsyt-order-frontend/src/components/AdminLayout.jsx` (`/audit-log`, master 게이트)
- 사이드바: `inpsyt-order-frontend/src/components/AdminSidebar.jsx` (`permissionKey: 'master'`)
- DB 스키마: `supabase/migrations/` 의 `audit_log` 테이블 (backend 동시 빌드 중 — 적용 후 동작)

## 사용자 시나리오
master 권한자(주로 건우님)가 사고·분쟁·이상 징후가 생겼을 때 "누가·언제·무엇을 바꿨나"를 역추적하는 화면. 학회 직후 점검 또는 다음 학회 직전에 들어온다. 연 800건 규모라 기록량이 크지 않다. 읽기 전용 — 이 화면에서 어떤 것도 수정·삭제하지 않는다.

## 표시 정보 (라벨 단위, 누락 금지)

### 상단 헤더
- [ ] 페이지 제목 아이콘: `HistoryIcon` (primary 색) — PageHeader icon
- [ ] 페이지 제목 텍스트: "감사 로그"
- [ ] 부제: "누가·언제·무엇을 바꿨는지 기록합니다. 읽기 전용입니다."
- [ ] 우측 액션 버튼: **없음** (읽기 전용)

### 필터 영역 (SectionCard)
- [ ] 기간 드롭다운: "최근 7일" / "최근 30일" / "직접 범위" (기본값 최근 30일)
- [ ] 직접 범위 선택 시: "시작일" / "종료일" date input 2개 노출
- [ ] 행위자 드롭다운: "전체" + distinct 행위자 이름 목록 (`getAuditActors`)
- [ ] 대상 검색 입력: placeholder "대상·요약 검색" (`SearchIcon` adornment) — target_id / summary 부분검색
- [ ] 종류 칩 토글 5종: 주문 / 사용자 / 설정 / 학회 / 상품 (각 한글 라벨 + 색, 활성 시 채움)
- [ ] 총 건수: "총 N건" (필터 영역 우측)

### 목록 표
- [ ] 컬럼: (펼침 토글) / 시각 / 행위자 / 종류 / 대상 / 요약
- [ ] 행마다 표시:
  - 펼침 토글: `ArrowRightIcon`(닫힘) / `ArrowDownIcon`(열림)
  - 시각: `format(created_at, 'yyyy.MM.dd')` + 아래 줄 `HH:mm` (tnum)
  - 행위자: `actor_name`(굵게) + `RoleChip role={actor_role}` (A7 4종 매핑 재사용, 그 외 슬러그 outlined fallback)
  - 종류: `KindChip` — target_table → 한글 라벨+색
    - `orders` / `order_items` → "주문" (primary)
    - `user_auth` → "사용자" (warning)
    - `site_settings` → "설정" (info)
    - `events` → "학회" (secondary)
    - `products` → "상품" (success)
    - 그 외 → 테이블명 그대로 outlined fallback
  - 대상: `{target_table 한글명} #{target_id}` (예 "주문 #1234"). target_id 없으면 한글명만
  - 요약: `summary` (없으면 "-")
- [ ] **행 클릭 시 펼침**: `before`(jsonb) / `after`(jsonb)를 `JsonBlock` 2칸으로 펼쳐 표시. null이면 "—". JSON.stringify pretty(들여쓰기 2), monospace, gray.50 박스
- [ ] 빈 상태: `EmptyState` "기록이 없어요" + "선택한 조건에 해당하는 변경 기록이 없습니다." (액션 버튼 없음)

### 페이지네이션
- [ ] 50행/페이지 (`AUDIT_PAGE_SIZE = 50`), `created_at desc`
- [ ] `Pagination` (rounded, primary), totalPages > 1일 때만 노출

## 액션·기능 (누락 금지)
- [ ] 진입 시: master면 `getAuditLogs` + `getAuditActors` 호출. 비-master면 "접근 권한이 없습니다." (페이지 게이트)
- [ ] 기간/행위자/종류/검색 필터 변경 → 1페이지로 복귀 후 재조회
- [ ] 종류 칩 클릭 → 해당 key 토글 (다중 선택 가능, orders 토글은 orders+order_items 두 테이블 묶음)
- [ ] 행 클릭 → before/after 펼침/접힘 (단일 행만 펼침, `expandedId`)
- [ ] 페이지 이동 → 해당 페이지 재조회
- [ ] **수정·삭제·생성 UI 일절 없음 (읽기 전용)**

## 입력 폼 구조
- 입력 폼 없음 (조회 전용). 필터 컨트롤만 존재.

## 권한별 차이
- master: 전체 조회 가능. 사이드바 "감사 로그" 항목 노출, `/admin/audit-log` 진입 가능.
- 그 외(비-master): 사이드바 항목 비노출(`permissionKey: 'master'`), 라우트 진입 시 `/admin`으로 redirect, 페이지 자체도 "접근 권한이 없습니다." 게이트. RLS로 SELECT도 master만.

## 데이터 모델 (DB 또는 API)
- 테이블: `audit_log` (RLS — master만 SELECT)
- 컬럼:
  - `id` — PK
  - `actor_id` (uuid) — 행위자 사용자 id (행위자 필터 키)
  - `actor_name` (text) — 행위자 이름
  - `actor_role` (text) — 행위자 역할 슬러그 (RoleChip 매핑)
  - `action` (text) — 동작 유형 (현재 UI 미표시, summary로 갈음)
  - `target_table` (text) — `orders` | `order_items` | `events` | `products` | `site_settings` | `user_auth`
  - `target_id` (text) — 대상 식별자
  - `before` (jsonb) — 변경 전 스냅샷
  - `after` (jsonb) — 변경 후 스냅샷
  - `summary` (text) — 한 줄 요약
  - `created_at` (timestamptz) — 정렬·기간 필터 기준
- API:
  - `getAuditLogs({ page, startDate, endDate, actorId, tables, search })` → `{ data, count }`. `count: 'exact'` + `range(from, to)` 페이지네이션, `created_at desc`. 검색은 `target_id`/`summary` ilike OR.
  - `getAuditActors()` → 최근 1000건 훑어 distinct `{ id, name, role }` (연 800건 규모라 별도 집계 테이블 불필요)

## 필터·뷰 모드
- 기간: 최근 7일 / 최근 30일(기본) / 직접 범위(시작일·종료일)
- 행위자: 전체 / distinct actor_id
- 종류: 주문·사용자·설정·학회·상품 칩 토글 (다중, OR)
- 대상 검색: target_id/summary 부분검색
- 펼침: 행 단위 before/after jsonb

## 빈 상태·로딩·오류 처리
- 로딩: 목록 자리 중앙 `CircularProgress`
- 빈 상태: `EmptyState` "기록이 없어요"
- 오류: 토스트(`addNotification` error) + 목록 비움 (count 0)
- 권한 없음: "접근 권한이 없습니다." (페이지 게이트, master 아님)

## AI 산출물 시그니처 차단 (CLAUDE.md §E 준수)
- 그라데이션 배경 없음 / 가짜 통계 카드 없음 / 의미 없는 컬러 인디케이터 없음
- raw hex 없음 — theme 팔레트(primary/warning/info/secondary/success) + gray 토큰만 사용
- 종류 칩 색은 A7 역할칩과 토큰을 일부 공유하나 컬럼·맥락이 완전 분리되어 혼동 없음

## 변경 이력
- 2026-06-04: 신설 — CPO 설계 기반 A9 감사 로그 페이지. master 전용 읽기 전용. audit_log 테이블 RLS master SELECT. RoleChip을 `ui/RoleChip.jsx`로 공통 추출(A7와 단일 소스 공유), UserManagementPage 로컬 정의 제거. backend audit_log 마이그레이션 적용 후 동작.
