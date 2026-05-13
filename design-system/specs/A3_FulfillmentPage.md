# 사양 시트 — A3 출고 현황 (FulfillmentPage)

> 이 시트는 출고 현황 화면의 정보·기능·데이터 구조의 단일 진실 소스다.
> 시안과 실서비스 구현은 이 시트의 모든 항목을 1:1로 반영해야 한다.
> 마지막 갱신: 2026-05-13 신설 (PR #6 사고 대응).

## 참조 파일
- 실 컴포넌트: `inpsyt-order-frontend/src/components/FulfillmentPage.jsx` (617줄)
- 관련 API: `inpsyt-order-frontend/src/api/orders.js` 의 `getFulfillmentOrders`, `groupLinkedOrders`
- 관련 폼 컴포넌트(주소 입력 분리 구조 참조): `inpsyt-order-frontend/src/components/CustomerInfoStep.jsx`
- DB 스키마: `supabase/migrations/20250722070000_create_orders_table.sql` + `20250805_add_new_order_fields.sql` + `20250808040516_add_admin_memo_to_orders.sql` (`orders` 테이블)

## 사용자 시나리오
부스 운영자(학지사 마케팅팀·인싸이트 직원)가 학회 종료 후 사무실에서 또는 학회 중에 태블릿/PC로 연다. 결제완료된 주문(`status='paid'`)을 좌측 목록에서 골라 우측 상세를 확인하고, 정보가 맞으면 "출고 처리" 버튼을 눌러 `status='completed'`로 바꾼다. 주소·연락처·인싸이트 ID 같은 정보는 출고처(택배사 또는 인싸이트 시스템)에 전달하기 위해 개별 필드 단위로 복사한다.

## 표시 정보 (라벨 단위, 누락 금지)

### 상단 필터바
- [ ] 페이지 제목 아이콘: `LocalShippingIcon` (primary 색) — line 521
- [ ] 페이지 제목 텍스트: "출고 현황" — line 522
- [ ] 학회 선택 드롭다운: 라벨 "학회", 기본값 "전체 학회" + DB에서 가져온 학회 목록 — line 524-536
- [ ] 대기 건수 칩: "{N}건 대기" (warning 색, N>0일 때 filled) — line 540
- [ ] 완료 건수 칩: "{N}건 완료" (success 색 outlined) — line 541
- [ ] 뷰 모드 토글 그룹 — 3개: "전체" / "도서 뷰"(#3B82F6) / "검사 뷰"(#6366F1) — line 546-555

### 좌측 주문 카드 (OrderCard, line 122-206)
- [ ] 주문 유형 배지 — `book`/`test`/`mixed`/`other` 중 하나
  - "도서전용" (#3B82F6) / "검사전용" (#6366F1) / "혼합" (#8B5CF6) / "기타" (#9CA3AF)
- [ ] 연계 배지(조건부): "연계 {N+1}건" (#F59E0B, parent 주문에 자식이 있을 때만) — line 161-175
- [ ] 출고처리 배지(조건부): "출고처리" + 체크 아이콘 (#10B981, `status='completed'`일 때만) — line 176-191
- [ ] 고객명 (`customer_name`, 굵게) — line 193-195
- [ ] 학회명 + 상품 개수: "{event.name} · {N}개 상품" — line 196-198
- [ ] 결제금액 (mergedTotal ?? final_payment, primary 색, 원 단위 천 단위 콤마) — line 199-201
- [ ] 출고처리 완료 카드는 opacity 0.7로 표시 — line 142

### 우측 주문자 정보 카드 (line 247-353)
- [ ] 고객명 (`customer_name`, 클릭하여 복사) — line 250-255
- [ ] 상태 칩: `statusLabel[status]` — paid="결제완료" / completed="처리완료" / pending="결제대기" / cancelled="주문취소" / refunded="결제취소" — line 257-262
- [ ] 출고 처리 버튼(조건부): `status='paid'` 이고 `orders:edit` 권한 있을 때만 표시, success 색, 체크 아이콘 — line 263-274
- [ ] 연락처 (`phone_number`, 라벨 "연락처", 클릭하여 복사) — line 280-288
- [ ] 결제금액 (`mergedTotal ?? final_payment`, 라벨 "결제금액", primary 색) — line 289-294
- [ ] 인싸이트 ID(조건부): `inpsyt_id` 존재 시 표시, 라벨 "인싸이트 ID", 클릭하여 복사 — line 296-306
- [ ] 배송지 — **세 줄 분리 표시 필수** (절대 한 줄로 통합 금지). 우편번호·도로명주소·상세주소 각각 별도 복사 가능 — line 307-334
  - 우편번호: `[{address.postcode}]` (monospace, text.disabled, 도로명주소 옆에 표시)
  - 도로명주소: `address.address || address.roadAddress || address.jibunAddress` (한 줄, 우편번호와 같은 줄)
  - 상세주소: `address.detailAddress || address.detail` (별도 줄, 단독 복사)
  - 도구 팁: "도로명주소 복사 (우편번호 제외)", "상세주소 복사"
- [ ] 요청사항 (`customer_request`, 라벨 "요청사항", 없으면 "-" disabled) — line 335-342
- [ ] 관리자 메모 (`admin_memo`, 라벨 "관리자 메모", 없으면 "-" disabled) — line 343-350

### 우측 상품 목록 카드 (line 356-441)
- [ ] 카드 제목: "상품 목록" — line 358
- [ ] 표 컬럼: # / 상품명 / 분류 / 단가 / 수량 / 합계 — line 360-368
- [ ] 행마다 표시:
  - 번호(인덱스+1)
  - 상품명 (`product_name || products.name`)
  - **분류 칩 — 누락 금지.** `category` 값을 라벨로(원본값 사용: `rawCategory`), 색은 정규화 후 결정 — `검사`=#6366F1, `도서`=#3B82F6, 기타=#9CA3AF — line 394-409
  - 단가 (`price_at_purchase`, 천 단위 콤마)
  - 수량 (`quantity`)
  - 합계 (`price_at_purchase × quantity`)
- [ ] 뷰 모드별 그레이드 처리: book 뷰에서 검사 상품, test 뷰에서 도서 상품은 opacity 0.35 + grey.50 배경 — line 375-389
- [ ] 합계 영역: 배송비 표시(조건부, `delivery_fee > 0`) "배송비 {N}원 포함" + 합계 "합계 {N}원" — line 428-438

### 빈 상태
- [ ] 주문 미선택 시 상세 패널: `LocalShippingIcon` (opacity 0.3) + "주문을 선택하면 상세 정보가 표시됩니다" — line 213-227
- [ ] 목록이 비어 있을 때: 아이콘 + "해당 조건의 주문이 없습니다" — line 574-578
- [ ] 로딩: `CircularProgress` size=32 — line 570-573

## 액션·기능 (누락 금지)

- [ ] 학회 필터 변경 → `filterEvent` 변경 → 주문 목록 재조회 — line 528-534
- [ ] 뷰 모드 토글 변경 → `viewMode` 변경 → 목록 + 우측 상세 둘 다 필터링 — line 546-555
- [ ] 주문 카드 클릭 → `selectedOrder` 설정, 모바일에서는 좌측 숨김 + 우측 표시 — line 564-589
- [ ] 출고 처리 버튼 클릭 → `status='completed'` 업데이트, "{이름}님의 주문이 출고 처리되었습니다." 토스트, 선택 주문 유지 — line 482-493
- [ ] 모든 `CopyableText` 클릭 → `navigator.clipboard.writeText` → "{필드명}을 복사했습니다." 토스트 (5종 — 이름·연락처·인싸이트 ID·도로명주소·상세주소·요청사항·관리자 메모)
  - 도구 팁: "클릭하여 복사" 기본, 필드별 커스텀 (예: "도로명주소 복사 (우편번호 제외)")
- [ ] 실시간 자동 갱신 없음(주문 처리 후 명시적 reload만)

## 입력 폼 구조 (이 화면은 편집 폼 없음, 출고 처리 버튼만)

주소 표시는 입력 폼이 아니지만, **입력 폼 분리 구조와 1:1 매칭돼야 함**:
- `CustomerInfoStep.jsx` line 171-231에서 주소는 세 필드로 분리 입력
  - `address` (도로명, Daum 우편번호 검색 결과)
  - `detailAddress` (상세주소, 직접 입력)
  - `postcode` (우편번호, readOnly)
- 따라서 출고 화면 표시도 세 줄 분리 + 각각 독립 복사 가능해야 함

## 권한별 차이

- master, editor (`orders:edit` 권한): "출고 처리" 버튼 표시
- viewer: 버튼 미표시, 조회만 가능
- 학회 필터·뷰 모드·복사 액션은 모든 권한에서 가능

## 데이터 모델

### `orders` 테이블 (출고 화면에서 SELECT하는 필드)
- `id` (bigint)
- `parent_order_id` (bigint, nullable) — 합배송 시 부모 주문 ID
- `customer_name` (text)
- `phone_number` (text) — 011/010 등 하이픈 포함 포맷
- `shipping_address` (jsonb) — **객체 구조**:
  - `postcode` (text)
  - `address` (text) — 도로명주소 (또는 `roadAddress`, `jibunAddress`도 fallback)
  - `detailAddress` (text) — 상세주소 (또는 `detail`도 fallback)
- `final_payment` (numeric)
- `delivery_fee` (numeric)
- `status` (text) — `pending`/`paid`/`completed`/`cancelled`/`refunded`
- `created_at` (timestamptz)
- `customer_request` (text, nullable)
- `admin_memo` (text, nullable)
- `event_id` (bigint, FK → events)
- `inpsyt_id` (text, nullable)

### join: `events(name)`, `order_items(...)`
- `order_items`: `product_id`, `quantity`, `price_at_purchase`, `product_name`, `product_code`, `category`, `list_price`
- `order_items.products(name, category)` (fallback용 — order_items 스냅샷이 없을 때)

### 클라이언트 가공 (`groupLinkedOrders`)
- parent 주문에 `linkedChildren`, `mergedItems`, `mergedTotal` 부여
- child 주문은 `parent_order_id`가 있는 채로 그대로 반환됨 (목록 필터에서 `parent_order_id` 있으면 숨김)

## 필터·뷰 모드

- 학회 필터: 학회 ID 단일 선택 or 전체. 기본 `''` (전체)
- 상태 필터: 코드에 박혀 있음 — `['paid', 'completed']`만 조회 (line 463-464)
- 뷰 모드: `all`/`book`/`test`. 카드 필터링(혼합은 양쪽에 표시) + 상품 행 그레이드 처리

## 빈 상태·로딩·오류 처리

- 빈 상태(좌측 목록): `LocalShippingIcon` opacity 0.3 + "해당 조건의 주문이 없습니다"
- 빈 상태(우측 상세, 미선택): `LocalShippingIcon` opacity 0.3 + "주문을 선택하면 상세 정보가 표시됩니다"
- 로딩: 좌측에 `CircularProgress`
- 오류: 상단 `Alert severity="error"` 형식 (toast 아님, 화면 안에 잔류)

## 핵심 발견 (시안 검수 시 반드시 확인)

1. **주소는 세 줄 분리 표시. 한 줄 통합 금지.** PR #6에서 통합된 한 줄로 시안이 만들어졌으나, 입력 폼이 도로명·상세·우편번호로 분리돼 있고 운영자가 출고처에 전달할 때 필드 단위로 복사하기 때문에 분리가 필수.
2. **상품 행마다 카테고리 칩 필수.** "도서"/"검사" 칩이 없으면 출고 운영자가 도서/검사 분리 작업을 할 수 없다. 뷰 모드 토글 자체가 카테고리 기반으로 작동하므로 칩이 빠지면 시각적 정합이 깨진다.
3. **주문자 보조 정보 4종(요청사항·관리자 메모·인싸이트 ID·연락처)은 동일한 라벨 + 값 패턴을 가져야 한다.** 한 카드 안에서 서식이 흩어지면 운영자는 위계를 다시 학습해야 한다.
4. **모든 표시 텍스트는 클릭하여 복사 가능.** 도구 팁 + 복사 아이콘이 일관되게 붙는다.
5. **합배송(parent_order_id) 상태는 좌측 카드의 "연계 N건" 배지로 노출.** 시안이 단일 주문만 가정하면 합배송 정보가 사라진다.

## 변경 이력

- 2026-05-13 신설 — PR #6 출고 시안 검수 중 주소 통합·카테고리 누락·서식 불일치 3건 발견. 게이트 1.5 절차 신설과 함께 작성.
