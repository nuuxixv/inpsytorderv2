# L2 — 학회 통합 상세 (Event Detail) · P0

> 비전: **"학회 운영 OS — 한 학회의 모든 것이 한 페이지에."**
> L1 연간 목록(`A10_EventHubList.md`) → **L2 학회 통합 상세(이 문서)** → L3 연차 자산(비-P0)
> 상태: **실구현 완료(2026-06-08, frontend-engineer).** 시안 v2 기준 + 건우님 결정(준비물 위젯 + 학회자료 섹션 → **통합 Toast UI 에디터 1칸**으로 대체). 백엔드(prep_note·event-images 버킷) 적용 완료. 이미지 업로드는 Storage 버킷 적용 후 라이브 QA.

> **실구현 단일 진실 소스:** `src/components/EventDetailPage.jsx` · 라우트 `/admin/events/:slug`(AdminLayout `EventsRoute` 분기 — slug 있으면 L2, 없으면 L1 목록). export default.
> - 톤·헬퍼·할인율 칩·시간상태 배지·참석자 칩 = `EventManagementPage.jsx`(실 L1) 정합.
> - 매출 = `src/utils/revenueByCategory.js`(`computeRevenueByCategory`, paid만) — 대시보드 hero 축약.
> - 현장 보고 = `src/components/FieldReportSection.jsx`(DashboardPage에서 추출 — 양쪽 공용, 1차 plain text).
> - 단건 fetch·진행상태·노트 저장·매출 주문 = `src/api/events.js`(`getEventBySlug`/`updateEventProgress`/`updateEventPrepNote`/`getOrdersForEventRevenue`).
> - 통합 에디터 = `src/components/PrepNoteEditor.jsx`(Toast UI Editor) / 읽기 = `PrepNoteViewer.jsx`(Toast UI Viewer). **React.lazy 지연 로드**(초기/공개 번들 0 영향).
>
> **시안(폐기 예정):** `src/components/EventDetailPreview.jsx`(`/preview/event-detail`) — 준비물 위젯·학회자료 자리는 실구현에서 통합 에디터로 대체됨. 시안의 §7·§8 영역은 실구현과 불일치(참고용으로만).

## 1. 개요·목표
- A10 L1 표의 행 본문 클릭 → 이 화면 진입(현재 A10은 toast 스텁). 잘못된 slug → EmptyState "학회를 찾을 수 없어요".
- 목표: ① 한 학회의 운영 정보(개요)·진행상태·매출·현장 보고를 한 페이지에 집결 ② 5곳에 분산되어 있던 정보의 통합 진입점 제공.
- 데이터 단위: `events` 1행 + 해당 event의 `orders`(매출) + `field_reports`(현장 보고).

## 2. 라우트·진입
- 라우트: `/admin/events/:slug` (slug = `events.url_slug`).
- 진입: A10 L1 표 행 본문 클릭(⋯ 메뉴는 stopPropagation). 권한 `events:view`.
- 잘못된/없는 slug: EmptyState "학회를 찾을 수 없어요" + "학회 목록으로" 액션.

## 3. 레이아웃 골격 (위→아래, 단일 컬럼 세로 스크롤)
| # | 블록 | 컴포넌트 |
|---|------|----------|
| 0 | 뒤로(학회 목록) | text Button + ArrowBack → `/admin/events` |
| 1 | PageHeader | `PageHeader`(title=학회명 / subtitle=행사명·날짜(요일)) + 직하 상태배지·할인율 칩 / 우상단 액션 3 |
| 2 | 개요 카드 | `SectionCard` "개요" + 6필드 라벨/값 행(`OverviewRow`) |
| 3 | 진행 상태 | `SectionCard` "진행 상태" + 3 토글 칩(`ProgressChip`) → events update |
| 4 | **준비 노트** | `SectionCard` "준비 노트" + **통합 리치 에디터(Toast UI)** 한 칸. 준비물(task 체크박스)+학회자료(이미지)+학회정보(자유 텍스트) 통합 |
| 5 | 현장 보고 | `SectionCard` "현장 보고" + `FieldReportSection`(1차 plain text) |
| 6 | 매출 요약 | `SectionCard` "매출 요약" — **지결 완료 시에만** hero `StatCard` + sub 1~3장(검사/도서/도구, 0원 숨김 동적 분할). 미완료 = 안내 박스 |

> 단일 컬럼. 어드민 데이터 밀도 원칙(01)이되 한 학회 = 한 스토리이므로 세로 누적. 좌/우 컬러 인디케이터·그라데이션·가짜 통계 없음(룰 E).
> **순서 의도(준비→진행→기록→정산):** 준비 노트(현장 전 준비) → 현장보고(현장 중 기록) → 매출(정산 결과는 흐름의 끝, 지결 완료 후 확정). 날짜는 헤더·개요 모두 `YYYY.MM.DD(요일)` 표기.
> **변경(2026-06-08 건우님):** 시안의 "준비물 체크리스트(블록4)"+"학회 자료(블록5)" 2개 섹션 → **통합 Toast UI 에디터 1개**로 대체. 준비물은 에디터의 task-list 체크박스, 학회 자료 이미지는 에디터 본문 삽입(Storage 업로드)으로 흡수. 섹션 수 7→6.

## 4. PageHeader (블록 1)
- [ ] title = `events.host_society` (학회명).
- [ ] subtitle = `events.event_season`(행사명) · `start_date ~ end_date` **+요일** (tnum). 단일일 = `2026.06.07(토)`, 기간 = `2026.06.07(토) ~ 06.09(월)`(같은 연도면 종료부 YYYY 생략). 요일=`getDay()`(KST 자정 파싱).
- [ ] 헤더 직하 한 줄: 시간상태 배지(`getEventStatusKST` → 예정/진행 중/종료, `StatusBadge`) + 할인율 칩(>0%, accent.revenue soft).
- [ ] 뒤로: 헤더 위 text Button "학회 목록" → L1.
- [ ] 우상단 액션 3 (outlined, 모두 동일 위계 — Primary 채움 없음):
  - [x] **학회 정보 수정** — **공용 `EventFormDialog.jsx` 인라인 오픈(2026-06-10 — L1 목록 이동 폐기).** 저장 → `loadEvent()` 재조회(slug 변경 시 새 주소로 replace 네비게이트 — 구 slug 미발견 방지). 삭제 가능 조건 = L1 정합(master 전부 / onsite 본인 생성, `created_by` — `EVENT_DETAIL_COLUMNS`에 추가). 삭제 성공 → 목록 이동.
  - [x] **입금결의서** — `exportDepositResolution`(ExcelJS 동적 import) + 작성자/부서 자동 채움. **유일 진입점(2026-06-10 건우님 확정 — 대시보드 버튼 소거, L2 일원화).**
  - [ ] **지불증** — `PaymentReceiptModal`(A10b) 오픈. 실구현 시 event+staff 전달.

> 확인 필요: 입금결의서/지불증은 결제완료 주문이 0건이거나 미래 학회일 때 노출 여부·disabled 처리. (1차 시안은 항상 노출.)

## 5. 개요 카드 (블록 2 — A10 §7-1 6필드, events 1행 직출력)
라벨 단위 6행. `OverviewRow`(라벨 88px 고정폭 + 값).
- [ ] **장소** = `events.venue`. 미입력 "—".
- [ ] **날짜** = `start_date ~ end_date` **+요일**(tnum). 헤더와 동일 `YYYY.MM.DD(요일)` 포맷(`formatRange`).
- [ ] **참석자** = `events.attendee_ids` → `STAFF_MAP` join. **L2는 전체 펼침**(A10 L1의 "외 N명" 압축 아님). "나"(로그인 user) 칩 첫 칸 우선·accent(primary soft). master는 "· 마스터" 보조 라벨. 삭제 uuid="(삭제)". 미입력 "—".
- [ ] **비용** = `events.marketing_cost`. `#,##0원`. 0/미입력 "—".
- [ ] **비고** = `events.note`. whitespace-pre-wrap(여러 줄). 미입력 "—".

> A10에서 L2 강등된 비고·비용이 여기서 처음 전체 노출(progressive disclosure). 날짜는 헤더와 개요 양쪽 표기 — 헤더=식별 컨텍스트, 개요=정보 행 일관성(의도된 중복, 변경 아님).

## 6. 진행 상태 (블록 3 — 3 독립 토글 칩)
- [ ] events 3 boolean — `draft_done`(기안) / `application_done`(신청) / `payment_resolution_done`(지결). 마이그레이션 `20260608030000_add_event_progress_flags.sql` 적용 완료(DEFAULT false).
- [ ] **단계(순차) 아님 — 누적 독립 토글.** 예: 기안(O) 신청(O) 지결( ). 종속 없음.
- [ ] 완료 = 채워진 brand 칩(primary soft 배경 + 보더 + 체크 동그라미 + 700). 미완 = 빈 중립 칩(gray-50 + gray-200 보더 + 빈 동그라미 + 600).
- [ ] 토글 권한 = `events:edit`. 미보유자는 읽기 전용(클릭 불가, hover 없음).
- [ ] 칩 hit-area 44px(minHeight). 키보드: role=button·tabIndex·Enter/Space 토글·focus ring(`customShadows.focus`).

## 7. 준비 노트 (블록 4 — 통합 Toast UI 에디터 · events.prep_note text)
> **2026-06-08 건우님 결정:** 시안의 준비물 위젯+학회자료 2개 섹션을 폐기하고 **통합 리치 에디터 한 칸**으로 대체.
- [x] 목적: 학회 준비물·자료·정보를 한 칸에 자유롭게 정리. 운영자 자체 관리(고객 비노출).
- [x] 저장 = `events.prep_note text` — 에디터 HTML 본문. 마이그레이션 `20260608050000_add_event_prep_note_drop_prep_items.sql` 적용 완료(NULL 허용, anon 비노출).
- [x] **에디터 = Toast UI Editor**(`@toast-ui/editor` + `@toast-ui/react-editor`). **React.lazy 지연 로드**(`PrepNoteEditor.jsx`/`PrepNoteViewer.jsx`) — 초기/공개 번들 0 영향. CSS import는 lazy 청크 내부.
- [x] **준비물 = task-list 체크박스**(에디터 task 툴바). **이미지(프로그램·부스배치도) = addImageBlobHook** → `supabase.storage.from('event-images').upload()` → 표시용 서명 URL(6시간) 본문 삽입. **학회정보(설치/철거 등) = 자유 텍스트.**
- [x] **이미지 저장 = 경로, 렌더 = 재서명(2026-06-10 — 서명 URL 만료 리팩터):** DB 저장본의 img src는 **`storage://event-images/<path>` 경로 플레이스홀더**(토큰 없음 — 만료 무관). 저장 직전 `encodeForStorage(html)`가 본문 내 서명 URL을 경로로 치환(EventDetailPage handleSaveNote). 에디터/뷰어 진입 시 `resolveForDisplay(html)`가 경로(+레거시 서명 URL 직저장본)에서 path를 추출해 `createSignedUrls` **단일 배치 호출(TTL 6시간)** 후 실제 URL로 치환해 주입. 공용 유틸 = `src/utils/prepNoteImages.js`(단위테스트 `prepNoteImages.test.js`). **레거시(1년 서명 URL 직저장) 노트는 렌더 전처리에서 자연 치유, 재저장 시 경로형으로 갱신 — 마이그레이션 불필요.** 재서명 실패 시 해당 이미지만 깨진 채 표시 + 콘솔 경고(본문 차단 금지).
- [x] 이미지 검증: jpg/png/webp, ≤5MB. 위반 시 토스트 안내(업로드 거부).
- [x] **모드 전환(2026-06-10):** 하단 Markdown/WYSIWYG 탭 노출(`hideModeSwitch: false`). **신규(빈) 노트 = markdown 기본**(`## 제목`·`- [ ] 체크리스트` 등 마크다운 직접 입력 — WYSIWYG에는 마크다운 입력 룰이 없어 자동변환 불가). **기존 노트 = wysiwyg 기본**(HTML 저장본이라 markdown으로 열면 raw HTML 노출 — 탭 전환 시 convertor가 마크다운 변환). `previewStyle: 'tab'`. 이미지 paste/drop 업로드(addImageBlobHook)는 양 모드 동작(dist 검증). 에디터 하단 안내 1줄("Markdown 탭에서 ## 제목 · - [ ] 체크리스트를 바로 입력할 수 있어요").
- [x] 저장 흐름: "편집" → 에디터 → "저장"(`getHTML()` → `encodeForStorage`(서명 URL→경로) → `updateEventPrepNote` — **마크다운 모드에서도 변환 HTML 반환**, 기존 데이터·Viewer 호환). 에디터 준비 전(lazy 로드·이미지 재서명 중) 저장 클릭 = no-op(getHTML 접근자 null 반환 가드 — 본문 유실 방지). 읽기 = Toast UI **Viewer**(기본 sanitize · XSS 방어).
- [x] 편집 권한 = `events:edit`. 미보유자 = 읽기 전용(편집 버튼 비노출, Viewer만).
- [x] **이미지 클릭 확대:** Viewer 본문 img 클릭 → MUI Dialog 라이트박스(maxWidth 90vw/90vh, contain, 클릭/× 닫기). 신규 라이브러리 0(MUI Dialog).
- [x] **빈 상태**(prep_note 없음): EmptyState "준비 노트가 비어 있어요" + 안내 + "작성하기"(edit자).
- [x] **임시저장(2026-06-15)**: 편집 중 에디터 `onChange` → localStorage 자동저장(`useFormDraft('prepNote', eventId)`, debounce 2초·24h 보존·userId 격리). 재진입(편집 열기) 시 유효 draft 있으면 에디터 위 인라인 `DraftBanner`(이어쓰기=draft seed로 에디터 재마운트 / 새로쓰기=draft 삭제 후 저장본). 액션 줄에 "임시저장됨 HH:MM"(`DraftSavedHint`). 저장 성공 시 draft 즉시 삭제. type `prepNote`로 게시판(`bulletin`)과 키 격리.
- [ ] **이미지 업로드 라이브 검증**: event-images 버킷 적용 완료 → 메인 Claude 라이브 QA 예정. 버킷 미적용 시 업로드 토스트로 graceful 실패(페이지 정상).

## 8. 현장 보고 (블록 5 — FieldReportSection 공용 컴포넌트, plain text)
- [x] 데이터 = `field_reports`(event_id로 필터, day_number ASC). 카드: 일차 칩 + 작성자 + content(pre-wrap) + 수정/삭제 IconButton.
- [x] "보고서 작성" 버튼 → 인라인 편집 영역(plain `TextField` multiline). 대시보드 `handleNew` 템플릿(0.판매/1.도서/2.검사) — 이 학회 매출(검사/도서/합계·배송비)로 자동 채움.
- [x] CRUD 전체 보존(작성·수정·삭제·누적) — Supabase 실 저장. **컴포넌트는 `FieldReportSection.jsx`(DashboardPage에서 추출 → 대시보드·L2 공용).** `canEdit` prop으로 events:edit 미보유자 읽기 전용.
- [x] **임시저장(2026-06-15)**: 신규 작성(`!editingId`)만 localStorage 자동저장(`useFormDraft('fieldReport', eventId)`, content+dayNumber+author 묶음, debounce 2초·24h 보존·userId 격리). 편집영역 닫힌 상태에서 유효 draft 있으면 "보고서 작성" 위 인라인 `DraftBanner`(이어쓰기/새로쓰기). 편집영역 액션 줄에 "임시저장됨 HH:MM"(`DraftSavedHint`). 작성 성공 시 draft 즉시 삭제. **기존 보고서 수정은 제외**(DB 원본 존재). FieldReportSection은 대시보드·L2 공용이라 동일 동작.
- [x] **빈 상태**: "생성된 보고서가 없습니다".

## 9. 매출 요약 (블록 6 — 대시보드 hero 축약판, paid만 · **지결 완료 시에만 노출**)
- [ ] **노출 조건: `events.payment_resolution_done`(지결) = true 일 때만 매출 카드 노출.** 정산 결과는 흐름의 끝 — 지결 확정 전 매출은 미확정으로 간주.
- [ ] **지결 미완료**: 매출 숨김 + 가벼운 안내 박스(중립 gray-50, 점선 아님 · 잠금 아이콘) — 제목 "지결 완료 후 매출이 표시됩니다" + 보조 "진행 상태에서 ‘지결’을 완료로 표시하면 이 학회의 검사·도서 매출이 집계됩니다". subtitle 숨김.
- [ ] 지결 완료 시:
  - [ ] 입력 = 이 event의 `orders`(status·delivery_fee·order_items[{category, price_at_purchase, quantity}]).
  - [ ] `computeRevenueByCategory(orders)` — **PAID_STATUSES(paid·completed)만** 합산. 취소/환불/미결제 제외.
  - [ ] hero `StatCard` = **총 매출액**(`revenue.total`, accent.revenue, 원).
  - [ ] sub **1~3장 동적 분할**(0원 버킷 숨김, flex:1 균등): **검사 판매**(배송비 `testShipping` 포함, accent.tests) / **도서 판매**(배송비 `bookShipping` 포함, accent.books) / **도구 판매**(배송비 `toolShipping` 포함, `CATEGORY_COLORS.tool` #6B7684, `ToolIcon`) — **도구 독립 버킷(2026-06-24 건우님 확정)**.
  - [ ] 배송비 할당 규칙 = util 정합(우선순위 **검사>도구>도서**, 한 주문 배송비는 1곳만). 면세. total = test+book+tool+unclassified.
  - [ ] subtitle = "결제 완료 주문 기준 · 배송비 포함".
  - [ ] **빈 상태**(지결 완료인데 total=0): EmptyState "아직 매출이 없어요" + "결제 완료된 주문이 생기면 …".

> 대시보드 hero의 YoY trend·오늘 접수 박스·상태바·판매 순위·최근 주문은 L2에 가져오지 않음(대시보드 고유 — L2는 이 학회 매출 합산만 축약).
> 진행상태 ‘지결’ 칩과 매출 노출이 연동 — 칩을 켜면 같은 페이지에서 즉시 매출이 나타남(시안 시연 가능).

## 10. 열람 이력 (블록 7 — master만 · 2026-06-10 신설)
- [x] 테이블 `event_views(event_id, user_id, first_viewed_at, last_viewed_at, view_count)` PK(event_id, user_id) — backend 계약. SELECT는 RLS로 **master만**.
- [x] 기록: L2 진입 시(event 로드 성공 후, slug당 1회 — `recordedIdRef` 가드) `record_event_view(p_event_id)` RPC 호출(`api/events.recordEventView`). **실패해도 무시(페이지 차단 금지).**
- [x] 표시: **master만** 보이는 "열람 이력" SectionCard(맨 아래) — A7 게시판 "읽음 현황" 표 패턴. 컬럼 = 이름(+직급 caption) / 최초 열람 / 최근 열람(`MM.dd HH:mm`, tnum) / 횟수. 정렬 = 최근 열람 desc.
- [x] 이름·직급 = `api/events.getEventViewers`가 `user_profiles(id,name,position)` 추가 조회로 병합(role 무관 — staffMap은 master/onsite만이라 미사용). 프로필 미존재 = "(삭제)".
- [x] **graceful:** 테이블/RPC 미적용 환경·비-master = select 에러 무시 → 섹션 자체 숨김. 빈 목록도 숨김.

## 11. 재사용 매핑 (실구현)
| 요소 | 출처 | 신규 여부 |
|---|---|---|
| PageHeader | `ui/PageHeader` | 재사용 |
| SectionCard | `ui/SectionCard` | 재사용 |
| StatCard(hero/sub) | `ui/StatCard` | 재사용 |
| StatusBadge(시간상태) | `ui/StatusBadge` | 재사용 |
| EmptyState(매출 0·준비노트 0·학회 미발견) | `ui/EmptyState` | 재사용 |
| 할인율 칩 | `EventManagementPage` DiscountChip 톤 | L2 로컬 복제(discount_rate→%) |
| 참석자 칩 | `EventManagementPage` AttendeeCell 톤 | L2 전체펼침 변형(`AttendeePillRow`) |
| 매출 합산 | `utils/revenueByCategory` | 재사용 |
| 현장 보고 | `FieldReportSection.jsx` | **추출(공용)** — DashboardPage·L2 import |
| 진행상태 칩 | 페이지 로컬 프리미티브 `ProgressChip` | 토큰만 |
| OverviewRow | 페이지 로컬 레이아웃 헬퍼 | 토큰만 |
| 통합 에디터 | `PrepNoteEditor.jsx`(Toast UI Editor, lazy) | **신규 라이브러리 `@toast-ui/editor`+`@toast-ui/react-editor`** |
| 통합 에디터 읽기 | `PrepNoteViewer.jsx`(Toast UI Viewer, lazy) | 동상 |
| 이미지 라이트박스 | MUI `Dialog` | 재사용(신규 라이브러리 0) |
| 날짜 요일 포맷 | 헬퍼 `weekday`/`dotDay`/`formatRange` | `getDay()` KST 자정 파싱 |
| 단건 fetch·진행상태·노트·매출주문 | `api/events.js` | **신규 함수 4종** |
| 학회 정보 수정 다이얼로그 | `EventFormDialog.jsx` | **추출(공용)** — EventManagementPage·L2 import (2026-06-10) |
| 열람 기록·열람자 조회 | `api/events.js` `recordEventView`/`getEventViewers` | **신규 함수 2종** (2026-06-10) |
| 열람 이력 표 | A7 게시판 "읽음 현황" Table 패턴 | MUI Table(신규 0) |

> ProgressChip·OverviewRow·AttendeePillRow는 페이지 로컬 소형 프리미티브(토큰만). 새 디자인 시스템 컴포넌트 추가 아님.
> **신규 라이브러리:** Toast UI 에디터/뷰어 2종(CTO 승인). React.lazy 지연 로드로 초기/공개(고객 주문) 번들 0 영향. 그 외 라이트박스 등은 MUI로 처리(신규 0).

## 12. 5곳 분산 → L2 통합 (Before/After)
| 정보 | Before (현재 위치) | After (L2) |
|---|---|---|
| 매출(검사/도서/전체) | 대시보드(전체·계층 필터로 학회 선택) | L2 매출 요약(이 학회 자동) |
| 현장 보고(작성·수정) | 대시보드 Row4(상세 행사 선택 시) | L2 현장 보고 섹션 |
| 입금결의서 | ~~대시보드 헤더(단일 행사 선택 시)~~ → 2026-06-10 대시보드 진입점 제거 | L2 헤더 액션(**유일 진입점**) |
| 지불증 | A10 행 ⋯ 메뉴 | L2 헤더 액션(⋯에도 유지 — L1 빠른 접근) |
| 개요 필드(장소·참석자·비용·비고) | A10 L1 표(압축)·다이얼로그 | L2 개요 카드(전체) |

> 효과: "이 학회 어떻게 됐지?"를 답하려고 대시보드 필터 → 결의서 → A10 ⋯ 를 오가던 동선이 한 페이지로 수렴. A10 비전 "한 학회의 모든 것이 한 페이지에"의 첫 실체.

## 13. 권한·빈상태·표시형식
- [x] `events:view` 접근. `events:edit` = 진행상태 토글 · 준비 노트 편집 · 보고 작성/수정 · 학회 정보 수정(인라인 다이얼로그) · 결의서/지불증. `master` = 열람 이력 열람 + 다이얼로그 삭제(onsite는 본인 생성만).
- [x] 잘못된/없는 slug → EmptyState "학회를 찾을 수 없어요" + "학회 목록으로".
- [x] 매출 0(지결 완료 후) / 보고 0 / 준비 노트 0 → 각 섹션 EmptyState(미래 학회 정상 케이스).
- [x] 비용 `#,##0원`("—") + 한글금액. 날짜 `YYYY.MM.DD(요일)` 점 표기 + 요일. 숫자 tnum.

## 14. 확인 필요 (후속 결정 사항)
- [x] (Q1) 입금결의서·지불증 버튼: **항상 노출**(실구현). 입금결의서는 클릭 시 주문 조회→ExcelJS.
- [ ] (Q2) 진행상태 토글 변경 시 audit log 기록 여부 / 변경자·시각 표기 여부. (실구현=update만, 변경자 미기록)
- [x] (Q3) 통합 에디터 저장 포맷 = **HTML**(Toast UI getHTML). 이미지 = **event-images 버킷**(비공개+서명 URL). 적용 완료.
- [ ] (Q4) 매출 요약에 판매 순위(검사/도서 top)를 L2에도 둘지 — 실구현은 hero+2장만(대시보드와 중복 회피). 건우님 판단.
- [x] (Q5) 헤더 날짜 ↔ 개요 날짜 중복 = **유지**(의도된 중복).
- [ ] (Q6) ⋯행 메뉴(L1)와 L2 헤더 액션의 지불증 중복 — 둘 다 유지(현재). 일원화 여부 판단.
- [x] (Q7) 매출 노출 조건 = 지결(payment_resolution_done) 단독.
- [x] (Q8/Q9/Q10) 준비물 prep_items 폐기 → 통합 에디터 prep_note(text) 단일 컬럼. 체크 주체·시각 미기록(에디터 task). 이미지 = event-images 버킷 단일.
- [x] (Q11) **학회 정보 수정** = ~~L1 목록 이동~~ → **해결(2026-06-10 건우님 "버그네, 수정하자").** 다이얼로그를 `EventFormDialog.jsx`로 추출해 L1·L2 공용. L2는 인라인 오픈 + 저장 시 재조회(slug 변경 시 새 주소 이동).

## 15. 결정 이력
- 2026-06-08 — L2 1차 시안 신설(EventDetailPreview). 에디터·이미지 2차로 분리. 진행상태=3 독립 boolean(마이그레이션 적용). 매출=paid만 hero 축약. (product-designer)
- 2026-06-08 — **1차 시안 v2(건우님 피드백 4건).** ①날짜 요일 ②매출=지결 완료 시에만 ③준비물 체크리스트 ④학회 자료 섹션. (product-designer)
- 2026-06-08 — **실구현 완료(frontend-engineer).** 건우님 결정으로 **준비물 위젯+학회자료 → 통합 Toast UI 에디터 1칸**(prep_note·event-images 버킷)으로 대체. 진행상태 실 토글, 매출 실 집계, FieldReportSection 추출(공용), slug 라우팅 분기, 이미지 라이트박스(MUI). 섹션 순서 = 개요→진행→준비 노트→현장보고→매출.
- 2026-06-10 — **준비노트 이미지 서명 URL 만료 리팩터(건우님 확정, frontend-engineer).** 본문 저장 = 1년 서명 URL 직저장 → **경로 플레이스홀더 저장 + 렌더 시 배치 재서명(TTL 6시간)**. 공용 유틸 `utils/prepNoteImages.js`(encodeForStorage/resolveForDisplay) + 단위테스트 17건. 레거시 노트 자연 치유(마이그레이션 불필요).
- 2026-06-10 — **events 클러스터 4건(건우님 확정, frontend-engineer).** ① 학회 정보 수정 = `EventFormDialog.jsx` 공용 추출 → L2 인라인 수정(Q11 해결, 목록 이동 버그 폐기) ② 입금결의서 진입점 L2 일원화(대시보드 버튼 소거) ③ 다이얼로그 날짜 3필드(시작/종료/배송예정) = 공용 `ui/DateField`(single 캘린더, `YYYY.MM.DD(요일)` 표시·클리어 가능 — 빈 날짜는 null 저장) ④ 열람 이력 §10 신설(`event_views` + `record_event_view` RPC, master만, graceful).
