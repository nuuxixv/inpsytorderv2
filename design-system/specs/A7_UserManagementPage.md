# 사양 시트 — A7 사용자 관리 (UserManagementPage)

> 이 시트는 사용자 관리 화면의 정보·기능·데이터 구조의 단일 진실 소스다.
> 시안과 실서비스 구현은 이 시트의 모든 항목을 1:1로 반영해야 한다.
> 임의 단순화·통합·생략은 건우님의 명시적 승인 후 이 시트를 먼저 갱신한 다음에만 허용된다.
> 마지막 갱신: 2026-05-28 신설 (M2-admin-rest 5종 일괄 사전 정독).

## 참조 파일
- 실 컴포넌트: `inpsyt-order-frontend/src/components/UserManagementPage.jsx` (1037줄)
- 관련 API:
  - `inpsyt-order-frontend/src/api/roleTemplates.js`
  - Edge Functions: `supabase/functions/list-users/index.ts`, `invite-user/index.ts`, `update-user-role/index.ts`, `update-user-memo/index.ts`, `delete-user/index.ts`
- 인증 컨텍스트: `inpsyt-order-frontend/src/AuthContext.jsx` (`hasPermission`, `permissions`, `profile`)
- DB 스키마:
  - `supabase/migrations/20260415_007_create_role_templates_table.sql` (`role_templates`)
  - `user_profiles` 테이블 — 확인 필요. `supabase/migrations/` 내 CREATE TABLE 문이 없다. Edge function · AuthContext · LoginPage가 모두 참조하지만 정의 마이그레이션 누락. 운영 DB에는 존재하는 것으로 가정.
  - `supabase/migrations/20260415_009_fix_has_permission_function.sql` (RLS `has_permission` 함수)

## 사용자 시나리오
인싸이트 직원 중 master 권한자(주로 건우님과 한 명 정도)가 사무실 PC로 연다. 학회 전에 부스 운영 인력(현장 마케팅·출고 담당)을 PIN 6자리로 발급해 주고, 학회 직후 또는 다음 학회 직전에 활동을 점검·정리한다. 학회 중에는 거의 손대지 않는다(freeze 대상). 신규 채용·인턴 교체·임시 외부 파트너 합류 같은 사건이 생길 때만 들어온다. 한 학회 시즌 통틀어 사용 빈도는 매우 낮지만, 권한이 잘못 설정되면 곧바로 사고로 이어지는 화면이다.

## 표시 정보 (라벨 단위, 누락 금지)

### 상단 헤더 (line 484-502)
- [ ] 페이지 제목 아이콘: `PeopleIcon` (primary 색, 1.4rem) — line 486
- [ ] 페이지 제목 텍스트: "사용자 관리" — line 488
- [ ] 탭 그룹 (`Tabs`, `activeTab`): "사용자 목록" / "역할 템플릿" — line 493-496
- [ ] 우측 버튼(조건부, `activeTab === 0`일 때만): "사용자 추가" contained + `PersonAddIcon` — line 498-500

### 탭 0 — 사용자 목록

#### 통계 카드 4장 (line 507-536, 가로 한 줄, 클릭 시 `userFilter` 토글)
- [ ] 카드 1: "전체 사용자" — primary 색 그라데이션, `PeopleIcon`. 본문 숫자: `users.length`. 클릭: `userFilter=null`.
- [ ] 카드 2: "마스터" — warning 색 그라데이션, `AdminIcon`. 본문 숫자: master 슬러그 개수. 클릭: `userFilter='master'` 토글.
- [ ] 카드 3: "현장 마케팅" — info 색 그라데이션, `PeopleIcon`. 본문 숫자: onsite 슬러그 개수. 클릭: `userFilter='onsite'` 토글.
- [ ] 카드 4: "출고" — success 색 그라데이션, `ScheduleIcon`. 본문 숫자: fulfillment_book + fulfillment_test 합. 클릭: `userFilter='fulfillment'` 토글 (두 슬러그 묶음).
- [ ] 카드 활성 표시: 선택 시 `outline: 2px solid primary.main` (statCardSx).

> AI 산출물 시그니처 주의: 현재 그라데이션 배경은 CLAUDE.md "AI 산출물 시그니처" 절에서 차단 대상. 시안에서는 단색·토큰 패턴으로 교체 필요. 활동 7일 이내 사용자(`recentlyActiveCount`)는 계산만 되어 있고 카드로 노출되지 않음.

#### 사용자 표 (line 539-679)
- [ ] 컬럼: 사용자 / 역할 / 메모 / 생성일 / 마지막 로그인 / 액션
- [ ] 행마다 표시:
  - 사용자 셀: `Avatar`(첫 글자, primary 배경) + 이름(`u.name || '이름 없음'`, 굵게). 본인 행이면 옆에 "나" 칩(primary). 이메일은 화면 미노출.
  - 역할 셀: 칩(slug별 매핑)
    - `master` → `ShieldIcon` + "마스터" (warning)
    - `onsite` → "현장 마케팅" (info)
    - `fulfillment_book` → "출고 (도서)" (secondary)
    - `fulfillment_test` → "출고 (검사)" (success)
    - 그 외 슬러그 → 슬러그 문자열 그대로 outlined 칩 ("알 수 없음" fallback)
  - 메모 셀: `u.memo || '-'`, 최대폭 200, ellipsis 한 줄
  - 생성일 셀: `format(created_at, 'yyyy.MM.dd')` + 아래 줄 `HH:mm`
  - 마지막 로그인 셀: `last_sign_in_at` 있으면 동일 포맷, 없으면 "N/A"
  - 액션 셀(가운데): `VpnKeyIcon` 권한 관리(본인 master면 비활성) / `EditIcon` 메모 수정(info) / `DeleteIcon` 사용자 삭제(본인 비활성, error)
- [ ] 빈 상태: `EmptyState` "등록된 사용자가 없습니다" + "새 사용자를 초대하여 시작하세요" + "사용자 초대" 버튼

### 탭 1 — 역할 템플릿 (line 683-874)

#### 헤더 (line 686-702)
- [ ] 제목: "역할 템플릿 관리" (h6, 700)
- [ ] 우측 버튼: "새 역할 추가" contained + `AddIcon`, radius 10
- [ ] 부제: "사용자에게 부여할 역할별 권한을 관리합니다. 시스템 기본 역할은 삭제할 수 없습니다."

#### 권한 매트릭스 표 (line 704-790)
- [ ] 첫 컬럼(sticky left): "역할"
  - 행마다: 템플릿명 + (시스템이면) `LockIcon` "기본" outlined 칩 + 설명(있으면 caption)
- [ ] 11개 권한 컬럼(`PERMISSION_COLUMNS`):
  - `dashboard:view` 대시보드 / `orders:view` 주문 조회 / `orders:edit` 주문 편집
  - `fulfillment:view` 출고 현황 / `events:view` 학회 조회 / `events:edit` 학회 편집
  - `products:view` 상품 조회 / `products:edit` 상품 편집 / `users:manage` 사용자 관리
  - `feedback:view` 피드백 / `bulletins:manage` 게시판 관리
- [ ] 마지막 컬럼 "액션": 비-시스템 템플릿만 편집/삭제 아이콘, 시스템은 "-"
- [ ] 셀: `Checkbox` size small. 마스터 템플릿은 항상 체크·비활성(`isMasterTemplate`). 토글 직후 `updateRoleTemplate` 호출 + 토스트.

### 모달 1 — 새 사용자 추가 (line 877-953)
- [ ] 타이틀: "새 사용자 추가"
- [ ] 필드 분기:
  - `roleTemplates.length > 0`일 때: `Select` "역할 템플릿" — DB 템플릿 목록(시스템이면 " (기본)" 접미사). 선택 시 `permissions` 배열이 outlined 칩 미리보기로 펼쳐짐 (`permissionLabels` 한글 매핑).
  - fallback(`roleTemplates`가 비어 있을 때): `Select` "역할" — `fallbackRoles` 4종(`master`/`onsite`/`fulfillment_book`/`fulfillment_test`) 하드코딩.
- [ ] 필드: "이름" (텍스트, required, placeholder "예: 홍길동")
- [ ] 필드: "PIN (숫자 6자리)" (type=password, 숫자만, maxLength 6, `inputMode=numeric`, helperText "숫자 6자리 고정 (N/6)", 길이 부족하면 error)
- [ ] 액션: "취소" / "생성하기" contained

### 모달 2 — 메모 수정 (line 956-975)
- [ ] 타이틀: "메모 수정"
- [ ] 필드: "메모" (multiline rows=4, placeholder "사용자에 대한 메모를 입력하세요")
- [ ] 액션: "취소" / "저장" contained

### 모달 3 — 사용자 역할 관리 (line 978-1021)
- [ ] 타이틀: "사용자 역할 관리"
- [ ] 본인의 master일 때: warning 박스 + 방패 이모지 + "본인의 Master 권한은 해제할 수 없습니다." (이모지 코드 잔재. 시안에서는 이모지·텍스트 정리 검토 필요)
- [ ] 그 외: `Select` "역할 선택" — `roleTemplates.length > 0` 이면 템플릿 이름 목록, 아니면 `fallbackRoles`
- [ ] 액션: "취소" / "저장" contained (대상이 본인 master이면 비활성)

### 모달 4 — 사용자 삭제 확인 (line 1023-1033)
- [ ] 타이틀: "사용자 삭제"
- [ ] 본문: "정말로 이 사용자를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다." (두 줄)
- [ ] 액션: "취소" / "삭제" error contained

### 모달 5 — 새 역할 추가 / 편집 (line 794-851)
- [ ] 타이틀: 편집이면 "역할 템플릿 편집", 신규면 "새 역할 추가"
- [ ] 필드: "역할 이름" (required, placeholder "예: 외부 파트너")
- [ ] 필드: "설명" (multiline rows=2, placeholder "이 역할의 용도를 설명합니다.")
- [ ] 권한 선택 영역: 11개 권한 `Checkbox` + 라벨 (위 `PERMISSION_COLUMNS` 그대로), flex-wrap 그리드
- [ ] 액션: "취소" / 편집이면 "업데이트", 신규면 "생성하기" (저장 중 `CircularProgress`)

### 모달 6 — 역할 템플릿 삭제 확인 (line 854-872)
- [ ] 타이틀: "역할 템플릿 삭제"
- [ ] 본문: "이 역할 템플릿을 삭제하시겠습니까? 이미 이 역할이 할당된 사용자에게는 영향이 없습니다."
- [ ] 액션: "취소" / "삭제" error contained

## 액션·기능 (누락 금지)

- [ ] 진입 시 `fetchUsers` + `fetchRoleTemplates` (line 154-158, `users:manage` 권한 보유 시)
- [ ] `fetchUsers` → Edge function `list-users` 호출. 401/403이면 토스트 + 강제 `logout()`
- [ ] 사용자 추가 (`handleInviteUser`, line 301-352):
  - 이름·PIN 필수, PIN은 정확히 6자리 숫자
  - 내부 이메일 자동 생성 — `{sanitizedName}_{randomSuffix}@inpsytorder.com` (사용자에게 노출되지 않음)
  - `roleTemplates.length > 0`이면 `roleTemplateId` + `role=tmpl.slug` 전달
  - fallback이면 `role=inviteRole` 전달
  - Edge function `invite-user` 호출. `auth.users` + `user_profiles` upsert
- [ ] 사용자 역할 변경 (`handleRoleChange`, line 274-299):
  - 본인의 master를 다른 역할로 바꾸려 하면 차단(경고 토스트)
  - Edge function `update-user-role`
- [ ] 사용자 메모 수정 (`handleSaveMemo`, line 390-414): Edge function `update-user-memo`
- [ ] 사용자 삭제 (`handleDeleteUser` → 확인 모달 → `handleDeleteUserConfirm`, line 354-382):
  - 본인은 차단
  - Edge function `delete-user` (auth.users 삭제 → user_profiles cascade)
- [ ] 역할 템플릿 권한 토글 (`handleTogglePermission`, line 180-204):
  - 마스터 템플릿은 차단(`isMasterTemplate`)
  - `updateRoleTemplate` 호출 직후 로컬 상태 갱신
- [ ] 역할 템플릿 신규/편집/삭제: 모달 → API 호출 → `fetchRoleTemplates` 재호출
- [ ] 권한 변경 직후의 JWT 갱신 처리 없음 — 사용자가 다시 로그인해야 새 권한이 JWT에 반영됨. UI에서 안내하지 않는다 (확인 필요·잠재 부채).

## 입력 폼 구조 (분리/통합 절대 금지)

- [ ] 사용자 추가 폼: `name`(단일) / `password`(PIN 6자리 단일) / 역할 선택(roleTemplateId 또는 fallback role 슬러그). 이메일은 자동 생성, 입력 폼에 없음.
- [ ] 역할 템플릿 폼: `name`, `description`, `permissions`(배열, 11개 중 부분 집합)
- [ ] 메모 폼: `memo`(단일 multiline)

## 권한별 차이

- master: 모든 기능 — 사용자 CRUD, 역할 변경, 역할 템플릿 신규/편집/삭제. 본인의 master 권한은 해제·삭제 불가(코드·UI 양쪽 차단).
- `users:manage` 권한 보유자: 페이지 진입 가능. Edge function 측에서도 master 또는 `users:manage` 명시 체크(list-users line 50). 그러나 `invite-user`/`update-user-role`/`delete-user`/`update-user-memo`는 Edge function 안에서 `userRole === 'master'`만 통과 — 확인 필요. `users:manage`만 가진 비-master는 페이지는 들어오지만 액션은 모두 403.
- 그 외: 페이지 진입 차단 — "접근 권한이 없습니다." (line 452-458)

## 데이터 모델

### `user_profiles` 테이블 (정의 마이그레이션 누락 — 확인 필요)
운영 DB에 다음 컬럼이 있는 것으로 추정(코드 사용처 기준):
- `id` (uuid, FK → `auth.users.id`)
- `email` (text)
- `name` (text)
- `role` (text) — `role_templates.slug` 또는 fallback 슬러그

### `auth.users` (Supabase 내장)
- `id`, `email`, `created_at`, `last_sign_in_at`
- `user_metadata.name`, `user_metadata.memo`
- `app_metadata.role` (`master` 또는 `operator`)
- `app_metadata.permissions` (배열 — 권한 키 모음, master면 ["master"])

### `role_templates` (`20260415_007_create_role_templates_table.sql`)
- `id` (uuid)
- `slug` (text, unique)
- `name` (text)
- `description` (text, nullable)
- `permissions` (jsonb 배열)
- `is_system` (bool) — true면 삭제 차단(RLS)
- `created_at`, `updated_at`
- 시스템 시드 4개: `master`, `onsite`, `fulfillment_book`, `fulfillment_test`

### RLS 권한 함수
- `has_permission(required_perm)` — JWT `app_metadata.permissions`에서 매칭. master·완전 일치·":접미사" 매칭 모두 통과 (`20260415_009_fix_has_permission_function.sql`)
- 시스템 템플릿 삭제 차단: `AND NOT is_system` (`20260415_007`)

## 필터·뷰 모드

- [ ] 통계 카드 클릭으로 `userFilter` 토글: null / master / onsite / fulfillment(두 슬러그 묶음)
- [ ] 탭: `activeTab=0` 사용자 목록 / `activeTab=1` 역할 템플릿

## 빈 상태·로딩·오류 처리

- [ ] 로딩(`loading=true`): 가운데 `CircularProgress` (line 435-440)
- [ ] 오류(`error` 있음): "오류: {메시지}" + "다시 시도" 버튼 (line 443-449)
- [ ] 권한 없음: "접근 권한이 없습니다." (line 452-458)
- [ ] 빈 사용자 표: `EmptyState` 컴포넌트 + 초대 버튼
- [ ] 역할 템플릿 로딩(`roleTemplatesLoading`): 표 자리 `CircularProgress` size 28
- [ ] `roleTemplates`가 비어 있으면 사용자 추가 폼은 `fallbackRoles`로 다운그레이드(line 911-925) — DB 조회 실패의 자동 회복 경로

## 핵심 발견 (시안 검수 시 반드시 확인)

1. 역할 슬러그와 표시 라벨이 4종에 박혀 있다. `master`/`onsite`/`fulfillment_book`/`fulfillment_test`만 한글 라벨·전용 칩 색을 가지고, 그 외 슬러그는 outlined fallback. 같은 화면의 역할 템플릿 탭에서는 master가 "외부 파트너" 같은 신규 슬러그를 만들 수 있다. 신규 슬러그는 칩에서 fallback으로만 표시되므로 색·아이콘이 따라오지 않는다 — 시안에서 "신규 역할 만들기"를 강조할수록 표 셀의 시각 위계가 깨진다.
2. 본인의 master 권한 보호가 세 자리에 흩어져 있다. (a) 액션 셀의 권한 관리 아이콘 disabled, (b) 삭제 아이콘 disabled, (c) 역할 변경 모달의 warning 박스. 시안에서 이 세 자리를 모두 그리지 않으면 "본인이 자기 master를 끌 수 있는 것처럼" 보이게 된다. 한 자리라도 빠지면 안 된다.
3. 사용자 추가 폼에 이메일 필드가 없다. 내부적으로 `{name}_{random}@inpsytorder.com`이 자동 생성되어 Supabase Auth로 들어간다. 시안에서 이메일 입력 자리를 만들면 안 된다 — 그러나 운영자에게는 "이 사용자의 로그인 ID는?" 질문에 답할 수단이 없는 셈이다.
4. `user_profiles` 테이블의 CREATE TABLE 마이그레이션이 리포지토리에 없다. Edge function 4종·AuthContext·LoginPage 모두 이 테이블을 사용. 운영 DB에는 존재한다고 추정되지만 신규 환경 부트스트랩이 깨지는 잠재 부채.
5. `users:manage` 권한이 비-master에게 부여되어도 실제 API는 모두 master만 통과한다. 페이지·메뉴는 열리지만 실 액션은 모두 403. 역할 템플릿 권한 매트릭스에서 외부 파트너에게 이 권한을 켜 줄 수 있는 모양새인데, 켜더라도 동작하지 않는다.
6. `recentlyActiveCount` 변수는 계산만 되어 있고 UI에 노출되지 않는다(line 461-465). 본래 5번째 카드였을 흔적. 시안에서 살릴지 죽일지 결정 필요.
7. 권한 변경 직후 JWT 갱신 안내가 없다. 사용자 역할을 바꿔도 그 사용자가 다음 로그인까지는 옛 권한으로 살아 있다. 운영자가 "바뀌었는데 왜 그대로지" 혼란을 일으킬 수 있다.

## 변경 이력
- 2026-05-28 신설 — design/m2-admin-rest 브랜치 5종 일괄 사전 정독. UserManagementPage.jsx 전수 + Edge functions 5종 + 권한 마이그레이션 정합 점검.
