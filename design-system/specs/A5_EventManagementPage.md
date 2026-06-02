# 사양 시트 — A5 학회 관리 (EventManagementPage)

> 이 시트는 학회 관리 화면의 정보·기능·데이터 구조의 단일 진실 소스다.
> 시안과 실서비스 구현은 이 시트의 모든 항목을 1:1로 반영해야 한다.
> 마지막 갱신: 2026-05-28 M3-4 정합 후 통계 카드 4장 → 헤더 subtitle + 상태 토글 통합 기록.

## 참조 파일
- 실 컴포넌트: `inpsyt-order-frontend/src/components/EventManagementPage.jsx` (799줄)
- 부속 컴포넌트: `inpsyt-order-frontend/src/components/SocietyManagementDialog.jsx` ("학회 목록 관리" 모달, societies 테이블 관리)
- 관련 유틸: `inpsyt-order-frontend/src/utils/date.js` 의 `getTodayKST`, `getEventStatusKST`
- DB 스키마: `supabase/migrations/20250722065000_create_events_table.sql` + `20260313060000_add_event_structured_fields.sql` + `20260406_add_estimated_delivery_date_to_events.sql`
- 외부 라이브러리: `qrcode` (QR 코드 SVG 생성)

## 사용자 시나리오
인싸이트 직원(master 또는 editor)이 학회 일정이 잡힐 때마다 사무실 PC에서 새 학회를 등록한다. 연도·시즌·주최학회를 선택하면 행사명과 주문 URL이 자동 제안된다. 등록 후 부스 운영자에게 URL을 복사해 전달하거나, 학회장 안내데스크용으로 QR 코드 SVG를 다운로드한다. 학회 진행 중에는 거의 손대지 않는다.

## 표시 정보 (라벨 단위, 누락 금지)

### 상단 헤더 (line 322-352)
- [ ] 페이지 제목 아이콘: `EventIcon` (primary 색)
- [ ] 페이지 제목 텍스트: "학회 관리"
- [ ] 우측 액션 버튼 (`events:edit` 권한 있을 때만):
  - "학회 목록 관리" 버튼 (outlined, `SettingsIcon`)
  - "새 학회 추가" 버튼 (contained, `AddIcon`)

### 상태 필터 토글 (M3-4 정합 후 — 통계 카드 4장 외형 전환)
2026-05-28 M3-4(EventManagementPage 시안 정합) 사이클에서 통계 카드 4장(그라데이션 배경)을 두 영역으로 분리해 흡수:
- 헤더 `subtitle`에 `총 N건 · 진행 중 X · 예정 Y · 종료 Z` 한 줄 통계로 통합
- 필터 영역 SectionCard 안 상태 토글 Chip 4종 (`전체 N` / `예정 Y` / `진행 중 X` / `종료 Z`)으로 통합

각 칩 클릭 시 `eventFilter` 토글:
- [ ] 전체: `events.length`, `eventFilter='all'`
- [ ] 예정: `upcomingEventsCount` (`today < start_date`), `eventFilter='upcoming'`
- [ ] 진행 중: `activeEventsCount` (`start_date <= today <= end_date`), `eventFilter='active'`
- [ ] 종료: `endedEventsCount` (`today > end_date`), `eventFilter='ended'`

> 그라데이션 배경은 신 디자인 시스템(`CLAUDE.md` E항)에서 차단 대상. 카드 4장 외형은 제거됐고, 정보는 통계 subtitle + 상태 토글로 1:1 보존됨.

### 학회 표 (line 420-559)
- [ ] 컬럼 헤더(`events:edit` 권한별): 학회명 / 상태 / 주문 URL / 할인율(중앙) / 기간 / 주최학회 / 작업(`events:edit` 시)
- [ ] 행 표시 — 누락 금지:
  - 학회명 (`event.name`, fontWeight 500)
  - 상태 칩 (`getEventStatusKST(start_date, end_date)`의 `{label, color}` 반환값)
  - **주문 URL 영역(line 470-512):**
    - URL 문자열 (`order_url_slug`, monospace, text.secondary)
    - "새 창에서 열기" 아이콘 (`OpenInNewIcon`) — 툴팁, primary 색
    - "URL 복사" 아이콘 (`CopyIcon`) — 툴팁, primary 색
    - "QR 코드" 아이콘 (`QrCode2Icon`) — 툴팁, primary 색
  - 할인율 칩 (`discount_rate * 100` %, `>0`이면 success filled, =0이면 default outlined)
  - 기간 (시작일 `yyyy.MM.dd` 굵게 + 종료일 caption "~ yyyy.MM.dd")
  - 주최학회 칩 (`host_society` 있으면 outlined 칩, 없으면 "—" disabled)
  - 작업: 편집 아이콘 (`EditIcon`)

## 액션·기능 (누락 금지)

- [ ] 통계 카드 클릭 → `eventFilter` 토글
- [ ] URL 복사 (`handleCopyUrl`) → `${origin}/order?events={slug}` 클립보드 → "주문 URL이 클립보드에 복사되었습니다." 토스트
- [ ] 새 창 열기 → `window.open` 같은 URL을 새 탭
- [ ] QR 코드 다이얼로그 열기 (`handleOpenQrDialog`) → SVG QR 생성, 다이얼로그에 표시
- [ ] 편집 아이콘 클릭 → 수정 다이얼로그 열기
- [ ] "새 학회 추가" 버튼 → 추가 다이얼로그 열기
- [ ] "학회 목록 관리" 버튼 → `SocietyManagementDialog` 열기 (societies 테이블 CRUD)
- [ ] 학회 저장 (`handleSave`):
  - name, order_url_slug 필수 검증
  - slug 정규식: `/^[a-z0-9-]+$/`
  - 중복 검증 (events 테이블에서 같은 slug 존재 여부, 자기 자신 제외)
  - 통과 시 insert 또는 update
- [ ] 학회 삭제 (master 권한 + 수정 다이얼로그 안에서만):
  - 연결된 주문(orders.event_id 일치) 건수 먼저 조회
  - 0건이면 삭제 가능, >0건이면 경고 후 차단
  - "이 행사에 연결된 주문 {N}건이 있어 삭제할 수 없습니다." 메시지
- [ ] 실시간 갱신: `supabase.channel('events_channel')`로 events 테이블 변경 구독, 변경 발생 시 `fetchEvents()` 호출
- [ ] QR SVG 다운로드 (`handleDownloadQrSvg`): 파일명 `qr-{slug}.svg`

## 입력 폼 구조 (추가/수정 다이얼로그, line 562-725)

> 폼은 두 블록(`Step 1: 구조화 정보` + `Step 2: 자동 생성 및 추가 정보`)으로 나뉘며, 두 블록 사이에 `Divider`. 두 블록 통합 금지.

### Step 1 — 행사명 형식 블록 (line 569-626, primary 색 옅은 배경 카드)
- [ ] 캡션: "✦ 행사명 형식" (primary 색, 굵게)
- [ ] **연도** 선택 (`event_year`, select) — `현재년-1`부터 5개 연도, 기본 빈값
- [ ] **행사 구분** 선택 (`event_season`, select) — 6개 옵션: 춘계학술대회 / 추계학술대회 / 연수강좌 / 보수교육 / 세미나 / 기타
- [ ] **주최 학회** (`host_society`, Autocomplete freeSolo) — `societies` 테이블의 name 목록 + 직접 입력 가능

> 세 필드 모두 입력되면 자동으로 행사명과 URL slug가 생성됨(아래 액션 참조).

### Step 2 — 자동 생성 + 추가 정보 (line 631-704)
- [ ] **행사명** (`name`, 텍스트, `InputLabelProps={shrink: true}`) — helperText "위 정보로 자동 완성되며, 직접 입력·수정할 수 있습니다." (2026-06-02 — 자유 입력 명확화. 행사명을 직접 수정하면 `_nameTouched` 플래그로 이후 자동완성이 덮어쓰지 않음. `_nameTouched`는 UI 전용, DB upsert에서 제외)
- [ ] **주문 URL** (`order_url_slug`, 텍스트) — helperText "주문 페이지 주소로 사용됩니다. 영문, 숫자, 하이픈만 가능"
- [ ] **할인율 (%)** (`discount_rate`, number) — UI는 0~100 정수, 저장은 `/100`해서 소수로. helperText "예: 15 = 15% 할인"
- [ ] **시작일** (`start_date`, date) + **종료일** (`end_date`, date) — 가로 배치, 별도 필드
- [ ] **배송 예정일** (`estimated_delivery_date`, date) — helperText "입력 시 고객 주문 조회 페이지에 도착 예정일이 표시됩니다."

### 다이얼로그 액션 (line 707-724)
- [ ] master 권한 + 편집 모드일 때만 "삭제" 버튼 (error 색, `DeleteIcon`, 좌측 정렬 `mr: auto`)
- [ ] "취소" 버튼
- [ ] `events:edit` 권한 있을 때 "저장" 버튼 (contained)

### 자동 채우기 규칙 (line 133-170)
- 신규 등록 모드에서만 작동(편집 시 작동 안 함)
- name 직접 입력 시 → 자동으로 slug 생성(공백 → `-`, 영문 외 제거)
- event_year + host_society + event_season 모두 채워지면 (단, 행사명을 사용자가 직접 건드리지 않은 경우 `!_nameTouched`):
  - name = `"{year} {host_society} {season}"`
  - slug = `"{society.slug_prefix}-{year}-{season_eng}-{random4}"` (랜덤 4자리 토큰으로 추측 방지)
  - season_eng: 춘계→spring / 추계→fall / 연수강좌→training / 보수교육→edu / 세미나→seminar / 기타→etc

## 권한별 차이

- `events:view` 없음 → 접근 차단 메시지
- `events:view` 있음 (viewer): 표·통계 카드·필터·URL 복사·QR 다운로드·새 창 열기 가능. "새 학회 추가" 및 "학회 목록 관리" 버튼 안 보임. 편집 컬럼 안 보임. 다이얼로그 폼 열 수 없음.
- `events:edit` 있음 (editor): 위 + 추가/수정 가능
- `master` 권한: 위 + 다이얼로그 안에서 "삭제" 버튼 사용 가능

## 데이터 모델

### `events` 테이블 (이 화면에서 SELECT/UPSERT하는 필드)
- `id` (bigint, PK)
- `created_at` (timestamptz)
- `name` (text) — 학회명
- `start_date` (date)
- `end_date` (date)
- `order_url_slug` (text, UNIQUE) — 영문 소문자/숫자/하이픈
- `event_year` (integer)
- `host_society` (text)
- `event_season` (text)
- `status` (text, default `'active'`) — UI 노출 없으나 select 컬럼에 포함됨 (확인 필요: 클라이언트에서 사용처)
- `discount_rate` (numeric) — 0~1 소수 (UI는 % 정수로 표시)
- `estimated_delivery_date` (date, nullable)

### `societies` 테이블 (참조용)
- `id`, `name`, `slug_prefix`

### `orders` 테이블 (삭제 검증 시 참조)
- `event_id` (bigint, FK → events) — 연결된 주문 카운트

## 필터·뷰 모드

- 학회 필터: `all` / `active` / `upcoming` / `ended` (통계 카드로 토글)
- 기본 정렬: `start_date desc` (line 81)

## 빈 상태·로딩·오류 처리

- 로딩: `TableSkeleton rows=5 columns=7`
- 빈 상태: `EmptyState` — "해당 학회가 없습니다" + "필터를 해제하거나 새 학회를 추가하세요" + "학회 추가" 액션 (`events:edit` 권한 있을 때만)
- 오류: 토스트 처리
- 실시간 변경: Supabase realtime 구독, 변경 시 자동 reload

## QR 코드 다이얼로그 (line 752-795)
- [ ] 제목: "QR 코드"
- [ ] 본문: SVG QR 이미지 (300px width, 색 dark=`#252525`, light=`#FFFFFF`)
- [ ] 학회명 (subtitle, 굵게)
- [ ] URL 텍스트 (monospace, text.secondary)
- [ ] 액션: "SVG 다운로드" (outlined, `DownloadIcon`, borderRadius 10px) + "닫기"

## 핵심 발견 (시안 검수 시 반드시 확인)

1. **주문 URL 컬럼은 4개 요소(URL 문자열 + 새창/복사/QR 아이콘) 묶음.** 시안이 URL만 보여주고 아이콘 3종을 빠뜨리면 운영자가 부스 안내데스크용 QR을 못 받는다.
2. **폼은 두 블록 분리 구조.** "행사명 형식" 블록(연도/시즌/주최학회)과 "자동 생성·추가 정보" 블록(행사명/URL/할인율/날짜) 사이에 `Divider`. 한 블록으로 합치면 자동 채우기 의도가 사라진다.
3. **연도·시즌·주최학회 세 필드는 별도.** Step 1에서 셋 다 채워야 자동 채우기가 작동한다. 시안에서 통합 입력으로 그리면 안 됨.
4. **시작일·종료일·배송 예정일 세 필드는 별도.** 시작/종료는 가로 배치이지만 입력은 분리. 배송 예정일은 별도 줄.
5. **할인율 단위 변환.** UI는 0~100 정수, DB는 0~1 소수. 시안에서 단위 표기 누락 금지.
6. **상태 칩 색은 `getEventStatusKST` 반환값을 따른다.** 시안이 임의 색 매핑을 만들면 안 됨 — utils와 1:1.
7. **master만 삭제 가능, 그리고 연결 주문 있으면 차단.** 시안이 모든 행에 삭제 아이콘을 직접 노출하면 안 됨(현재는 수정 다이얼로그 안에 숨겨져 있음).
8. **그라데이션 배경은 신 디자인 시스템에서 제거 대상.** 통계 카드 4장의 그라데이션은 시안에서 유지하지 말 것.

## 변경 이력

- 2026-05-13 신설.
- 2026-05-28 M3-4 정합: 통계 카드 4장 외형 → 헤더 subtitle + 상태 토글 칩으로 통합 (정보 1:1 보존, 그라데이션 제거). 표 영역은 `SectionCard padding=0`으로 래핑. 헤더는 `PageHeader`, 상태 칩은 `StatusBadge(value=paid|pending|completed)`, URL 액션 묶음은 `ActionSlot`, 빈 상태는 `ui/EmptyState`로 교체. 폼 2블록 분리·할인율 단위 변환·QR 다운로드·권한 분기 보존.
- 2026-06-02 행사명 자유 입력 명확화: helperText "직접 입력·수정 가능"으로 변경(라벨 "행사명 (자동 완성)" → "행사명"). 행사명 직접 수정 시 `_nameTouched`(UI 전용 플래그)로 이후 연도/시즌/주최학회 변경이 행사명을 덮어쓰지 않게 보존. `_nameTouched`는 DB upsert에서 분리. 기존 자동완성·slug 생성·기존 옵션 유지(주최학회는 이미 Autocomplete freeSolo). 동작 추가만, 제거 0.
