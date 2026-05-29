# 사양 시트 — C2 고객 주문 조회 (OrderLookupPage)

## ⚠️ 폐기됨 (2026-05-29) — 라우트 미등록·RLS 회수·보안 약함으로 건우님 결정 폐기
> 실 컴포넌트 `OrderLookupPage.jsx` 삭제됨. 본 시트는 히스토리 보존용으로만 유지된다. 신규 작업 금지.

> 이 시트는 고객 주문 조회 화면의 정보·기능·데이터 구조의 단일 진실 소스다.
> 시안과 실서비스 구현은 이 시트의 모든 항목을 1:1로 반영해야 한다.
> 임의 단순화·통합·생략은 건우님의 명시적 승인 후 이 시트를 먼저 갱신한 다음에만 허용된다.
> 마지막 갱신: 2026-05-13 신설 (M2 시안 착수 사전 정독).

## 참조 파일
- 실 컴포넌트: `inpsyt-order-frontend/src/components/OrderLookupPage.jsx` (255줄, 단일 파일)
- 진입 라우트: `inpsyt-order-frontend/src/App.jsx` — **현재 라우트 미등록.** App.jsx에 `OrderLookupPage` import도 Route 선언도 없음. 컴포넌트는 빌드에는 포함되지 않지만 코드는 존재. **확인 필요** — 운영 중 진입 경로가 무엇인지(과거 라우트 제거 후 잔존 파일인지, 향후 부활할 화면인지) 건우님 확정 필요.
- 상태 상수: `inpsyt-order-frontend/src/constants/orderStatus.js` (`STATUS_TO_KOREAN`, `STATUS_COLORS`)
- DB 정책: `supabase/migrations/20260406_allow_public_order_lookup.sql` → `20260407_rls_token_based_access.sql`로 anon SELECT 정책이 **DROP** 됨. 즉 현 DB 상태에서는 anon 사용자가 `from('orders').select(...)` 를 직접 호출할 수 없음. **이 페이지는 RLS상 작동 불가 상태 — 확인 필요.** (토큰 RPC 화면 C3와 달리 이 화면은 customer_name·phone_number 평문 조회를 anon으로 시도)
- DB 스키마: `supabase/migrations/20250722070000_create_orders_table.sql` + 후속 마이그레이션 (C1 시트 참조)

## 사용자 시나리오
의료 학회 부스에서 본인 모바일로 주문서를 제출한 의사·연구자가, 결제 직후 받은 카카오 알림톡을 잃거나 휴대폰을 바꿔 토큰 URL이 사라졌을 때 본인의 이름·연락처로 주문을 다시 찾는 화면이다. 알림톡 링크(`/order/status/{token}`)가 1차 경로이므로 이 화면은 백업 경로다. 1차 사용자는 50대 의사 — 본인 이름·연락처는 정확히 기억한다는 전제. 학회 슬러그(`?events={slug}`)가 함께 들어오면 해당 학회의 주문으로 범위가 좁혀지고, 없으면 모든 학회의 주문을 검색한다. 결과 카드를 탭하면 C3(`/order/status/{token}`)로 이동.

> **현재 라우트 미등록 상태 (위 확인 필요 항목). 시안 작업은 컴포넌트 코드가 정의한 사양을 기준으로 그리되, 배포 여부는 건우님 결정.**

## 진입 흐름
- [ ] 현재 App.jsx 라우트 표에 진입 경로 없음 — **확인 필요.** 알림톡 본문에도 이 경로가 박혀 있지 않음(`api/alimtalk.js:30`이 `/order/status/{token}`만 사용).
- [ ] 컴포넌트가 정의한 진입 시 동작: `useSearchParams`로 `events` 쿼리 파라미터를 읽음 (`OrderLookupPage.jsx:17`).
- [ ] `events` 슬러그가 있으면 `events` 테이블에서 `order_url_slug = eventSlug` 단일 행을 조회해 `eventInfo`(`{ id, name }`) 저장 (`OrderLookupPage.jsx:27-35`). 실패해도 화면 자체는 그대로 떠 있고, "모든 학회 주문 검색" 모드로 fallback.
- [ ] 슬러그가 유효해도 헤더 부제와 본문 안내문에 학회명이 노출될 뿐, 입력 차단·접근 차단은 없음. C1과 달리 만료·존재 여부 검증은 없음.

## 표시 정보 (라벨 단위, 누락 금지)

### 페이지 컨테이너 (line 86-95)
- [ ] `maxWidth: 480` 가운데 정렬 (C1의 600보다 좁음 — 모바일 전제가 더 강함). `minHeight: 100dvh`, `bgcolor: background.paper`, `display: flex`, `flexDirection: column`

### 헤더 (line 96-107)
- [ ] 좌측 `IconButton` `ArrowBackIcon` (`text.secondary`, p 10px) — `navigate(-1)` 동작
- [ ] 페이지 제목: "주문내역 조회" — `variant="h5"`, `component="h1"`, `fontWeight: 700`, `lineHeight: 1.2`
- [ ] 부제(조건부, `eventInfo` 있을 때): "{이벤트명}" — `variant="caption"`, `color: text.secondary`
- [ ] 헤더 내부 `px: 2 pt: 3 pb: 2`, `display: flex`, `alignItems: center`, `gap: 1`

### 안내문 (line 110-114)
- [ ] 본문 영역 `px: 3 py: 1 flex: 1`
- [ ] 안내 텍스트 — `variant="body2"`, `color: text.secondary`, `lineHeight: 1.7`, `mb: 3`
  - `eventInfo` 있을 때: "{이벤트명} 주문 시 입력하신 이름과 연락처로 조회합니다."
  - 없을 때: "주문 시 입력하신 이름과 연락처로 조회합니다."

### 입력 폼 (line 117-135)
- [ ] `Box`, `display: flex`, `flexDirection: column`, `gap: 2`, `mb: 2`
- [ ] 필드 1: **이름** — `TextField label="이름"`, fullWidth, `autoComplete="name"`, Enter 키로 조회 트리거 (`handleKeyDown`)
- [ ] 필드 2: **연락처** — `TextField label="연락처"`, fullWidth, `placeholder="010-1234-5678"`, `maxLength: 13`, Enter 키 트리거
  - 자동 하이픈 포맷팅 (`formatPhone`, line 37-42): 3-4-4, C1과 동일 규칙

### 에러 알림 (line 137-139)
- [ ] `Alert severity="error"`, `mb: 2`, `borderRadius: '12px'` — 폼 검증 실패 또는 쿼리 실패 시 노출
- [ ] 메시지:
  - 빈 입력: "이름과 연락처를 모두 입력해주세요." (`OrderLookupPage.jsx:46`)
  - 쿼리 실패: "조회 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요." (line 72)

### 조회 버튼 (line 141-151)
- [ ] `variant="contained"`, fullWidth, size large, `minHeight: 48`, `borderRadius: '12px'`, `mb: 3`
- [ ] 시작 아이콘: 로딩 중 `CircularProgress` size 18 color inherit / 평소 `SearchIcon`
- [ ] 라벨: "조회하기" (단일, 상태 변화 없음 — 제출 중에도 라벨 동일, 아이콘만 스피너로 교체)
- [ ] `disabled={loading}` — 중복 호출 차단
- [ ] **인라인 라운드 12 (`'12px'`) — M1 토큰 `radius-button=8`로 흡수 대상**

### 초기 안내 (line 153-159, `orders === null` AND 조회 전)
- [ ] 가운데 정렬, `py: 4`, `color: 'text.disabled'`
- [ ] 큰 이모지 — 클립보드 이모지, `fontSize: '2rem'`, `mb: 1`
- [ ] 본문: "주문 시 입력한 이름과 연락처로 조회할 수 있어요" — `variant="caption"`

### 결과 — 빈 결과 (line 162-172, 조회 후 결과 0건)
- [ ] 가운데 정렬, `py: 5`
- [ ] 큰 이모지 — 돋보기 이모지, `fontSize: '2.5rem'`, `mb: 1`
- [ ] 제목: "일치하는 주문을 찾을 수 없습니다" — `variant="body2"`, `fontWeight: 600`, `mb: 0.5`
- [ ] 본문: "이름과 연락처를 다시 확인해주세요." — `variant="caption"`, `color: text.secondary`

### 결과 — 카드 리스트 (line 173-247, 조회 후 결과 1건 이상)
- [ ] 컨테이너 `display: flex`, `flexDirection: column`, `gap: 1.5`
- [ ] 상단 카운트 텍스트: "{N}건의 주문을 찾았습니다" — `variant="caption"`, `color: text.secondary`
  - 단 N은 **부모-자식 그룹핑 후 visible 카운트** (아래 참조)
- [ ] 카드(주문 1건당, line 187-242):
  - 보더 1px divider, `borderRadius: '12px'`, `boxShadow: none`, hover 시 `boxShadow: 3` + `borderColor: 'primary.main'`, transition all 0.15s
  - 클릭 시 `navigate('/order/status/{access_token}')`
  - 내용 영역 `p: 2`
  - 상단 행:
    - 좌측 Stack(0.75 gap):
      - 학회명 (`order.events?.name || '학회'`) — `variant="body2"`, `fontWeight: 600`
      - "추가 주문" 칩 (조건부 `isChildOnly`, 즉 `parent_order_id` 있고 부모가 결과에 없을 때) — `bgcolor: primary.main`, 흰 텍스트, `fontWeight: 700`, `fontSize: '0.65rem'`, `height: 18`, `borderRadius: '6px'`
      - "연계 주문 포함" 칩 (조건부 `hasChildren(order)`, 즉 이 주문이 결과 안에 child를 보유할 때) — `bgcolor: '#F5F6F8'`, `text.secondary`, `fontWeight: 600`, `fontSize: '0.65rem'`, `height: 18`, `borderRadius: '6px'`
    - 우측 상태 칩: `STATUS_TO_KOREAN[order.status]` — `bgcolor: statusColor + '22'`(투명도 22hex), `color: statusColor`, `fontWeight: 700`, `fontSize: '0.68rem'`, `height: 20`
      - 상태 색 매핑(`STATUS_COLORS`): pending `#F59E0B` / paid `#10B981` / completed `#6366F1` / cancelled `#EF4444` / refunded `#F43F5E`
      - 상태 라벨(`STATUS_TO_KOREAN`): 결제대기 / 결제완료 / 처리완료 / 주문취소 / 결제취소
  - 하단 행:
    - 좌측: 접수 일시 "yyyy.MM.dd HH:mm" + " · 상품 {N}개" (`totalItems = order_items의 quantity 합`) — `variant="caption"`, `color: text.secondary`
    - 우측: `final_payment` 원 — `variant="caption"`, `fontWeight: 700`, `color: primary.main`

### 부모·자식 그룹핑 규칙 (line 175-180)
- [ ] `parent_order_id` 있는 주문만 골라 그 parent id 셋 `parentIds` 구성
- [ ] `visible` = 결과 중 `(parent_order_id 없음) OR (parent_order_id의 부모 주문이 결과에 포함되지 않음)`
  - 즉 부모와 자식이 모두 결과에 들어오면 부모만 노출, 자식은 부모 카드의 "연계 주문 포함" 칩으로만 표시
  - 부모가 결과에 없는 외톨이 자식은 "추가 주문" 칩과 함께 단독 노출
- [ ] `hasChildren(order)` = `parentIds.has(order.id)`

## 액션·기능 (누락 금지)

- [ ] 진입 후 `eventSlug` 있으면 `events` 단일 행 조회 — 실패 무시(화면 정상 노출)
- [ ] 이름 입력: 일반 텍스트, Enter 키로 조회 트리거 (`handleKeyDown`)
- [ ] 연락처 입력: `formatPhone`로 입력마다 010-XXXX-XXXX 자동 포맷, Enter 키로 조회 트리거, `maxLength: 13`
- [ ] 조회 버튼 클릭(또는 Enter 키): `handleSearch` 호출
  1. trim 후 이름·연락처 둘 다 비어 있지 않은지 검증, 빈 칸 있으면 에러 표시 후 종료
  2. `setLoading(true)`, `setError(null)`
  3. `supabase.from('orders').select(...)` 쿼리:
     - 컬럼: `id, access_token, created_at, status, final_payment, parent_order_id, events(name), order_items(quantity, products(name))`
     - `.eq('customer_name', name.trim())`
     - `.eq('phone_number', phone.trim())`
     - `eventInfo?.id` 있으면 `.eq('event_id', eventInfo.id)`
     - `.order('created_at', { ascending: false })`
  4. 결과 `setOrders(data || [])`
  5. 예외 시 "조회 중 오류가 발생했습니다…" 노출
- [ ] 카드 클릭: 해당 주문의 `access_token`으로 `/order/status/{token}` 이동
- [ ] 뒤로가기 IconButton: `navigate(-1)` — 히스토리 직전 페이지로

### 보안·RLS 정합성 (확인 필요)
- [ ] **현 RLS 상태에서 이 쿼리는 실패한다.** `20260407_rls_token_based_access.sql`이 anon의 orders SELECT 정책을 DROP하고 토큰 RPC만 허용했다. customer_name·phone_number 평문 매칭 쿼리는 anon으로 통과하지 못함.
- [ ] 시안 작업 전에 결정해야 할 것:
  1. 화면을 부활시키되 RPC(`get_orders_by_customer(name, phone)` 등 평문 매칭) 추가로 재구성
  2. 또는 페이지 자체 폐기 — 알림톡 토큰 링크만 유일 경로로 운영
- [ ] **CPO 권고는 별도 보고에서 다룸. 여기는 사양 시트이므로 사실만 기록.**

## 입력 폼 구조 (분리/통합 절대 금지)

- [ ] `name` — 단일 텍스트 필드 (이름 단일, 성+이름 분리 없음)
- [ ] `phone` — 단일 텍스트 필드, 자동 하이픈 포맷팅
- [ ] **`eventSlug`(URL 쿼리)** — 입력 필드 아니지만 검색 조건 영향. UI에 노출되지 않고 헤더 부제·안내문에서만 학회명으로 간접 노출.

## 권한별 차이

이 페이지는 **공개 화면**(고객용). 인증 없이 접근 가능. master/editor/viewer 등 어드민 권한 컨텍스트는 무관.

## 데이터 모델

### 조회 대상 — `orders` 테이블 (C1 시트의 데이터 모델 참조)
- 사용 컬럼:
  - `id` — 정렬·중복 식별·자식 매칭
  - `access_token` (uuid) — 카드 클릭 시 C3로 이동하는 URL 키
  - `created_at` (timestamptz) — 카드 하단 일시 표시
  - `status` (text) — 5단계(`pending`/`paid`/`completed`/`cancelled`/`refunded`)
  - `final_payment` (numeric) — 카드 우측 하단 금액
  - `parent_order_id` (bigint, nullable) — 연계 주문(합배송) 그룹핑 키. **마이그레이션 파일 단독 확인 안 됨 — 확인 필요** (코드·다른 쿼리에서는 사용 중)
  - `customer_name` (text) — `eq` 매칭
  - `phone_number` (text) — `eq` 매칭. 입력값은 자동 포맷팅된 하이픈 포함 문자열. DB의 phone_number도 하이픈 포함 문자열로 저장된다는 전제(C1·C3·관리자 화면들도 같은 포맷 사용)
  - `event_id` (bigint) — 조건부 `eq` 매칭
- 조인:
  - `events(name)` — 학회명
  - `order_items(quantity, products(name))` — 카드 상품 개수 표시용. 상품명은 사용하지 않음(개수 합산만)

### `events` 테이블 (조회만)
- `id`, `name`, `order_url_slug`

## 필터·뷰 모드
- [ ] 학회 컨텍스트 필터: `eventInfo?.id` 있으면 단일 학회로 좁힘, 없으면 모든 학회
- [ ] 정렬: 접수일시 내림차순 (변경 옵션 없음)
- [ ] 페이지네이션 없음 — 전체 결과 한 번에 표시 (개인이 같은 이름·연락처로 8일 학회에서 만드는 주문 수가 극소수라는 전제, 연 800건 규모 가정)

## 빈 상태·로딩·오류 처리

- [ ] 조회 전: 초기 안내(클립보드 이모지 + 카피)
- [ ] 조회 중: 버튼 시작 아이콘이 `CircularProgress`로 교체, 버튼 disabled
- [ ] 결과 0건: 돋보기 이모지 + "일치하는 주문을 찾을 수 없습니다" + 보조 카피
- [ ] 폼 검증 실패: 상단 `Alert severity="error"` ("이름과 연락처를 모두 입력해주세요.")
- [ ] 쿼리 실패: 동일 `Alert` ("조회 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.")
- [ ] 학회 슬러그 무효: 화면 자체는 정상, 안내문만 일반 문구로 fallback (오류 표시 없음)
- [ ] RLS 거부(현 상태): UI에서는 "조회 중 오류가 발생했습니다…"로 표시될 가능성. **확인 필요** — 실제로 정책 거부가 어떻게 전달되는지 (빈 배열 또는 throw)

## 핵심 발견 (시안 검수 시 반드시 확인)

1. **이 페이지는 현재 App.jsx 라우트에 등록되어 있지 않다.** 컴포넌트 코드는 존재하지만 진입 경로가 없고, 알림톡 본문도 C3(토큰 페이지)만 가리킨다. 시안 작업 전에 "부활/폐기/대체 형태" 결정 필요.
2. **이 페이지의 anon 쿼리는 현 RLS와 충돌한다.** `20260407_rls_token_based_access.sql`이 anon SELECT 정책을 제거했기 때문. 부활시키려면 토큰 없이도 안전한 RPC가 필요하다.
3. **부모·자식 주문 그룹핑 로직이 클라이언트에 있다.** 결과 후처리로 부모/자식 가시성을 다시 계산한다. "추가 주문"·"연계 주문 포함" 칩은 이 로직의 산출물 — 시안에서 빠뜨리면 합배송 표현이 깨진다.
4. **상태 색 5종이 코드에 인라인 hex(`#F59E0B` 등)로 박혀 있다.** M2 시안에서 status 토큰 표준화 대상. 카드 상태 칩의 `+ '22'` 알파 hex 합성도 토큰화 검토 필요.
5. **카드 라운드 12, 칩 라운드 6 등 인라인 px이 다수.** M1 토큰(`radius-md=10`, `radius-pill` 또는 `radius-chip`) 정의에 맞춰 흡수 대상.
6. **결과 카드의 학회명 표시는 `events?.name || '학회'` fallback 문자열을 쓴다.** 학회 데이터가 사라진 옛 주문이 "학회"라는 일반 명사로만 표시될 수 있음. 시안에서는 정상 케이스(학회명) 위주로 그리되 fallback 케이스 존재를 인지.
7. **카드 우측 금액은 `final_payment`만 표시.** 합배송된 경우 자식 카드를 숨기더라도 부모 final_payment에 자식 금액이 합산돼 있지 않음 — 단순 부모 금액. 사용자에게는 카드 한 장당 단일 결제 행으로 표현됨. 시안에서 "합산 금액" 표현을 추가하려면 데이터 계산 추가 필요.

## 변경 이력
- 2026-05-13 신설 — M2 시안 착수 사전 정독. `OrderLookupPage.jsx` 전수 + App.jsx 라우트 표 + RLS 마이그레이션 + 알림톡 발송 코드 교차 확인. 라우트 미등록·RLS 충돌·DB 파일 단독 확인 불가 항목은 "확인 필요"로 표기.
