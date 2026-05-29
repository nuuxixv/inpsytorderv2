# 사양 시트 — A2 주문 상세 모달 (OrderDetailModal)

> 이 시트는 어드민 주문 상세·편집 모달의 정보·기능·데이터 구조의 단일 진실 소스다.
> 시안 부재 화면이므로 실 컴포넌트(`OrderDetailModal.jsx`)가 사실상의 기획이다. 시안이 작성되면 이 시트에 모든 항목이 1:1로 반영되어야 한다.
> 임의 단순화·통합·생략은 건우님의 명시적 승인 후 이 시트를 먼저 갱신한 다음에만 허용된다.
> 마지막 갱신: 2026-05-29 신설 (M3-13 선행 — 시안 부재 단일 진실 소스 박기).

## 참조 파일
- 실 컴포넌트: `inpsyt-order-frontend/src/components/OrderDetailModal.jsx` (607줄)
- 호출 위치: `inpsyt-order-frontend/src/components/OrderManagementPage.jsx` 행 클릭 시
- 관련 API:
  - `src/api/orders.js` — `linkOrders`(parentOrderId, childOrderId, settings), `searchOrdersForLinking`(term, excludeOrderId)
  - `src/api/alimtalk.js` — `sendAlimtalk`(orderId) (브라우저 직접 fetch, Edge Function 호출 금지)
- 직접 supabase 호출(컴포넌트 내부):
  - `supabase.from('site_settings').select('*').single()` (line 91-97) — 배송비 정책
  - `supabase.from('orders').select(...).eq('id', parent_order_id).single()` (line 158-163) — 부모 주문 로드
  - `supabase.from('orders').select(...).eq('parent_order_id', order.id)` (line 167-171) — 자식 주문들 로드
  - `supabase.rpc('update_order_details', { order_id_param, updates_param, items_param })` (line 224) — 편집 저장
  - `supabase.from('orders').update({ status }).eq('id', order.id)` (line 241) — 상태만 변경
  - `supabase.from('order_items').delete().eq('order_id', order.id)` + `supabase.from('orders').delete().eq('id', order.id)` (line 274-277) — 삭제
- DB 함수: `supabase/migrations/20260415_004_update_order_functions.sql` 의 `update_order_details(order_id_param int, updates_param jsonb, items_param jsonb)`
- 상태 이력 트리거: `supabase/migrations/20260406_add_status_history_to_orders.sql` — `status` 변경 시 `status_history` jsonb에 자동 누적
- 결제완료 알림 트리거: `supabase/migrations/20250722070342_create_paid_order_trigger.sql` (`notify_order_paid`) — DB 알림만, 알림톡과 무관
- 알림톡 발송 사양: `ONESHOT.md` (msgagent 구형 TLS → 브라우저 직접 fetch만 가능)
- 우편번호 검색 라이브러리: `react-daum-postcode`
- 상태 한국어 매핑(전달받음): `inpsyt-order-frontend/src/constants/orderStatus.js` 의 `STATUS_TO_KOREAN`

## 사용자 시나리오
어드민(master·editor·viewer)이 주문 관리 페이지에서 한 행을 클릭하면 이 모달이 열린다. 학회 종료 후 사무실에서 결제 누락분을 paid로 바꾸고 알림톡이 자동 발송되는 것을 확인하거나, 고객이 전화로 주소를 정정해 달라고 하면 편집 모드로 들어가서 학회·고객명·연락처·주소·상품 구성·관리자 메모를 수정하고 저장한다. 같은 고객이 학회 폐막 후 “책 1권만 추가요”라고 하면 “연계 주문 연결”로 원주문을 찾아 child로 묶어 배송비 절감 효과를 즉시 확인한다. master는 잘못 들어온 주문을 통째로 삭제할 수 있다. viewer는 모든 컨트롤이 비활성화돼 조회만 가능하다. 데스크톱에서는 가운데 정렬된 카드 모달, 모바일·태블릿에서는 하단에서 올라오는 Drawer.

## 진입 흐름
- 진입: `OrderManagementPage`의 테이블 행 클릭(체크박스·상태 셀 제외) 또는 모바일 카드 클릭
- prop으로 받는 값: `order`, `open`, `onClose`, `statusToKorean`, `productsMap`, `products`, `events`, `addNotification`, `onUpdate`, `productsLoading`, `hasPermission`
- 모달 사이즈: 데스크톱 maxWidth 800, 모바일 SwipeableDrawer(95vh)
- `order.access_token` 있으면 헤더에 “고객 주문 조회 페이지” 외부 링크 아이콘 표시 (line 349-360)

## 표시 정보 (라벨 단위, 누락 금지)

### 헤더 (line 346-380)
- [ ] 모달 제목: “상품주문정보 조회” (Typography variant h6)
- [ ] (조건부, `order.access_token`) `OpenInNewIcon` 외부 링크 — `/order/status/{access_token}` 새 탭, title “고객 주문 조회 페이지” — line 349-360
- [ ] (조건부, `orders:edit` AND `status === 'paid'` AND `!is_on_site_sale`) “알림톡 재발송” 버튼 (outlined, fontSize 0.75rem) — line 362-371
- [ ] (조건부, `orders:edit`) “편집” / “저장” 토글 버튼 — line 372
- [ ] (조건부, `master` AND `!isEditing`) `DeleteIcon` 삭제 아이콘 (error color) — line 373-377
- [ ] 닫기 아이콘 `CloseIcon` — line 378

### 주문 상세 정보 섹션 (Table, line 382)
- [ ] **상품주문번호** — `displayId` 가공:
  - parent_order_id 있으면 `{id}({parent_id})` (이 주문이 child)
  - linkedChildren 있으면 `{id}-{N+1}` (이 주문이 parent, N=자식 수)
  - 그 외 `{id}` 그대로
- [ ] **주문일** — `new Date(order.created_at).toLocaleString('ko-KR')` 풀 포맷 (yyyy. M. d. 오전/오후 hh:mm:ss)
- [ ] **학회명** — 조회 시 `events.find(e => e.id === order.event_id)?.name || 'N/A'` / 편집 시 학회 Select (전체 events 옵션, name만 표시)
- [ ] **상태** — Select 상시 노출 (편집 모드 아닐 때도 변경 가능). `orders:edit` 없으면 disabled. **변경 즉시 저장** (`handleSaveStatusOnly`). 5개 옵션: `statusToKorean` 전체 (pending/paid/completed/cancelled/refunded)

### 상태 이력 섹션 (조건부, line 384-386, 544-604)
- [ ] `order.status_history` 배열 길이 > 0일 때만 노출
- [ ] 헤더: “상태 이력” + (접힘 시) “{N-1}개 이전 이력” 캡션 + ExpandMore/Less 아이콘
- [ ] 현재 상태 행(항상 표시, 헤더 직하 grey.50 배경): 상태 Chip + 변경시각(`yyyy.MM.dd hh:mm:ss`) + “현재” 우측 Chip(primary outlined)
- [ ] 이전 상태 행(Collapse): 상태 Chip(작게) + 변경시각(secondary)

### 주문자 정보 섹션 (Table, line 387)
- [ ] **주문자명** — 조회: `order.customer_name` / 편집: TextField
- [ ] **연락처** — 조회: `order.phone_number || 'N/A'` / 편집: TextField + **011자리수 포맷터** (`010-XXXX-XXXX`, 최대 11자리 digit). hyphen 자동 삽입 규칙: ≤3=raw, 4-7=`XXX-XXXX`, 8+=`XXX-XXXX-XXXX`
- [ ] **인싸이트 ID** — 조회: `order.inpsyt_id || 'N/A'` / 편집: TextField (자유 입력)

### 배송지 정보 섹션 (Table, line 388) — **3필드 분리 절대 금지**
- [ ] **우편번호** — 조회/편집 모두 readOnly 텍스트 표시 (`shipping_address.postcode`). Daum 검색으로만 채워짐
- [ ] **주소(도로명)** — 조회: `shipping_address.address || 'N/A'` / 편집: readOnly Typography + “검색” 버튼 → Daum 우편번호 Dialog (zIndex 1400)
- [ ] **상세 주소** — 조회: `shipping_address.detail || 'N/A'` / 편집: 독립 TextField (자유 입력)
- [ ] **배송 메모** — 조회: `order.customer_request || '없음'` / 편집: TextField (자유 입력)

### 관리자 메모 섹션 (Table, line 389)
- [ ] **관리자 메모** — 조회: `order.admin_memo || '작성된 메모가 없습니다.'` (whiteSpace pre-wrap) / 편집: TextField multiline rows=3, placeholder “관리자만 볼 수 있는 메모입니다. 환불 정보, 고객 특이사항 등을 기록하세요.”

### 연계 주문 섹션 (line 391-426)
- [ ] 섹션 헤더: “연계 주문” + (조건부, `orders:edit` AND `!parent_order_id`) “연계 주문 연결” 버튼
- [ ] (조건부, linkedParent 있음) Alert info — “원주문 (1차)” + `#{id} · {customer_name} · {final_payment.toLocaleString()}원 [status Chip]`
- [ ] (조건부, linkedChildren 있음) Alert warning 각 자식별 — “추가 주문 (2차)” + 동일 포맷
- [ ] (둘 다 없을 때) “연계된 주문이 없습니다.” Typography secondary
- [ ] **확인 필요** — child 주문(이 모달의 order가 child) 에서도 “연계 주문 연결” 버튼은 숨겨지지만, 부모 주문 1개와 형제 자식 주문(같은 parent 공유)을 함께 보여주지는 않음. parent–child 트리의 1단계만 본다.

### 주문 상품 목록 섹션 (Table, line 427)
- [ ] 헤더: 상품명 · 정가 · 할인가 · 수량 · 합계 · (조건부, `orders:edit` 편집 모드) 작업
- [ ] 행 데이터: `editedOrderItems`(편집 중) 또는 `order.mergedItems || order.order_items`(조회)
- [ ] 상품명 — 조회: `item.product_name || productsMap[item.product_id]?.name || '알 수 없는 상품'` / 편집: Autocomplete (전체 products 옵션, name으로 검색, getOptionLabel name)
- [ ] 정가 — `item.list_price || productsMap[item.product_id]?.list_price || 0`.toLocaleString()원
- [ ] 할인가 — `originalPrice * (1 - discountRate)`.toLocaleString()원 (학회 할인율 기준)
- [ ] 수량 — 조회: 숫자만 / 편집: TextField type number (min 0)
- [ ] 합계 — `discountedPrice * quantity`.toLocaleString()원
- [ ] (조건부, 편집 모드) 삭제 아이콘 `CloseIcon`(error) — `handleRemoveOrderItem`
- [ ] (조건부, 편집 모드) “상품 추가” 버튼 — 첫 번째 product를 quantity 1로 추가 (line 175-182)
- [ ] (productsLoading 시) CircularProgress 한 줄

### 결제 정보 섹션 (Table, line 428)
- [ ] **정가의 합** — `subtotal.toLocaleString()`원
- [ ] **할인된 금액** — `totalDiscount.toLocaleString()`원
- [ ] **배송비** — `shippingFee.toLocaleString()`원
- [ ] **총 결제 금액** — `finalTotal.toLocaleString()`원 (fontWeight bold, fontSize 1.1rem)
- [ ] 조회 모드 값 출처: `order.total_cost` / `order.discount_amount` / `order.delivery_fee` / `order.final_payment`
- [ ] 편집 모드 값 출처: 클라이언트 재계산 (학회 할인율 + 무료배송 임계치 적용, line 125-149)

### 푸터 (line 430)
- [ ] “닫기” 버튼 (outlined, 모바일 fullWidth) — `onClose`

### 연계 주문 검색 Dialog (linkDialogOpen, line 441-500)
- [ ] 제목: “연계 주문 연결”
- [ ] 안내문: “현재 주문(#{order.id})을 다른 주문의 추가 주문으로 연결합니다. 고객명 또는 연락처로 원주문을 검색하세요.”
- [ ] 검색 TextField (placeholder “고객명 또는 연락처 입력”) + “검색” 버튼 (Enter 키도 트리거)
- [ ] 결과 List dense, 각 항목:
  - primary: `#{id} · {customer_name} · {final_payment.toLocaleString()}원`
  - secondary: `{created_at yyyy. MM. dd}` · **굵게**(`연계 시 {saved.toLocaleString()}원 절감 ({freeShipping ? '무료배송' : '합배송'})`) — `freeShipping`이면 #10B981(초록), 아니면 #6366F1(보라)
- [ ] 검색 결과 없음 시 “검색 결과가 없습니다.” Typography
- [ ] 푸터: “취소” 버튼

### 삭제 확인 Dialog (deleteConfirmOpen, line 503-520)
- [ ] 제목: “주문 삭제” (fontWeight 700)
- [ ] 본문 1: “주문 **#{id}** ({customer_name})을 삭제합니다.”
- [ ] 본문 2 (secondary): “이 작업은 되돌릴 수 없습니다.”
- [ ] 푸터: “취소” / “삭제”(contained error, deleting 시 CircularProgress)

### Daum 우편번호 Dialog (showPostcode, line 523-539)
- [ ] 제목: “주소 검색”
- [ ] `DaumPostcode` 컴포넌트 (height 60vh)
- [ ] 완료 시 `addressType === 'R'` (도로명)이면 동명·건물명을 괄호로 부착, 그 외는 `data.address` 그대로

## 액션·기능 (누락 금지)

### 편집 토글·저장
- [ ] **편집** 버튼 (orders:edit, isEditing=false) → isEditing=true → 모든 필드 입력 가능 + 합계 라이브 재계산 (useEffect line 125-149)
- [ ] **저장** 버튼 (orders:edit, isEditing=true) → `handleSaveAll` → `supabase.rpc('update_order_details', { order_id_param, updates_param, items_param })` → 성공 토스트 → `onUpdate()` → `onClose()`
- [ ] 편집 모드일 때 학회 변경 → 즉시 모든 상품의 할인가·합계 재계산 (selectedEvent.discount_rate 기준)

### 상태 변경 (편집 모드 무관 — 항상 즉시 저장)
- [ ] 상태 Select 변경 → `handleSaveStatusOnly(newStatus)` → `supabase.from('orders').update({ status }).eq('id', order.id)` → 토스트 + `onUpdate()`
- [ ] `status → paid` 전환 시 `is_on_site_sale=false` 면 **`sendAlimtalk(order.id)` 비동기 호출** → 결과 토스트 (성공/실패)
- [ ] DB 트리거가 `status_history` 자동 누적

### 알림톡 재발송
- [ ] **노출 조건**: `orders:edit` AND `status === 'paid'` AND `!is_on_site_sale`
- [ ] 동작: `sendAlimtalk(order.id)` → 결과 토스트 + 성공 시 `onUpdate()` (`alimtalk_sent_at` 갱신 반영)
- [ ] **확인 필요** — UI에 `alimtalk_sent_at` 마지막 발송 시각이 표시되지 않음. 발송 이력은 DB에만 기록. 시안에서 “마지막 발송: yyyy-MM-dd HH:mm” 노출 추가 결정 필요

### 삭제
- [ ] **권한**: `master` 전용. editor·viewer 모두 노출 안 됨
- [ ] `handleDeleteConfirm` → `order_items` 삭제 → `orders` 삭제 (트랜잭션 보호 없음, 두 쿼리 순차)
- [ ] **확인 필요** — `order_items` 삭제 성공 후 `orders` 삭제 실패하면 고아 데이터. 트랜잭션 RPC로 묶을지 부채

### 연계 주문 연결
- [ ] **노출 조건**: `orders:edit` AND `!parent_order_id` (이 주문이 아직 child가 아닐 때만)
- [ ] 검색: `searchOrdersForLinking(term, excludeOrderId)` — `customer_name` 또는 `phone_number` ilike, parent_order_id null인 후보만, 최대 10건, 자기 자신 제외
- [ ] 연결: `linkOrders(parent.id, this.id)` — RPC 아니라 클라이언트 트랜잭션:
  - 현재 주문에 `parent_order_id` 세팅
  - `delivery_fee` 0으로 변경
  - `final_payment` 재계산: `child.total_cost - child.discount_amount - (parent가 paid·completed이고 delivery_fee>0이면 parent.delivery_fee 차감)`
  - **확인 필요** — 합산 금액이 free_shipping_threshold 이상인지 검증 없이 항상 `delivery_fee=0`. parent가 무료배송 자격이 안 되는데도 child 배송비를 0으로 만드는 의미. `api/orders.js:144-151` 의 “PAID 상태 + delivery_fee>0인 parent에서만 차감” 조건과 “delivery_fee=0”이 항상 적용되는 것의 정합성 검토 필요.

### 우편번호 검색
- [ ] 편집 모드에서 주소 셀의 “검색” 버튼 → DaumPostcode Dialog
- [ ] 완료 시 `editedShippingAddress` (도로명·동·건물명 가공) + `editedShippingPostcode` 세팅. 상세 주소는 별도 TextField로 직접 입력 유지

### 외부 링크 — 고객 주문 조회
- [ ] `OpenInNewIcon` 클릭 → `/order/status/{access_token}` 새 탭. 어드민이 고객이 받는 알림톡 링크를 직접 열어볼 수 있는 운영 도구.

## 입력 폼 구조 (편집 모드 — 분리/통합 절대 금지)

`OrderDetailModal`은 편집 모드에서 12개 필드를 다룬다. 시안에서 어떤 통합도 금지.

- [ ] **학회**: Select (events 전체)
- [ ] **상태**: Select (statusToKorean 전체)
- [ ] **주문자명**: TextField
- [ ] **연락처**: TextField + 자동 포맷터 (digit only 11자리)
- [ ] **인싸이트 ID**: TextField
- [ ] **우편번호**: readOnly 표시 (Daum 검색 결과의 zonecode)
- [ ] **주소(도로명)**: readOnly + “검색” 버튼 → Daum
- [ ] **상세 주소**: 독립 TextField
- [ ] **배송 메모(customer_request)**: TextField
- [ ] **관리자 메모(admin_memo)**: TextField multiline rows=3
- [ ] **주문 상품 목록**: 각 행 Autocomplete(상품)·TextField(수량). “상품 추가” 버튼으로 행 증감.

**시안 절대 금지 사항**:
1. 우편번호+도로명 주소+상세 주소를 한 줄로 통합
2. 배송 메모와 관리자 메모를 한 필드로 통합 (전자=고객 전달 사항, 후자=내부 메모, 노출 권한·의미가 완전히 다름)
3. 상품 검색을 단일 input으로 단순화 (Autocomplete + 수량 TextField + 삭제 아이콘 + “상품 추가” 4컴포넌트 유지)

## 권한별 차이

`hasPermission(key)` 호출 기준:

- [ ] **master**: 모든 기능 + 삭제 아이콘 노출
- [ ] **`orders:edit` 보유 (editor 포함)**: 편집/저장 토글·상태 Select 활성·연계 연결·알림톡 재발송 활성. 삭제는 불가.
- [ ] **`orders:view` 만 보유 (viewer)**: 모든 입력·버튼 disabled. 상태 Select도 disabled. 조회만 가능.
- [ ] (참고) `orders:view` 권한 없으면 OrderManagementPage 자체에 진입 불가하므로 이 모달도 열리지 않음

## 데이터 모델

### `orders` (이 모달이 SELECT/UPDATE/DELETE하는 필드)
- `id` (bigint), `parent_order_id` (bigint nullable), `customer_name` (text), `phone_number` (text)
- `shipping_address` (jsonb) — `{ postcode, address, detail }`
- `customer_request` (text), `admin_memo` (text), `inpsyt_id` (text)
- `is_on_site_sale` (boolean) — 알림톡 재발송 노출 조건에 사용
- `event_id` (bigint, FK)
- `status` (text — pending/paid/completed/cancelled/refunded)
- `status_history` (jsonb) — 트리거 자동 갱신
- `total_cost` / `discount_amount` / `delivery_fee` / `final_payment` (numeric)
- `access_token` (uuid) — 외부 링크 노출에 사용
- `alimtalk_sent_at` (timestamptz nullable) — **컴포넌트에서 표시되지 않음. 확인 필요**
- `created_at` (timestamptz)

### `order_items` (조회·일괄 재삽입)
- `order_id, product_id, quantity, price_at_purchase`
- 스냅샷: `product_name, product_code, category, list_price`

### `events` (join)
- `id, name, discount_rate`

### `site_settings`
- `free_shipping_threshold, shipping_cost` — 편집 모드 재계산에 사용

### `update_order_details` RPC (마이그레이션 `20260415_004_update_order_functions.sql`)
- 시그니처: `(order_id_param int, updates_param jsonb, items_param jsonb)`
- 동작: orders UPDATE → order_items DELETE all → order_items INSERT bulk
- **UPDATE 절에 포함되는 필드 (이것만 반영됨)**: `status, customer_name, phone_number, shipping_address, customer_request, final_payment, event_id, admin_memo`
- **클라이언트가 보내지만 RPC가 무시하는 필드**: `inpsyt_id, total_cost, discount_amount, delivery_fee`
- **이건 명백한 부채. CTO 검수 권장.** 편집 모드에서 인싸이트 ID·정가합·할인액·배송비를 수정해도 DB에 반영 안 됨 (final_payment만 반영). 클라이언트와 RPC 시그니처 불일치.

### `linkOrders` (클라이언트 함수, RPC 아님)
- `api/orders.js:128-168` — `supabase.from('orders').update(...).eq('id', childOrderId)` 단일 쿼리
- 반환: `{ combinedListPrice, freeShipping, parentPaidShipping, newFinalPayment, originalFinalPayment, saved }`

### `searchOrdersForLinking` (클라이언트 함수)
- 검색 조건: `customer_name ilike` OR `phone_number ilike`. 숫자 10-11자리면 하이픈 포맷으로도 검색
- `parent_order_id IS NULL` 인 주문만 (이미 child인 주문은 parent가 될 수 없음)

## 빈 상태·로딩·오류 처리

- [ ] 로딩: `productsLoading` 시 주문 상품 목록 행 한 줄에 CircularProgress
- [ ] 빈 상태 — 연계 주문 없음: “연계된 주문이 없습니다.” Typography
- [ ] 빈 상태 — 연계 검색 결과 없음: “검색 결과가 없습니다.”
- [ ] 빈 상태 — 상태 이력 없음: 섹션 자체 비노출
- [ ] 오류: `addNotification(..., 'error')` 토스트만. 모달 내 잔류 alert 없음
- [ ] 알림톡 발송 실패: warning 토스트 (재발송 버튼은 그대로 노출되어 재시도 가능)

## 핵심 발견 (CTO 검수 권장)

1. **`update_order_details` RPC 시그니처 불일치 — 부채.** 클라이언트(`handleSaveAll`, line 199-212)는 `total_cost, discount_amount, delivery_fee, inpsyt_id` 를 포함해 `updates_param` 으로 보내지만, 마이그레이션의 RPC 본문은 이 4개를 UPDATE 절에 포함하지 않는다. 편집 모드에서 인싸이트 ID와 결제 세부 컬럼을 수정해도 final_payment만 반영되고 나머지는 silent fail. RPC를 수정하거나 클라이언트가 보내는 필드를 줄여 정합시켜야 함. **CTO 결정 사안**.

2. **삭제는 트랜잭션 보호 없음.** `order_items` 삭제 → `orders` 삭제 두 쿼리가 별도 호출(line 274-277). 첫 번째만 성공하면 고아 order_items가 남거나, 두 번째만 실패하면 빈 주문이 남는다. `delete_order` RPC로 묶거나 ON DELETE CASCADE를 검토할 부채.

3. **`linkOrders`는 무조건 `delivery_fee = 0`.** `api/orders.js:155` UPDATE에서 합산 금액이 무료배송 임계치 미만이어도 child의 배송비를 0으로 만든다. 반환값(`combinedListPrice`, `freeShipping`)은 계산하지만 실 UPDATE에는 반영 안 됨. 운영 의도가 “일단 묶으면 배송비 안 받는다”라면 의도대로지만, “무료배송 자격 충족 시에만 0”이라면 버그. **건우님 확인 필요**.

4. **알림톡 발송 이력 UI 미노출.** `alimtalk_sent_at` 컬럼이 있고 `sendAlimtalk` 성공 시 갱신되는데, 이 모달의 어디에도 “마지막 발송 시각”이 표시되지 않는다. 어드민이 “이미 보냈는지” 모르고 재발송을 누르게 됨. 시안 작성 시 발송 이력 표시 위치 결정 필요.

5. **상태 셀이 편집 모드와 별개로 항상 활성.** 다른 필드는 “편집” 토글이 필요한데 상태만 그렇지 않다(line 382 안의 Select). 운영상 빠른 paid 전환을 위한 의도지만, “편집 모드 아닐 때 실수로 상태가 바뀌는” 사고 가능성. 시안에서 명시적 confirm 도입할지 결정 필요.

## 시안 부재로 인한 결정 사항

시안이 없으므로 다음을 “이 시트의 결정”으로 박는다:

- 모달 구조 7섹션 유지: 헤더 → 주문 상세 → 상태 이력 → 주문자 정보 → 배송지 정보 → 관리자 메모 → 연계 주문 → 주문 상품 목록 → 결제 정보 → 푸터
- 배송지 정보는 3-row Table 유지 (우편번호·주소·상세 주소 분리)
- 편집/조회 토글은 한 버튼에서 “편집 ↔ 저장”으로 전환 유지
- 상태 Select는 편집 토글 무관 항상 활성 (단, viewer는 disabled)
- 알림톡 재발송 버튼은 별도 노출(헤더), 자동 발송과 수동 발송의 분리 의도 유지
- 모바일은 SwipeableDrawer(bottom, 95vh), 데스크톱은 가운데 정렬 카드(maxWidth 800)

## 변경 이력
- 2026-05-29 신설 — M3-13 선행. 시안 부재 화면이므로 실 컴포넌트가 단일 진실 소스. RPC 시그니처 불일치 1건, 삭제 트랜잭션 부재 1건, linkOrders 배송비 정책 모호 1건, 알림톡 이력 UI 미노출 1건을 부채 후보로 기록. 시안 작업 착수 시 이 시트의 핵심 발견 5건을 먼저 정리한 뒤 진행.
- 2026-05-29 M3-13 시안 정합 — 시안 부재이므로 사양 시트 단일 진실 소스 기반 토큰·합성 컴포넌트 적용.
  - 합성 컴포넌트 적용: `SectionCard`(7섹션), `InfoRow`(주문 상세·주문자·배송지 12행), `StatusBadge`(상태 이력·연계 주문), `PriceBlock`(결제 정보), `ActionSlot`(푸터).
  - Modal/Drawer/Dialog 라운드를 `theme.radii.lg`·`md`·`sm` 토큰으로 교체. raw hex 0, 인라인 fontSize 0, fontWeight 800 본문 0.
  - 정보 구조·필드·액션 전부 보존(7섹션 유지, 배송지 3필드 분리, 연계 주문 Alert→tone 카드, 상태 이력 Accordion).
  - 보존: 모든 API/RPC/Edge Function 호출(`update_order_details`, `linkOrders`, `searchOrdersForLinking`, `sendAlimtalk`, 삭제·status 단건 update, `site_settings` 조회), 권한별 분기, 편집 토글, 자동 알림톡, Daum 우편번호 Dialog.
  - 부채 5건은 손대지 않음(별도 사이클 — CTO 검수 권장).
