# 사양 시트 — A7 피드백 관리 (FeedbackManagementPage)

> 이 시트는 피드백 관리 화면의 정보·기능·데이터 구조의 단일 진실 소스다.
> 시안과 실서비스 구현은 이 시트의 모든 항목을 1:1로 반영해야 한다.
> 마지막 갱신: 2026-05-28 신설.

## 참조 파일
- 실 컴포넌트: `inpsyt-order-frontend/src/components/FeedbackManagementPage.jsx` (314줄)
- 관련 API: `inpsyt-order-frontend/src/api/feedback.js` (`getFeedback`, `updateFeedbackStatus`)
- 보조 컴포넌트: `EmptyState`, `TableSkeleton`
- DB 스키마: `supabase/migrations/20260415_005_create_feedback_table.sql`
- 피드백 제출은 별도 위젯·페이지에서 들어옴(본 시트 범위 밖)

## 사용자 시나리오
master 권한자가 학회 직후 또는 한가한 시간에 들어와 학회장에서 들어온 피드백(버그·UX 개선·제안)을 트리아지한다. 부스 운영자가 모바일에서 위젯으로 보낸 메시지가 여기 쌓이고, master는 상태를 "작업예정/작업중/작업완료/보류/접수취소"로 분류하면서 관리자 메모를 남긴다. 한 학회 시즌 통틀어 수십 건 단위. 학회 중에는 거의 손대지 않는다.

## 표시 정보 (라벨 단위, 누락 금지)

### 상단 헤더 (line 114-119)
- [ ] 페이지 제목 아이콘: `RateReviewIcon` (primary 색, 1.6rem) — line 115
- [ ] 페이지 제목 텍스트: "피드백 관리" (h6, 700) — line 116

### 유형 필터 칩 (line 122-140)
- [ ] "전체 유형" 칩 — 선택 시 secondary filled, 비선택 default outlined, radius 10
- [ ] 유형 칩 3종(`TYPE_LABELS`):
  - "버그" (`bug`)
  - "UX 개선" (`ux`)
  - "제안" (`suggestion`)
- [ ] 선택 시 글자 굵게(700), 비선택 400

### 상태 필터 칩 (line 143-161)
- [ ] "전체" 칩 — 선택 시 primary filled
- [ ] 상태 칩 6종(`STATUS_LABELS` + `STATUS_COLORS` 매핑):
  - "접수" (`received`, default)
  - "작업예정" (`acknowledged`, info)
  - "작업중" (`in_progress`, primary)
  - "작업완료" (`completed`, success)
  - "보류" (`deferred`, warning)
  - "접수취소" (`cancelled`, error)
- [ ] 선택 시 해당 색 filled, 비선택 default outlined
- [ ] **상태·유형·검색 모두 클라이언트 필터** (2026-06-01 건우님). `getFeedback({})`로 전체 1회 로드 후 클라이언트에서 거름 → **StatCard 카운트가 항상 전체 기준으로 정확**(상태 필터 켜도 다른 상태가 0으로 안 보임). 과거 서버측 status 필터 폐기

### 피드백 표 (line 164-216)
- [ ] 컬럼: 생성일 / 제출자 / 위치 / 유형 / 내용 / 상태
- [ ] 컨테이너: `Card` radius 3, 그림자 미세
- [ ] 행은 클릭 → 상세 모달 오픈, hover 표시
- [ ] 행마다:
  - 생성일: `format(created_at, 'yyyy-MM-dd HH:mm')` (locale ko), nowrap
  - 제출자: `fb._userName || fb.user_name || fb.user_email || '-'` (3단계 fallback)
  - 위치: `fb.location || '-'`
  - 유형: outlined 칩 (TYPE_LABELS 라벨)
  - 내용: `truncate(content, 50)` — 50자 초과 시 "..."
  - 상태: 색 칩 (STATUS_COLORS 매핑)
- [ ] 빈 상태: `EmptyState message="피드백이 없습니다."`
- [ ] 로딩: `TableSkeleton columns=6 rows=5`

### 피드백 상세 모달 (line 219-309)
- [ ] 타이틀: "피드백 상세"
- [ ] 표시 영역(`InfoRow` 패턴 4개, line 224-257):
  - "제출자" 라벨(minWidth 60) + 값(`_userName || user_name || user_email || '-'`)
  - "위치" 라벨 + 값(`location || '-'`)
  - "유형" 라벨 + outlined 칩
  - "생성일" 라벨 + `yyyy-MM-dd HH:mm:ss`
- [ ] 필드: "내용" (`TextField` multiline rows=4, fullWidth, **readOnly**) — 제출 내용 자체는 수정 불가
- [ ] 필드: "상태" (`Select` size small)
  - 옵션 6종(`ALL_STATUSES` 그대로): received / acknowledged / in_progress / completed / deferred / cancelled
- [ ] 필드: "관리자 메모" (multiline rows=3, placeholder "내부 메모를 남겨주세요.")
- [ ] 액션: "취소" / "저장" contained (저장 중 `CircularProgress` 14)

## 액션·기능 (누락 금지)

- [ ] 진입 + 필터 변경 시 `fetchData` 호출(line 71-73, 의존성 `statusFilter`):
  - `getFeedback({status})` 호출 (status 필터가 있을 때만 서버에 전달)
  - `user_id`로 `user_profiles.name`을 매핑해 `_userName` 부여(API 측에서 처리)
- [ ] 유형 필터 변경 → `typeFilter` → `useMemo`로 클라이언트 필터링 (line 102-105)
- [ ] 행 클릭 → `handleRowClick(fb)` → 모달 오픈, `editStatus`/`editAdminNote` 초기값으로 현재 값 설정
- [ ] 저장 (`handleSave`, line 82-95):
  - `updateFeedbackStatus(id, status, adminNote)` API 호출
  - 성공 시 모달 닫고 `fetchData` 재호출
- [ ] 모달 닫기: `selectedFeedback=null`, 상태 초기화

## 입력 폼 구조 (분리/통합 절대 금지)

- [ ] 상세 모달 편집 폼:
  - `status` (단일 select, 6종 중 1)
  - `admin_note` (단일 multiline)
- [ ] 제출 내용(`content`)은 read-only — 수정 불가. 시안에서도 편집 가능한 형태로 그리면 안 됨.

## 권한별 차이

- master: 페이지 진입 / 조회 / 상태 변경 / 관리자 메모 작성. RLS도 master만 SELECT/UPDATE 허용 (`20260415_005_create_feedback_table.sql`).
- 일반 사용자(authenticated): INSERT만 가능(피드백 제출). 조회·수정 불가.
- 비로그인: 전부 차단.
- `feedback:view` 권한: UserManagementPage 권한 매트릭스에는 존재하지만 본 페이지 코드는 권한 체크를 하지 않는다(line 42 이하 어디에도 `hasPermission` 호출 없음). 라우팅 가드가 어디서 거르는지는 본 시트 범위 밖이지만, 코드 측에 명시적 분기가 없는 점은 부채. — 확인 필요.

## 데이터 모델

### `feedback` 테이블 (`20260415_005_create_feedback_table.sql`)
- `id` (uuid, default gen_random_uuid)
- `user_id` (uuid, FK → auth.users)
- `user_email` (text) — 제출 시 스냅샷
- `user_name` (text) — 후속 마이그레이션에서 추가된 컬럼 (`ALTER TABLE ... ADD COLUMN IF NOT EXISTS user_name TEXT`)
- `location` (text) — 피드백 제출 시 들어 있던 페이지 URL/이름 (제출 위젯 측 책임)
- `type` (text, NOT NULL) — `bug`/`ux`/`suggestion` 3종 사용. DB CHECK 제약 없음.
- `content` (text, NOT NULL)
- `status` (text, NOT NULL, default 'received') — 6종 사용. DB CHECK 제약 없음.
- `admin_note` (text, nullable)
- `created_at`, `updated_at` (timestamptz)

### RLS
- 인증된 누구나 INSERT 가능 (피드백 제출은 비제한).
- master만 SELECT/UPDATE 가능.
- DELETE 정책 없음 — 삭제는 RLS에서 차단됨(정책 없으면 모두 차단이 RLS 기본).

## 필터·뷰 모드

- [ ] 상태 필터(`statusFilter`): null(전체) / received / acknowledged / in_progress / completed / deferred / cancelled. **클라이언트 필터**(전체 로드 후).
- [ ] 유형 필터(`typeFilter`): null(전체) / bug / ux / suggestion. 클라이언트측 필터.
- [ ] 두 필터는 AND로 합성.
- [ ] 정렬: `created_at` desc (API 기본).

## 빈 상태·로딩·오류 처리

- [ ] 로딩(`loading=true`): `TableSkeleton columns=6 rows=5` (TableSkeleton 컴포넌트 의존 — 본 시트 범위 밖)
- [ ] 빈 필터 결과: `EmptyState message="피드백이 없습니다."`
- [ ] 조회 실패: 토스트 "피드백 조회 실패: {error.message}"
- [ ] 저장 실패: 토스트 "업데이트 실패: {error.message}"
- [ ] 저장 중: 버튼 비활성화 + `CircularProgress`

## 핵심 발견 (시안 검수 시 반드시 확인)

1. 상태 6종이 색·라벨·정렬 모두 코드 상단 상수(`STATUS_LABELS`/`STATUS_COLORS`/`ALL_STATUSES`)에 박혀 있다. DB에 CHECK 제약이 없어 신규 상태 추가가 가능한 구조이지만, 추가 시 코드 3곳을 동시에 손대야 정합이 깨지지 않는다. 시안에서 상태를 줄이거나 늘리는 안을 검토할 때 이 결합 지점을 인지해야 한다.
2. 제출 내용(`content`)은 모달에서 readOnly로 보여진다. 시안에서 이것을 편집 가능한 폼처럼 보이게 그리면 안 된다. 운영자가 원본을 수정할 수 있다는 인상을 주면 신뢰 문제로 이어진다.
3. 권한 체크가 페이지 안에 없다. 라우팅 가드가 어디서 거르는지(아마 `App.jsx`의 `ProtectedRoute` 또는 사이드바 메뉴 필터)는 본 시트 범위 밖이지만, 코드 본문에 `hasPermission('feedback:view')` 같은 명시 호출이 없다. RLS가 master만 SELECT를 허용하므로 실제로는 master 외에는 빈 화면이 보일 가능성이 있다 — 시안 작업 시 권한별 보이는 모습 확인 필요.
4. 제출자 식별이 3단계 fallback(`_userName || user_name || user_email || '-'`)으로 풀려 있다. 이메일이 표시되는 경로가 살아 있어, 이메일 컬럼 제거 정책(C1·OrderPage의 `20260408_drop_email_column.sql`과 정합 — 단, 그건 `orders.email`이고 여기는 `feedback.user_email`로 별개 컬럼)과 의도적으로 분리돼 있다. 시안에서 제출자 표시 형식을 명시(이름 우선 → 이메일 → "-")해야 모호함이 줄어든다.
5. 피드백 위젯·제출 화면 사양 시트가 없다. 본 페이지는 "관리만" 한다. 제출 측 데이터 모양(어떤 필드를 보내는지, 어떻게 user_name·location을 채우는지)이 명확하지 않은 채로 본 화면을 시안 작업하면 정합이 깨질 수 있다. 제출 화면 사양 시트도 후속 작업 필요.
6. `feedback:view`와 본 페이지의 master-only RLS가 불일치. UserManagement의 권한 매트릭스에는 `feedback:view`가 있지만, 비-master에게 켜 줘도 RLS에서 차단된다. A7 UserManagement 시트의 발견 5번과 동일 카테고리의 부채 — 권한 매트릭스 정합화 시 함께 정리.

## 변경 이력
- 2026-05-28 신설 — design/m2-admin-rest 브랜치 5종 일괄 사전 정독.
- 2026-05-29 M3-7 시안 정합 (PR #10~15 답습) — FeedbackManagementPage.jsx (315→419, +281/-176).
  - PageHeader 도입 (subtitle: 통계 압축본 · 필터 시 라벨+카운트)
  - 상태별 StatCard 6장 (클릭 시 statusFilter 토글 → 클라이언트 필터, 카운트는 전체 기준 유지)
  - 필터 영역 SectionCard (유형 칩 3종 + 검색 + 초기화)
  - 표 SectionCard padding=0, 컬럼 6개 보존
  - 빈 상태 → ui/EmptyState
  - 상세 모달 InfoRow 4행 + content readOnly 회색 배경 강화 (사양 §발견 2)
  - 신규: 검색(content·제출자·location 클라이언트 필터) — 시안 답습
  - 보존: API 2종 (getFeedback, updateFeedbackStatus), 6상태 색 매핑, 3종 유형 매핑, 권한 미체크 (사양 §발견 3 — RLS 의존)
  - 자동 검출 5종 통과 (raw hex 0 / 인라인 fontSize rem-px 0 / weight 800 0 / 4배수 외 0 / touch 44 미만 0 — 아이콘 px 14/18은 시안 답습)
- 2026-06-11 폰트 수정 — 위치(location) 한글 값에 적용돼 있던 monospace 제거(목록 셀·상세 모달 InfoRow mono prop). 한글이 monospace로 렌더돼 깨져 보이던 문제 해소. 생성일(순수 날짜 숫자)은 tnum 정렬 위해 유지. (동일 점검으로 AuditLogPage diff value·ProductManagementPage 업로드 로그의 한글 monospace도 제거)
