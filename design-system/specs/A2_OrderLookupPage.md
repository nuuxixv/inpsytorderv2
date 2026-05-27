# 사양 시트 — A2 고객 주문 조회 (OrderLookupPage)

> 이 시트는 고객 주문 조회 화면의 정보·기능·데이터 구조의 단일 진실 소스다.
> 시안과 실서비스 구현은 이 시트의 모든 항목을 1:1로 반영해야 한다.
> 임의 단순화·통합·생략은 건우님의 명시적 승인 후 이 시트를 먼저 갱신한 다음에만 허용된다.
> 마지막 갱신: 2026-05-26 신설 (M2 고객용 시안 착수 사전 정독).

## 참조 파일
- 실 컴포넌트: `inpsyt-order-frontend/src/components/OrderLookupPage.jsx` (255줄)
- **라우트 등록 상태: `inpsyt-order-frontend/src/App.jsx` 에 `/order/lookup` 라우트 없음.** 컴포넌트는 import 되지 않으며 어디서도 호출되지 않는다 — Grep으로 확인 (Glob: OrderLookupPage 정의 파일만 매치). **확인 필요.**
- 상태 상수: `inpsyt-order-frontend/src/constants/orderStatus.js` (`STATUS_TO_KOREAN`, `STATUS_COLORS`)
- 결과 클릭 시 이동: `/order/status/{access_token}` (line 194) — A2 OrderStatusPage로 연결
- 페어 시트: `design-system/specs/A2_OrderStatusPage.md`
- DB 스키마: `supabase/migrations/20250722070000_create_orders_table.sql` + `20250805_add_new_order_fields.sql` + `20260406_add_access_token_to_orders.sql`
- RLS 관련: `supabase/migrations/20260406_allow_public_order_lookup.sql` (anon SELECT 허용) → `20260407_rls_token_based_access.sql` (anon SELECT 다시 차단)

## 사용자 시나리오
의료 학회 부스에서 주문을 마친 고객(의사·연구자)이 알림톡 링크를 분실하거나 받지 못했을 때, 또는 며칠 후 주문 내역을 다시 확인하고 싶을 때 직접 진입한다. 본인이 입력한 이름과 연락처 두 가지로 자기 주문을 검색해서 결과 카드에서 하나를 골라 A2 OrderStatusPage(`/order/status/{token}`)로 이동한다. 학회 슬러그(`?events={slug}`)와 함께 진입했을 때는 해당 학회의 주문만 검색하도록 자동 필터링된다. 인증 없는 공개 화면이지만 결과 카드의 `access_token`을 받아내야 상세 화면에 갈 수 있다.

## 진입 흐름
- [ ] `/order/lookup` 직접 진입(예정) — **현재 라우트가 App.jsx에 등록돼 있지 않음. 컴포넌트 자체는 `useSearchParams`로 `events` 쿼리만 읽음. 확인 필요.**
- [ ] `/order/lookup?events={slug}` 학회 필터 진입(예정) — `eventSlug`로 `events` 테이블 단일 조회 후 결과를 `event_id`로 추가 필터 (line 27-35, 64-66)
- [ ] 어디서 들어오는가 — 현 코드는 어디에서도 `/order/lookup` 으로 navigate하거나 a 링크하지 않는다 (Grep 검증). 알림톡 분실 안내·FAQ 등 외부 통로 또는 URL 직접 입력만 가능한 상태. **시안 진행 전에 라우트 등록·진입 동선(어드민 안내 페이지·푸터 링크 등) 정책 결정 필요. 확인 필요.**

## 표시 정보 (라벨 단위, 누락 금지)

### 헤더 (line 96-107)
- [ ] 좌측 뒤로 가기 아이콘 버튼 — `ArrowBackIcon`, `color: text.secondary`, p 10px, `navigate(-1)` (line 98-100)
- [ ] 페이지 제목 — “주문내역 조회” (h5, fontWeight 700, lineHeight 1.2, line 102)
- [ ] 학회 부제(조건부, `eventInfo` 있을 때) — `eventInfo.name` (caption, text.secondary, line 104)

### 안내 문구 (line 110-114)
- [ ] body2, text.secondary, mb 3, lineHeight 1.7
- [ ] `eventInfo` 있을 때: “{eventInfo.name} 주문 시 입력하신 이름과 연락처로 조회합니다.”
- [ ] 없을 때: “주문 시 입력하신 이름과 연락처로 조회합니다.”

### 검색 입력 폼 (line 117-135)
- [ ] 세로 스택, gap 2, mb 2
- [ ] 필드 1: **이름** — `TextField` 라벨 “이름”, value `name`, `autoComplete="name"`, fullWidth
  - `onKeyDown`에 Enter → `handleSearch` (line 78-80)
- [ ] 필드 2: **연락처** — `TextField` 라벨 “연락처”, value `phone`, placeholder “010-1234-5678”, fullWidth, `inputProps.maxLength=13`
  - 자동 포맷팅 `formatPhone` (line 37-42): 3-4-4 패턴 하이픈, 숫자만 추출
  - Enter → `handleSearch`
- [ ] **두 필드는 분리된 단일 필드.** 이름은 성+이름 분리 안 함. 연락처는 단일 필드에 하이픈 자동 삽입. C1 OrderPage의 입력 폼 분리 구조와 1:1 매칭.

### 에러 Alert (line 137-139, 조건부)
- [ ] `error` 상태 있을 때만 노출
- [ ] `Alert severity="error"`, mb 2, borderRadius 12px
- [ ] 메시지 종류:
  - “이름과 연락처를 모두 입력해주세요.” — 빈 값 검증 (line 46)
  - “조회 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.” — Supabase query 에러 (line 72)

### 조회 버튼 (line 141-151)
- [ ] `Button variant="contained"`, fullWidth, size large, minHeight 48, borderRadius 12px, mb 3
- [ ] 라벨 “조회하기”
- [ ] 시작 아이콘: 로딩 중이면 `CircularProgress` size 18 color inherit, 아니면 `SearchIcon`
- [ ] `disabled`: `loading` 중일 때만 (입력값 부족은 클릭 후 Alert로 안내)

### 초기 안내(검색 전, `orders === null`, line 154-159)
- [ ] 가운데 정렬, py 4, color text.disabled
- [ ] 📋 이모지 (fontSize 2rem, mb 1)
- [ ] caption “주문 시 입력한 이름과 연락처로 조회할 수 있어요”

### 결과 영역 (line 162-249)

#### 결과 없음(`orders.length === 0`, line 163-172)
- [ ] 가운데 정렬, py 5
- [ ] 🔍 이모지 (fontSize 2.5rem, mb 1)
- [ ] 본문 “일치하는 주문을 찾을 수 없습니다” (body2, fontWeight 600, mb 0.5)
- [ ] 보조 “이름과 연락처를 다시 확인해주세요.” (caption, text.secondary)

#### 결과 있음(line 173-247)
- [ ] 결과 카운트 캡션 (line 183-185, caption text.secondary): “{visible.length}건의 주문을 찾았습니다”
- [ ] 카드 리스트 (gap 1.5)

#### 결과 합배송 묶음 규칙 (line 175-180)
- [ ] `parentIds` 집합: 결과 중 `parent_order_id` 있는 주문들의 parent id 모음
- [ ] `visible` 필터링: `parent_order_id`가 없거나, parent_order_id가 결과에 포함되지 않은 child만 남김 (parent가 결과에 같이 있으면 child는 숨김 → parent 카드에 통합 표시)
- [ ] `hasChildren(order)`: 해당 주문의 id가 `parentIds`에 들어있으면 true (현재 카드가 parent다)

#### 결과 카드 (line 187-243, 카드마다 반복)
- [ ] `Card` 클릭 → `navigate(/order/status/{access_token})` (line 194)
- [ ] 카드 스타일: radius 12px, cursor pointer, 1px divider 보더, boxShadow none, hover 시 boxShadow 3 + 보더 `primary.main`, 0.15s 트랜지션
- [ ] CardContent: p 2, last-child pb 2
- [ ] 상단 행 (line 206-229):
  - 좌측 stack:
    - 학회명 (body2, fontWeight 600) — `order.events?.name || 학회 fallback`
    - 칩 “추가 주문” (조건부 `isChildOnly`): parent가 결과에 없는 단독 child일 때만 (즉 `parent_order_id` 있는데 parent를 결과에서 찾지 못한 child). `primary.main` 배경, 흰 글씨, fontWeight 700, fontSize 0.65rem, height 18, radius 6
    - 칩 “연계 주문 포함” (조건부 `hasChildren(order)`): 본 카드가 parent이고 child가 결과에 있을 때. 배경 `#F5F6F8`, text.secondary, fontWeight 600, fontSize 0.65rem, height 18, radius 6
  - 우측 상태 칩 (`Chip` size small):
    - 라벨 `STATUS_TO_KOREAN[status]` 또는 raw status fallback
    - 색: `STATUS_COLORS[status]` (없으면 `#8B95A1`). 배경 `statusColor + 22` (alpha hex), 글씨 색 statusColor, fontWeight 700, fontSize 0.68rem, height 20
- [ ] 하단 행 (line 230-239):
  - 좌측 (caption, text.secondary): “{yyyy.MM.dd HH:mm} · 상품 {totalItems(order)}개”
  - 우측 (caption, fontWeight 700, primary.main): “{final_payment} 원” (천 단위 콤마)

### 컨테이너 (line 86-95)
- [ ] `Box` maxWidth 480, 가운데 정렬, minHeight 100dvh, bgcolor background.paper, flex column

## 액션·기능 (누락 금지)

### 진입 시
- [ ] 쿼리 `events` 추출 — `useSearchParams` (line 17)
- [ ] `eventSlug` 있으면 `events` 테이블에서 `order_url_slug = eventSlug` 단일 조회. 결과 있으면 `setEventInfo({id, name})` (line 27-35). 학회 부제·필터 둘 다에 사용.

### 입력 처리
- [ ] 이름: 그대로 `setName`
- [ ] 연락처: `formatPhone`으로 하이픈 삽입 후 `setPhone` — 숫자만 추출 → 3자리 / 7자리 경계로 하이픈 (line 37-42)
- [ ] Enter 키 → `handleSearch` 호출 (line 78-80)

### 조회 (`handleSearch`, line 44-76)
- [ ] 빈 값 검증 — `name.trim()` 또는 `phone.trim()` 비어 있으면 에러 “이름과 연락처를 모두 입력해주세요.” + return (line 45-48)
- [ ] `setLoading(true)` + `setError(null)`
- [ ] Supabase query — `orders` 테이블 SELECT (line 52-61):
  - 컬럼: `id, access_token, created_at, status, final_payment, parent_order_id`
  - join: `events(name)`
  - join: `order_items(quantity, products(name))`
  - 필터: `customer_name = name.trim()` AND `phone_number = phone.trim()`
  - 정렬: `created_at` 내림차순
- [ ] `eventInfo.id` 있으면 `event_id = eventInfo.id` 추가 필터 (line 64-66) — 학회 컨텍스트 진입일 때
- [ ] 결과 `setOrders(data || [])`
- [ ] 에러: `setError(조회 중 오류 안내)`
- [ ] 완료: `setLoading(false)`

### **RLS 보안 모델과의 충돌 (확인 필요)**
- [ ] 현 `handleSearch`는 `supabase.from('orders').select(...)` 으로 **직접 SELECT**를 시도한다 (line 52).
- [ ] 마이그레이션 `20260406_allow_public_order_lookup.sql` 에서 anon에게 `orders` SELECT를 허용했으나, **다음날 `20260407_rls_token_based_access.sql` 이 anon SELECT 정책을 다시 DROP** 하고 `get_order_by_token` SECURITY DEFINER 함수만 허용함. 즉 anon 컨텍스트에서 `orders` 테이블 직접 SELECT는 현재 RLS상 차단된다.
- [ ] 따라서 익명 사용자가 `OrderLookupPage`를 사용하면 RLS에 막혀 빈 결과가 반환될 가능성이 높다 (또는 에러). 라우트 등록이 안 된 것도 이 한계 때문일 수 있음. **시안 작업 전에 (A) 라우트 자체를 폐기할지, (B) 새 RPC `lookup_orders_by_name_phone` 같은 SECURITY DEFINER 함수를 추가할지, (C) 어드민 전용으로 옮길지 결정 필요. 본 시트는 현재 코드 표시만 기록.**

### 결과 카드 클릭
- [ ] `navigate(/order/status/{access_token})` — A2 OrderStatusPage로 이동 (line 194)
- [ ] 단일 클릭. hover 트랜지션은 시각 신호만, 클릭 없으면 이동 안 함.

## 입력 폼 구조 (분리/통합 절대 금지)

- [ ] `name` — 단일 `TextField` (성+이름 분리 안 함). C1 OrderPage의 `customer_name` 필드와 1:1 매칭.
- [ ] `phone` — 단일 `TextField`, 클라이언트 사이드에서 010-XXXX-XXXX 자동 포맷팅. C1 OrderPage의 `phone_number` 필드와 1:1 매칭.
- [ ] **시안에서 이름을 성/이름으로 분리하거나, 연락처를 휴대폰/지역번호로 쪼개는 임의 변형 금지.** OrderPage 입력 폼이 단일 필드이고 DB 컬럼도 단일이기 때문에, 조회 폼이 분리되면 매칭이 불가능.
- [ ] **비밀번호·생년월일·이메일 등 추가 인증 필드 없음.** 시안에서 본인 인증 강화 의도로 추가 필드를 그리면 코드 동기 필요. 현재는 이름+연락처 두 필드의 정확 매치(`.eq(...)`)로만 본인 확인. **이 정책은 보안 측면에서 약함(추측 공격에 취약). 확인 필요.**

## 권한별 차이

- **공개 화면 (anon).** 인증 없이 접근. 단, 위 RLS 충돌 항목으로 인해 anon 컨텍스트에서 실제 결과 조회가 차단될 가능성. **확인 필요.**
- 학회 슬러그(`?events=`) 유효성은 검증 안 함. 슬러그가 잘못되어 `eventInfo`가 비면 필터링만 안 되고 조회 자체는 진행됨.
- 로그인 사용자 컨텍스트(`master`/`editor`/`viewer`)는 본 페이지와 무관.

## 데이터 모델

### `orders` 테이블 (조회용 SELECT 컬럼)
- `id` (bigint) — 카드 key
- `access_token` (uuid) — 결과 카드 클릭 시 상세 화면 URL 키
- `created_at` (timestamptz) — 결과 카드 날짜 표시
- `status` (text) — `STATUS_TO_KOREAN` 매핑 + `STATUS_COLORS` 색
- `final_payment` (numeric) — 결과 카드 금액
- `parent_order_id` (bigint, nullable) — 합배송 묶음 처리
- `customer_name` (text) — 필터 키 (정확 일치)
- `phone_number` (text) — 필터 키 (정확 일치, 하이픈 포함)
- `event_id` (bigint) — eventInfo 진입 시 필터 키

### join 데이터
- `events(name)` — 결과 카드 학회명
- `order_items(quantity, products(name))` — `totalItems` 계산용 (`reduce(sum, i) => sum + i.quantity`). 상품명은 현 코드에서 표시되지 않음 (join 시 select하지만 카드에 노출 안 함). **확인 필요 — 상품명을 결과 카드에 보일지 정책 결정.**

### `events` 테이블 (eventSlug 진입 시)
- `id`, `name`, `order_url_slug`

### 필드 매핑 — OrderPage 입력 폼과의 정합
- 입력 “이름” → `customer_name` 컬럼 — OrderPage Step 1의 `name` 필드와 동일 컬럼
- 입력 “연락처” → `phone_number` 컬럼 — OrderPage Step 1의 `phone` 필드와 동일 컬럼. 두 화면 모두 `formatPhone`이 동일한 3-4-4 패턴이라 정확 일치 매칭 가능.
- **단, 사용자가 OrderPage에서 입력한 값이 DB에 그대로 저장된 경우에만 일치한다.** 어드민이 수정한 경우(공백·하이픈 변형 등)에는 매칭 실패. 시안 결정과 별개로 검색 단순화 정책(LIKE·trim·하이픈 normalize 등) **확인 필요.**

## 필터·뷰 모드

- 학회 필터: URL의 `?events={slug}`로만 설정 가능. 화면 내 학회 변경 UI 없음.
- 정렬: `created_at` 내림차순 (최신 주문 먼저). 변경 옵션 없음.
- 페이지네이션 없음. 결과 전수 표시. (이름+연락처 정확 일치라 보통 결과 1~5건 가정)
- 상태 필터 없음. 취소·환불 주문도 결과에 포함되어 상태 칩으로 구분 표시.

## 빈 상태·로딩·오류 처리

- [ ] 검색 전(`orders === null`): 📋 + “주문 시 입력한 이름과 연락처로 조회할 수 있어요” (line 154-159)
- [ ] 검색 중(`loading=true`): 조회하기 버튼의 시작 아이콘이 `CircularProgress` size 18로 교체, 버튼 비활성
- [ ] 결과 0건: 🔍 + “일치하는 주문을 찾을 수 없습니다” + “이름과 연락처를 다시 확인해주세요.” (line 163-172)
- [ ] 결과 N건: 카운트 캡션 + 카드 리스트
- [ ] 빈 값 제출: Alert “이름과 연락처를 모두 입력해주세요.”
- [ ] Supabase 에러: Alert “조회 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.”
- [ ] **RLS 차단으로 결과가 비는 경우 — 결과 0건 분기와 시각적으로 구별 안 됨.** 사용자는 “주문이 없는 것”과 “정책상 못 가져오는 것”을 구별 못 한다. 시안에서 이 경계 케이스의 처리(예: 안내 문구 보강) 정책 결정 필요. **확인 필요.**

## 핵심 발견 (시안 검수 시 반드시 확인)

1. **`/order/lookup` 라우트가 App.jsx에 등록돼 있지 않다.** OrderLookupPage 컴포넌트는 완성되어 있고 import만 빠진 상태(Grep으로 import·navigate·a 링크 어디서도 호출 안 됨). 마이그레이션 `20260406_allow_public_order_lookup.sql` 주석은 “/order/lookup pages”를 명시하지만, 다음날 RLS 정책이 다시 회수되었다(20260407). 즉 **현 상태에서는 미활성 화면.** 시안 진행 전 (A) 활성화하는 방향인지 (B) 폐기하는 방향인지 건우님 결정 필요. **확인 필요.**

2. **RLS 정책 충돌로 anon 직접 조회 차단 가능성.** `handleSearch` line 52-61의 `supabase.from('orders').select(...).eq(customer_name).eq(phone_number)` 패턴은 anon 컨텍스트에서 `20260407_rls_token_based_access.sql` 의 “anon SELECT 제거” 정책에 막힌다. 현 상태로 라우트를 등록하면 사용자가 “결과 0건” 화면만 보게 될 위험. 활성화 결정 시 새 RPC(`lookup_orders_by_name_phone` SECURITY DEFINER) 필요. **확인 필요 + 기술 부채.**

3. **본인 인증이 이름+연락처 정확 일치만으로 이뤄진다.** 비밀번호·생년월일·이메일 등 추가 키 없음. 학회 슬러그(`?events=`) 필터는 보안 강화 효과가 미미함(공격자도 슬러그를 알 수 있음). **타인이 이름+휴대폰을 안다면 주문 내역 + `access_token` + 그 너머의 OrderStatusPage 전체를 볼 수 있다.** 라우트 활성화 시 정책 재검토 필요. **확인 필요 — 보안 측면.**

4. **결과 카드의 합배송 묶음 규칙이 복잡하다.** `parentIds` 집합 → `visible` 필터 → `hasChildren` 판정 → 두 종류의 칩(“추가 주문” / “연계 주문 포함”) 로직이 한 페이지에 다 들어있다 (line 175-180). 시안에서 칩 두 종류를 누락하면 합배송 시나리오에서 사용자가 같은 주문이 중복 표시되거나 누락되었다고 오해할 수 있다. A2 OrderStatusPage가 “1차/2차”로 통일된 것과 달리 본 화면은 “추가 주문/연계 주문 포함”이라 — 두 라벨 체계가 동일 도메인에서 따로 살고 있다. **라벨 통일 정책 결정 필요. 확인 필요.**

5. **결과 카드에 상품명·상태 라벨 외 상세는 노출되지 않는다.** 학회명 + 날짜 + 상품 개수 + 금액 + 상태 칩이 전부. 상품명 join은 select하지만 카드에 보이지 않음(`totalItems` 계산용으로만 사용). 시안에서 “첫 상품명 + 외 N건” 형태로 노출하면 사용자가 어떤 주문인지 알아보기 쉬울 수 있는데 — **상품명 표시 추가 여부 정책 결정 필요. 확인 필요.**

6. **단독 진입 통로가 없다.** OrderPage(`/order`)의 접근 차단 화면(만료·없는 슬러그)에서 `showLookup: true` 플래그를 코드에 두지만 실제 UI 렌더는 안 함(C1 시트 핵심 발견 항목과 동일). 알림톡 본문도 status 링크만 보내고 lookup 링크는 안 보냄. **시안에서 어디에 진입 버튼/링크를 둘지(예: 알림톡 분실 안내 페이지, 만료 화면 하단 등) 동선 정책 결정 필요. 확인 필요.**

## 변경 이력
- 2026-05-26 신설 — M2 고객용 시안 착수 사전 정독. `OrderLookupPage.jsx` 255줄 전수 + App.jsx 라우트 등록 누락 확인 + RLS 마이그레이션 충돌(`20260406` 허용 → `20260407` 회수) 확인. 환각 방지 위해 라우트 활성화 여부, RLS 우회 RPC 필요성, 본인 인증 강화, 합배송 라벨 통일, 결과 카드 상품명 표시, 진입 동선 6건은 모두 “확인 필요”로 표기. 본 시트는 현재 코드 실태 기록이며, 시안 진행 전 활성화/폐기 정책을 먼저 결정해야 한다.
