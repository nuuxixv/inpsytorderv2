# 사양 시트 — A8 로그인 (LoginPage)

> 이 시트는 어드민 로그인 화면의 정보·기능·데이터 구조의 단일 진실 소스다.
> 시안과 실서비스 구현은 이 시트의 모든 항목을 1:1로 반영해야 한다.
> 마지막 갱신: 2026-05-28 신설.

## 참조 파일
- 실 컴포넌트: `inpsyt-order-frontend/src/components/LoginPage.jsx` (255줄)
- 인증 컨텍스트: `inpsyt-order-frontend/src/AuthContext.jsx` (로그인 후 세션 발화)
- DB 의존: `user_profiles` 테이블의 `email`/`name`/`role` 컬럼 (마이그레이션 누락 — A7 시트 참조)
- Supabase Auth: `supabase.auth.signInWithPassword({ email, password })`

## 사용자 시나리오
인싸이트 직원이 학회 부스에 도착해 태블릿(또는 데스크탑) 어드민에 로그인한다. 사용자는 자기 이메일을 기억하지 않으므로(이메일은 시스템 내부 자동 생성된 가짜 주소) **역할 → 자기 이름 → PIN 6자리** 순서로 3단계 멀티스텝을 거친다. 학회 첫날 아침 일제히 들어와 한 번 로그인하고, 그 뒤로는 세션을 유지하며 일한다. PIN 6자리 입력이 완료되는 순간 자동 제출되어 1초 안에 어드민으로 들어가는 흐름이 중요하다.

## 표시 정보 (라벨 단위, 누락 금지)

### 컨테이너 (line 95-118)
- [ ] 풀스크린 정렬, `background.default` 배경
- [ ] `Paper` elevation 3, max width 420, p 4, radius 4 (인라인 — 시안에서는 radius 토큰으로 흡수)
- [ ] 모든 단계 공통:
  - 로고 이미지(`/LOGO.svg`, height 40, marginBottom 32, marginTop 8)
  - 동적 헤딩(`Typography component=h1 variant=h6 fontWeight=bold`):
    - 사용자 선택 전: "역할을 선택해주세요"
    - 사용자 선택 후: "{ROLE_LABELS[selectedRole].label} 선택"
    - PIN 단계: "{selectedUser.name} 님, 환영합니다"

### 뒤로가기 버튼 (조건부, line 119-127)
- [ ] `IconButton` 좌상단 absolute, `ArrowBackIcon`, aria-label "뒤로가기"
- [ ] `selectedRole` 또는 `selectedUser`가 있을 때만 표시 (Step 1 진입 전엔 없음)
- [ ] 클릭 시 한 단계만 후퇴 (사용자 → 역할 → 초기) — line 77-86

### 에러 알림 (line 135)
- [ ] `Alert severity="error"` 풀너비, mb 3
- [ ] `error` 메시지가 있을 때만 표시. PIN 불일치 시: "비밀번호(PIN)가 일치하지 않습니다."

### Step 1 — 역할 선택 (line 139-167)
- [ ] 3개 역할 큰 버튼(outlined, large, fullWidth, py 2, flex column):
  - `master` — `ShieldIcon` large + "마스터"
  - `onsite` — `StoreIcon` large + "현장 마케팅"
  - `fulfillment` — `ShippingIcon` large + "출고" (출고는 슬러그 두 종을 합친 가상 키)
- [ ] hover 시 보더·텍스트 primary, 배경 primary.50
- [ ] 비선택 시: 보더 divider, 텍스트 secondary

### Step 2 — 담당자 선택 (line 168-189)
- [ ] `selectedRole`로 필터된 사용자 버튼 목록 (contained, primary, large, py 1.5, fontSize 1.1rem)
- [ ] 각 버튼: `PersonIcon` start + 이름 (`user.name`)
- [ ] 필터링(`usersForRole`, line 88-93):
  - `fulfillment`이면 `role === 'fulfillment' || 'fulfillment_book' || 'fulfillment_test'` 셋 다 포함
  - 그 외는 `role === selectedRole`
- [ ] 빈 상태: `Alert severity="info"` "등록된 담당자가 없습니다."

### Step 3 — PIN 입력 (line 190-249)
- [ ] 안내 줄(text.secondary): `DialpadIcon` + "비밀번호(PIN)를 입력하세요"
- [ ] `TextField` PIN:
  - type=password, name=password, autoFocus
  - placeholder "••••••" (가운데 점 6개 — 시각 안내용)
  - 가운데 정렬, fontSize 1.5rem, letterSpacing 0.5em
  - `inputMode=numeric`, `pattern=[0-9]*`, maxLength 6
  - onChange: 숫자만 추출, 6자리 cap. 6자리 도달 시 100ms 후 자동 submit (line 220-228)
  - helperText: 우측 정렬 "N / 6", 6 도달 시 색 `#10B981`
- [ ] "로그인" 버튼 (contained, large, fullWidth, py 1.5, fontSize 1.1rem):
  - disabled 조건: 로딩 중 OR PIN 길이 != 6
  - 로딩 중: `CircularProgress` 24 inherit color

### 로딩 상태 (line 137)
- [ ] 사용자 프로필 조회 중(`loadingProfiles=true`): 가운데 `CircularProgress` my 4
- [ ] 그 외 단계의 로딩은 PIN 단계의 버튼 안 스피너 + 폼 잠금

## 액션·기능 (누락 금지)

- [ ] 진입 시 `user_profiles` 전체 SELECT (line 34-47):
  - 모든 행을 한 번에 받아 클라이언트 측에서 필터링·라벨링
  - 실패 시 에러 Alert "사용자 목록을 불러오지 못했습니다. 관리자에게 문의하세요."
- [ ] 역할 선택 → `selectedRole` 갱신, Step 2로 진행
- [ ] 담당자 선택 → `selectedUser` 갱신, Step 3로 진행 (autoFocus는 TextField에 적용)
- [ ] PIN 입력:
  - 키 입력마다 숫자만 추출 + 6자리 cap
  - 6자리 도달 시 `setTimeout(() => form.requestSubmit(), 100)` — 자동 제출
- [ ] 로그인 (`handleLogin`, line 50-75):
  - `supabase.auth.signInWithPassword({ email: selectedUser.email, password })`
  - 성공: `navigate('/admin')`
  - 실패: 메시지 분기
    - "Invalid login credentials" 포함 → "비밀번호(PIN)가 일치하지 않습니다."
    - 그 외 → `error.message` 원문
- [ ] 뒤로가기:
  - `selectedUser`가 있으면 사용자만 비움 + password 비움 + error 비움
  - `selectedRole`만 있으면 역할 비움 + error 비움
  - 초기 상태에는 뒤로가기 버튼 자체 표시 안 함

## 입력 폼 구조 (분리/통합 절대 금지)

- [ ] 입력 폼은 단일 — PIN 6자리 password 필드 하나.
- [ ] 이메일은 사용자가 입력하지 않는다. `user_profiles.email`을 자동으로 꺼내 Supabase Auth에 전달.
- [ ] 역할·이름은 입력이 아니라 선택(클릭).

## 권한별 차이

이 페이지는 로그인 전 화면이므로 권한 없음. 단, `user_profiles` 테이블 SELECT가 익명에게 허용되어야 동작한다 — 이는 직원 이름·이메일·역할이 공개되는 셈 (확인 필요·잠재 보안 항목).

## 데이터 모델

### `user_profiles` 테이블 — **마이그레이션 정의 누락 (확인 필요)**
이 페이지는 다음 컬럼을 SELECT한다(`select('*')`):
- `id` (uuid)
- `email` (text) — Supabase Auth 로그인 키
- `name` (text)
- `role` (text)
- (그 외 컬럼이 있다면 select '*'로 함께 받음)

이 테이블의 CREATE TABLE 마이그레이션이 `supabase/migrations/`에 없다 — A7 사양 시트 발견 4와 동일.

### RLS — **확인 필요**
- `user_profiles` 테이블에 익명 SELECT 정책이 있는 것으로 추정. 그렇지 않으면 로그인 화면이 동작하지 않는다.
- 즉, 직원 이름·이메일·역할이 익명에게 노출되는 셈. 보안 모델상 의도된 트레이드오프인지 확인 필요.

### `auth.users` (Supabase 내장)
- `signInWithPassword`는 `email` + `password`만 사용
- 성공 시 세션 생성, `app_metadata`/`user_metadata` 자동 첨부 (AuthContext에서 권한 추출)

## 필터·뷰 모드

- [ ] Step 1: 항상 3개 역할(`master`/`onsite`/`fulfillment`) 노출. `availableRoles` 상수 (line 88)
- [ ] Step 2: `selectedRole`로 사용자 필터링. `fulfillment`은 슬러그 3종 묶음.
- [ ] Step 3: 단일 사용자에 대한 PIN 입력만.

## 빈 상태·로딩·오류 처리

- [ ] 초기 로딩(`loadingProfiles=true`): 가운데 `CircularProgress` my 4
- [ ] 프로필 조회 실패: 에러 Alert(빨강) "사용자 목록을 불러오지 못했습니다. 관리자에게 문의하세요." — 다른 모든 단계 진입 차단
- [ ] 빈 역할 사용자: Step 2에서 info Alert "등록된 담당자가 없습니다."
- [ ] PIN 불일치: Alert error "비밀번호(PIN)가 일치하지 않습니다." (Step 3 상단)
- [ ] 다른 인증 에러: Alert error `error.message` 원문 (예: 네트워크 실패 등)
- [ ] 로그인 중(`loading=true`): 로그인 버튼이 `CircularProgress` 24로 교체

## 핵심 발견 (시안 검수 시 반드시 확인)

1. 멀티스텝 3단계 구조가 핵심 사용성 자산이다. 사용자가 이메일/비밀번호를 입력하지 않고 역할 → 이름 → PIN으로 진행한다. 시안에서 이 흐름을 단일 화면 로그인으로 단순화하면 안 된다. 사용자가 자기 이메일을 모르는 구조이기 때문이다.
2. PIN 6자리 입력 완료 시 자동 제출이 핵심 UX 약속이다(line 220-228의 setTimeout 100ms). 시안에서 명시적 제출 버튼을 누르도록 그리면 학회장 빠른 진입 흐름이 깨진다. 자동 제출 + 버튼 모두 있는 현재 구조가 의도임.
3. 모든 사용자 정보(`user_profiles`)가 로그인 화면에서 익명 SELECT된다. 즉 누구나 `/login` 화면에 들어와 직원 목록을 본다. 부스 환경에서는 의도된 동작(태블릿 옆 사람도 봐도 무방)이지만, 외부 인터넷 공개 어드민에서는 보안 항목. 마이그레이션이 누락된 채로 운영 DB만 RLS 정책을 갖고 있어 정합 확인 필요.
4. `fulfillment` 슬러그가 3종(`fulfillment`, `fulfillment_book`, `fulfillment_test`)으로 묶여 들어간다(line 90-92). 그러나 UserManagement에서는 `fulfillment`(접미사 없음) 슬러그가 시드되어 있지 않다(`role_templates` 시드는 `fulfillment_book`/`fulfillment_test`만). 사용자 추가 화면에서 접미사 없는 `fulfillment`는 만들 수 없으므로 line 90의 `'fulfillment'` 분기는 사실상 사용되지 않는 dead branch — 확인 필요.
5. PIN 단계의 placeholder가 가운데 점 6개("••••••")로 시각적 슬롯 안내다. helperText "N / 6"과 함께 진행 상황을 보여주는데, 부스 환경에서 옆 사람이 보이지 않게 type=password를 유지하는 점이 중요. 시안에서 PIN 슬롯을 6칸 박스로 분리해서 그릴 수도 있지만, 그 경우 입력 자체 보안(쇼울더서핑)을 어떻게 유지할지 결정 필요.
6. 에러 메시지 처리가 영어 메시지 부분 일치(`includes('Invalid login credentials')`)로 되어 있다(line 67). Supabase가 메시지 문구를 바꾸면 fallback "error.message" 원문이 사용자에게 그대로 노출된다. 시안에서는 에러 메시지 정책을 명시(서버 원문 노출 vs 항상 일반화된 한글) 필요.
7. 자동 제출에 100ms `setTimeout`이 박혀 있다. React 18 동시성 모드·`useState` 비동기 업데이트 보장용으로 보이지만, 100ms 동안 사용자가 7번째 키를 누르면 form.requestSubmit이 중복 발화할 가능성 — 확인 필요(잠재 부채).
8. 컨테이너 라운드 4(인라인 단위 — MUI에서 4는 32px). M1 토큰 `radius-md`(10) / `radius-lg` 등과 다르다 — 시안에서는 토큰 라운드로 흡수.

## 변경 이력
- 2026-05-28 신설 — design/m2-admin-rest 브랜치 5종 일괄 사전 정독. user_profiles 익명 SELECT·dead fulfillment 분기·100ms 자동 제출 등 잠재 부채 8건 발견.
- 2026-05-29 M3-9 시안 정합 — LoginPage.jsx 시안 답습(전체 화면 컨테이너, PreviewShell X). 보존: 멀티스텝 3단계·100ms 자동 제출·fulfillment dead branch·에러 한글화·user_profiles 익명 SELECT·PIN type=password. 신규: 토큰화 컨테이너(radii.lg + customShadows.lg + gray.200 border), 스텝 인디케이터(done/active/pending), handlingSubmitRef 중복 발화 방지(§발견 7 부채 흡수), 헤더 부제 "인싸이트 현장주문 어드민", PIN helperText "숫자 6자리 · N/6" 좌/우 분리. 미반영: 시안의 IP 로고 박스(실제 LOGO.svg 유지), 빈 역할 보안 안내 caption(사양 외 시안 전용).
