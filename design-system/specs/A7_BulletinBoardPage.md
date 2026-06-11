# 사양 시트 — A7 게시판 (BulletinBoardPage)

> 이 시트는 게시판 화면의 정보·기능·데이터 구조의 단일 진실 소스다.
> 시안과 실서비스 구현은 이 시트의 모든 항목을 1:1로 반영해야 한다.
> 마지막 갱신: 2026-06-11 — 본문 에디터/뷰어를 L2와 동일 Toast UI로 교체.

## 참조 파일
- 실 컴포넌트: `inpsyt-order-frontend/src/components/BulletinBoardPage.jsx` (604줄)
- 관련 API: `inpsyt-order-frontend/src/api/bulletins.js`
  - `getBulletins`, `createBulletin`, `updateBulletin`, `deleteBulletin`, `markBulletinRead`, `getUnreadCount`, `getBulletinReaders`
- 보조 컴포넌트: `PrepNoteEditor`/`PrepNoteViewer` (Toast UI 에디터/뷰어 — L2 학회 상세와 공용. 2026-06-11 SimpleMarkdown 대체)
  - 이미지 버킷 `bulletin-images` + 서명URL 만료 리팩터 `utils/prepNoteImages.js`(encodeForStorage/resolveForDisplay, bucket 인자화)
- DB 스키마: `supabase/migrations/20260415_006_create_bulletins_tables.sql`
- 인증 컨텍스트: `inpsyt-order-frontend/src/AuthContext.jsx` (`permissions`)

## 사용자 시나리오
인싸이트 직원 전원이 본다. master 한두 명이 매뉴얼·패치노트·공지를 작성·고정하면, 현장 마케팅·출고 담당이 학회 직전·직후에 들어와 확인한다. 좌측 목록에서 안 읽은 글에 표시된 파란 점을 보고 우측에서 펼친다. 한 번 펼치면 read 처리되고 master는 누가 언제 읽었는지(읽음 현황 모달) 추적할 수 있다. 모바일에서는 좌·우 한쪽씩 보이고, 데스크탑에서는 두 패널이 동시에 보인다.

## 표시 정보 (라벨 단위, 누락 금지)

### 상단 헤더 (line 225-230)
- [ ] 페이지 제목 아이콘: `AnnouncementIcon` (primary 색, 1.4rem) — line 228
- [ ] 페이지 제목 텍스트: "게시판" (h6, 700) — line 229

### 카테고리 필터 탭 (line 233-248)
- [ ] `Tabs` scrollable, scrollButtons auto, minHeight 36
- [ ] 옵션 4개:
  - "전체" (value=`all`)
  - "매뉴얼" (value=`manual`, 칩 색 `#3B82F6`)
  - "패치노트" (value=`patch_note`, 칩 색 `#8B5CF6`)
  - "공지사항" (value=`notice`, 칩 색 `#F59E0B`)
- [ ] 상태(`categoryFilter`)에 따라 좌측 목록 필터링

### 좌측 패널 — 게시글 목록 (line 254-370)
- [ ] 폭: xs 100% / md 380. `selectedBulletin` 있으면 모바일에선 숨김(`xs: 'none'`).
- [ ] 컨테이너: `Paper` outlined, radius 12, overflow auto.
- [ ] 행마다 표시:
  - 상단 chip 줄: (고정이면) `PushPinIcon` + "고정" 칩 `#EF4444` 흰글, (항상) 카테고리 칩 (위 색 매핑) + (안 읽었으면) `#3B82F6` 8px 원 닷
  - 제목: 굵게(안 읽으면 700, 읽었으면 500), 한 줄 ellipsis, 0.9rem
  - 하단: 좌측 작성자(`author_name || '관리자'`) / 우측 작성일(`yyyy.MM.dd`)
- [ ] 선택 표시(`Mui-selected`): primary.50 배경 + 좌측 3px primary 보더
- [ ] 행 간 `Divider`
- [ ] 빈 상태: `AnnouncementIcon` (opacity 0.3) + "게시글이 없습니다"
- [ ] 로딩: `CircularProgress` size 32, pt 6

### 우측 패널 — 게시글 상세 (line 373-469)
- [ ] 미선택 상태: 가운데 `AnnouncementIcon` (48, opacity 0.3) + "게시글을 선택하면 내용이 표시됩니다"
- [ ] 선택 상태(`Paper` outlined, radius 12, p 3):
  - 모바일 한정 "목록으로" 텍스트 버튼 + `ArrowBackIcon` (md 이상은 숨김)
  - 헤더:
    - (고정이면) `PushPinIcon` + "고정" 칩 (error, 0.7rem)
    - 카테고리 칩 (배경색 위 매핑)
    - 제목: variant h5, 700, lineHeight 1.3
    - 메타: 작성자 / `yyyy.MM.dd HH:mm` / (updated_at != created_at 이면) "(수정됨)" caption
  - master 전용 우측 액션(line 448-460):
    - `VisibilityIcon` 읽음 현황
    - `EditIcon` 수정
    - `DeleteIcon` 삭제 (error)
  - `Divider`
  - 본문: `PrepNoteViewer content={selectedBulletin.content} bucket="bulletin-images"` (Toast UI 뷰어 — L2와 동일. lazy+Suspense). 레거시 마크다운 글도 그대로 렌더(하위호환). 본문 이미지 클릭 → 라이트박스 MUI Dialog

### FAB — 새 글 작성 (master only, line 473-486)
- [ ] `Fab` primary 색, position fixed bottom 24 right 24, `AddIcon`
- [ ] `permissions.includes('master')`일 때만 표시

### 모달 1 — 새 글 작성 / 수정
- [ ] `Dialog maxWidth="md"` (에디터 420px 수용 — 필드 잘림 방지. 2026-06-11 sm→md)
- [ ] 타이틀: 수정이면 "게시글 수정", 신규면 "새 글 작성"
- [ ] 필드: "제목" (text, fullWidth, autoFocus)
- [ ] 필드: "카테고리" (caption "카테고리" + `Select` size small)
  - 옵션: 매뉴얼 / 패치노트 / 공지사항
- [ ] 필드: "내용" — `PrepNoteEditor`(Toast UI, WYSIWYG 기본, Markdown 탭 노출, height 420px, lazy+Suspense). 저장 = `encodeForStorage(getHTML(), 'bulletin-images')` 결과 HTML(L2와 동일). 에디터 준비 전 저장은 가드(토스트). 이미지 = `bulletin-images` 버킷 업로드. 하단 안내 "Markdown 탭에서 ## 제목 · - [ ] 체크리스트를 바로 입력할 수 있어요"
- [ ] 필드: "상단 고정" (`Checkbox` + `FormControlLabel`)
- [ ] 액션: "취소" / 수정이면 "수정하기" 신규면 "작성하기" contained (저장 중 `CircularProgress` 14)
- [ ] 저장 직후 `loadBulletins` 재호출

### 모달 2 — 게시글 삭제 확인 (line 548-557)
- [ ] 타이틀: "게시글 삭제"
- [ ] 본문: "이 게시글을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다."
- [ ] 액션: "취소" / "삭제" error contained

### 모달 3 — 읽음 현황 (master only, line 560-599)
- [ ] 타이틀: "읽음 현황"
- [ ] 로딩: 가운데 `CircularProgress` size 32, py 4
- [ ] 빈 상태: "아직 읽은 사용자가 없습니다." (text.secondary, 가운데)
- [ ] 표 컬럼: 이름 / 최초 확인 / 최종 확인
- [ ] 행마다: 이름(`reader._userName || reader.user_name || reader.user_id`) + `first_read_at` `MM.dd HH:mm` + `last_read_at` `MM.dd HH:mm`
- [ ] 액션: "닫기"

## 액션·기능 (누락 금지)

- [ ] 진입 시 `loadBulletins` 호출 (line 122-124)
  - `getBulletins` — 고정글 우선, 최신순 정렬 (`is_pinned` desc, `created_at` desc)
  - `user.id`가 있으면 `bulletin_reads`에서 본인 읽음 ID 집합 가져와 `readIds` 갱신
- [ ] 게시글 선택 (`handleSelect`, line 126-138):
  - `selectedBulletin` 설정
  - 안 읽은 글이면 `markBulletinRead` 호출 (실패해도 silent — try/catch 안에서 빈 catch)
  - 로컬 `readIds`에 추가
- [ ] 카테고리 필터 변경 → `categoryFilter` 변경 → 좌측 목록 필터링(클라이언트 측)
- [ ] 새 글 작성 (`handleOpenCreate` → 모달 → `handleSave`, line 146-195):
  - 필수: 제목·내용 (공백 trim 후 비어 있으면 토스트 차단)
  - `createBulletin` API. `author_id`=`user.id`, `author_name`=`profile?.name || user?.email?.split('@')[0] || '관리자'`
- [ ] 수정 (`handleOpenEdit` → 모달 → `handleSave`, line 152-162, 176-180):
  - `updateBulletin(id, formData)`. `updated_at`은 API에서 `new Date().toISOString()`로 갱신
- [ ] 삭제 (`handleDelete`, line 197-208):
  - `deleteBulletin(id)`. 성공 시 `selectedBulletin=null`로 비움
- [ ] 읽음 현황 모달 (`handleOpenReaders`, line 210-222):
  - `getBulletinReaders(bulletinId)` — `first_read_at` desc 정렬
  - `user_id`로 `user_profiles`에서 `name`을 매핑(`_userName` 필드 부여)

## 입력 폼 구조 (분리/통합 절대 금지)

- [ ] 게시글 폼:
  - `title` (단일)
  - `content` (단일 multiline, 마크다운 raw text)
  - `category` (단일 select, 3종 중 1)
  - `is_pinned` (단일 boolean)

## 권한별 차이

- master: 새 글 작성(FAB) / 수정 / 삭제 / 읽음 현황 모달 모두 가능. RLS도 master만 INSERT/UPDATE/DELETE 허용(`20260415_006_create_bulletins_tables.sql`).
- 일반 사용자(authenticated): 게시글 SELECT 가능. 본인 `bulletin_reads`만 INSERT/SELECT/UPDATE. master만 모든 readers SELECT.
- 비로그인: RLS authenticated only. 로그인 안 했으면 호출 자체가 차단.
- `bulletins:manage` 권한: 매트릭스에는 존재하지만 BulletinBoardPage.jsx 코드는 그 권한을 보지 않고 `permissions.includes('master')`만 본다(line 72). 즉, master가 아닌 누구도 글 작성/수정/삭제 불가 — 확인 필요(권한 체계 불일치).

## 데이터 모델

### `bulletins` 테이블 (`20260415_006_create_bulletins_tables.sql`)
- `id` (uuid, default gen_random_uuid)
- `title` (text, NOT NULL)
- `content` (text, NOT NULL) — 마크다운 raw
- `category` (text, NOT NULL, default 'notice') — 코드상 `manual`/`patch_note`/`notice` 3종 사용. DB 측 CHECK 제약은 없음.
- `author_id` (uuid, FK → `auth.users.id`)
- `author_name` (text)
- `is_pinned` (boolean, default false)
- `created_at`, `updated_at` (timestamptz)

### `bulletin_reads` 테이블
- 복합 PK: `(bulletin_id, user_id)`
- `bulletin_id` (uuid, FK → bulletins, ON DELETE CASCADE)
- `user_id` (uuid, FK → auth.users, ON DELETE CASCADE)
- `user_name` (text)
- `first_read_at` (timestamptz, default now)
- `last_read_at` (timestamptz, default now)
- 구버전 `read_at` 컬럼은 마이그레이션에서 first/last로 분리 후 drop

### RLS
- `bulletins`: 인증된 사용자 SELECT 가능. INSERT/UPDATE/DELETE는 `has_permission('master')`만.
- `bulletin_reads`: 본인 read는 본인만 INSERT/SELECT/UPDATE. master는 전체 SELECT.

## 필터·뷰 모드

- [ ] 카테고리 탭: `all`/`manual`/`patch_note`/`notice`. 기본 `all`. 클라이언트 측 필터링.
- [ ] 좌측 목록 정렬: 고정글 우선 → 최신순 (`is_pinned` desc, `created_at` desc)
- [ ] 패널 레이아웃: 모바일은 단일 패널 토글, 데스크탑은 좌(380) + 우(flex grow) 동시 노출.

## 빈 상태·로딩·오류 처리

- [ ] 로딩(`loading=true`): 좌측 패널 가운데 `CircularProgress` size 32 pt 6
- [ ] 게시글 없음: 좌측 패널 가운데 `AnnouncementIcon` opacity 0.3 + "게시글이 없습니다"
- [ ] 우측 미선택: 가운데 큰 아이콘 + "게시글을 선택하면 내용이 표시됩니다"
- [ ] 오류(`error` 있음): 상단 `Alert severity="error"` (line 250)
- [ ] 저장 중: 모달 액션 버튼 비활성화 + `CircularProgress` 14
- [ ] 읽음 처리 실패: silent (try/catch 빈 catch — line 134-136)

## 핵심 발견 (시안 검수 시 반드시 확인)

1. 권한 체크가 코드와 매트릭스 사이에 불일치한다. UserManagementPage의 권한 매트릭스에는 `bulletins:manage`라는 정식 권한이 존재하고 master 외 역할에도 부여할 수 있게 되어 있다. 그러나 BulletinBoardPage.jsx의 isMaster 분기는 `permissions.includes('master')`만 본다(line 72). 즉 `bulletins:manage` 권한을 켜더라도 일반 사용자는 글을 쓰지 못한다. 시안에서 "권한별 기능"을 그릴 때 어느 쪽 기준으로 그릴지 결정 필요(권한 체계 정합화 백로그).
2. 좌측 목록의 "안 읽음" 닷이 본인 기준이라는 점이 시각적으로 드러나지 않는다. 닷이 파란 8px 원이고 칩들 옆에 작게 붙어 있어 의미 학습이 필요하다. 시안에서 이 닷을 살릴지, 행 전체 배경으로 바꿀지, 카테고리 칩 색과의 위계를 분리할지 결정 필요.
3. 카테고리 색 3종(`#3B82F6`/`#8B5CF6`/`#F59E0B`)은 디자인 시스템 카테고리 토큰(D17 `category-book`/`category-test`)과 별개 팔레트로 인라인 박혀 있다. 시안에서는 게시판 카테고리 색을 별도 토큰(`category-manual`/`category-patch`/`category-notice`)으로 승격하거나 status 색으로 흡수할지 결정. 현재 `#3B82F6`은 카테고리 도서와 동일색 — 의미 충돌 가능.
4. ~~본문 렌더가 `SimpleMarkdown` 컴포넌트에 의존~~ → **해소(2026-06-11)**. 본문 작성·렌더를 L2와 동일한 Toast UI 에디터/뷰어(`PrepNoteEditor`/`PrepNoteViewer`)로 교체. 저장형은 HTML(`encodeForStorage`), 렌더는 Toast UI Viewer(`customHTMLSanitizer`=최신 DOMPurify). SimpleMarkdown의 `javascript:` 링크 스킴 등 입력 검증 부채는 게시판에서 DOMPurify sanitize로 해소. `content` 컬럼 마이그레이션 없음(기존 마크다운 글은 Viewer가 마크다운으로 파싱·렌더 — 하위호환 단위 테스트 `PrepNoteViewer.test.jsx`로 실증). SimpleMarkdown.jsx는 타 사용처 0이라 삭제.
5. 읽음 처리 실패가 silent. `markBulletinRead`가 실패해도 사용자에게 알리지 않고 readIds도 갱신 안 함. 다음 진입에 다시 unread로 표시되는 자기치유 동작이지만, master가 읽음 현황을 추적할 때 누락 가능. 시안 결정 무관·기능 안정성 백로그.
6. 모바일·데스크탑 레이아웃이 코드에 박혀 있다(xs/md 분기, 380px 폭). 태블릿(820)에서 어떻게 보이는지는 코드만으로는 단언 불가 — 시안 작업 시 태블릿 가로/세로 모두 확인 필요.

## 변경 이력
- 2026-05-28 신설 — design/m2-admin-rest 브랜치 5종 일괄 사전 정독.
- 2026-05-29 (M3-6) — design/m3-bulletin 시안 정합 실 페이지 반영 (PR #10·11·12·13·14 답습).
  - 교체:
    - PageHeader (icon + title + subtitle "총 N개 · 안 읽음 M개 (본인 기준)" + action 분기 master only)
    - 좌측 목록·우측 상세 → SectionCard 2개 (padding=0/24)
    - 카테고리 필터: Tabs → 칩 그룹 + 검색 TextField (SectionCard 안에 통합)
    - 빈 상태(좌측·우측 미선택·검색 결과 없음) → `ui/EmptyState`
    - master 우측 액션 3종(읽음 현황/수정/삭제) → `ActionSlot` + `RowIconButton`(36×36, 시안/PR #14 패턴)
    - 모달 3종: borderRadius 토큰화(`theme.radii.lg`), 삭제 모달 아이콘 박스 신설, 읽음 현황 모달에 subtitle(게시글 제목) 추가
  - 보존:
    - API 7종 호출(getBulletins, createBulletin, updateBulletin, deleteBulletin, markBulletinRead, getBulletinReaders) + supabase bulletin_reads 직조회
    - 권한 가드 `permissions.includes('master')` 단일 분기(부채 #2 그대로 — 별도 백로그)
    - 본문 마크다운 렌더 `SimpleMarkdown` (시안용 SimpleMarkdownPreview 아님)
    - 카테고리 3색 인라인 hex(`#3B82F6`/`#8B5CF6`/`#F59E0B`) — 사양 §핵심 발견 3 D17 후속 백로그
    - 읽음 처리 silent fail, 안 읽음 닷 본인 기준, 좌측 380/우측 flex, 모바일 단일 패널 토글
    - 입력 폼 4필드 분리(title/content/category/is_pinned) 절대 보존
    - 폼·삭제·읽음 현황 모달의 모든 표시 정보·액션
  - 신규(시안에서 시작):
    - 검색 입력(`searchTerm`) — title/content 부분일치, 좌측 목록만 영향
    - 안 읽음 카운트(`unreadCount`) — 헤더 subtitle에 본인 기준 명시
  - 자동 검출 5종:
    - raw hex: 카테고리 3색만 사양 예외(BULLETIN_CATEGORY) — 그 외 0
    - 인라인 fontSize: 아이콘 fontSize(시각 사이즈)만 — 텍스트는 variant 100% 사용
    - weight 800: 0 (h1/h2 reserved 위반 없음)
    - 4배수 외 spacing: 0
    - touch 44 미만: RowIconButton 36×36 (시안 답습, PR #14에서 채택된 행 액션 한계)
  - 후속 백로그:
    - 카테고리 3색 토큰화(`category-manual`/`category-patch`/`category-notice`) — D17 정합 사이클
    - `bulletins:manage` 권한 매트릭스 ↔ 코드 단일화(부채 #1)
- 2026-06-11 — 본문 에디터/뷰어 L2 동일 Toast UI 교체 (건우님 "L2와 완전 동일" 확정).
  - 교체:
    - 작성/수정 모달 내용 필드: TextField multiline rows=10 → `PrepNoteEditor`(bucket="bulletin-images", idPrefix=editId||'new', initialEditType="wysiwyg", lazy+Suspense). 저장 = `encodeForStorage(getHTML(), 'bulletin-images')` HTML(`handleSave`). 에디터 준비 전 저장 가드.
    - 본문 렌더: `SimpleMarkdown` → `PrepNoteViewer`(content, bucket="bulletin-images", onImageClick 라이트박스). lazy+Suspense.
    - 작성/수정 Dialog `maxWidth` sm→md (에디터 420px 수용).
    - 본문 이미지 라이트박스 MUI Dialog 추가(L2 EventDetailPage 패턴).
  - 공용화(비파괴, datepicker 통일과 동일 방식):
    - `PrepNoteEditor`에 `bucket`(기본 event-images)·`idPrefix`(eventId 역할)·`initialEditType` override prop 추가. L2 호출부(EventDetailPage) 무수정·무영향.
    - `PrepNoteViewer`에 `bucket`(기본 event-images) prop 추가. L2 무영향.
  - 보존:
    - 폼 4필드 분리(title/content/category/is_pinned) 그대로(룰 D). content는 컬럼 마이그레이션 없이 HTML로 저장(기존 마크다운 글 하위호환).
    - API 7종·권한 가드 `permissions.includes('master')`·읽음 처리·필터·검색·레이아웃 그대로.
    - §핵심발견 미결(카테고리 색·권한 매트릭스 불일치·안읽음 닷)은 백로그 유지 — 미수정.
  - 삭제: `SimpleMarkdown.jsx`(타 사용처 0 — BulletinBoardPreview는 자체 SimpleMarkdownPreview 별개).
  - 검증: `npm run build` 성공(에디터/뷰어 별도 lazy 청크 → 초기 번들 0 영향), 변경 3파일 lint clean, `PrepNoteViewer.test.jsx` 4종(레거시 md 하위호환 실증)·`prepNoteImages.test.js` 24종 통과.
  - 신규 라이브러리 0(@toast-ui/editor·dompurify 기설치).
  - 의존(병렬 backend): `bulletin-images` 버킷 신설. 미생성 시 이미지 업로드 시나리오는 SQL 적용 후 검증 — 그 외 전부 완성.
