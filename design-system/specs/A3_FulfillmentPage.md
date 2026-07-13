# 사양 시트 — A3 출고 관리 (FulfillmentPage)

> 이 시트는 출고 관리 화면의 정보·기능·데이터 구조의 단일 진실 소스다.
> 시안과 실서비스 구현은 이 시트의 모든 항목을 1:1로 반영해야 한다.
> 임의 단순화·통합·생략은 건우님의 명시적 승인 후 이 시트를 먼저 갱신한 다음에만 허용된다.
> 마지막 갱신: 2026-06-12 전면 재작성 (그룹 카드 구조 + 출고 고도화 사이클 반영. 구 좌우 패널 구조 기술 폐기).

## 참조 파일
- 실 컴포넌트: `inpsyt-order-frontend/src/components/FulfillmentPage.jsx`
- 합성 컴포넌트: `inpsyt-order-frontend/src/components/ui/InfoRow.jsx` (인라인 복사), `ActionSlot.jsx`, `StatusBadge.jsx`, `EmptyState.jsx`, `SectionCard.jsx`, `PageHeader.jsx`
- 관련 API: `inpsyt-order-frontend/src/api/orders.js` 의 `getFulfillmentOrders`, `groupLinkedOrders`
- 관련 폼 컴포넌트(주소 입력 분리 구조 참조): `inpsyt-order-frontend/src/components/CustomerInfoStep.jsx`
- DB 스키마: `supabase/migrations/20250722070000_create_orders_table.sql` + `20250805_add_new_order_fields.sql` + `20250808040516_add_admin_memo_to_orders.sql` (`orders` 테이블)

## 사용자 시나리오
출고 담당자(도서/검사)가 학회 종료 후 사무실 PC에서, 또는 학회 중 태블릿으로 연다. 결제완료(`paid`) 주문을 그룹 카드로 확인하고, 연락처·인싸이트 ID·도로명/상세 주소를 필드 단위로 복사해 택배사/인싸이트 시스템에 붙여넣은 뒤 "출고 처리"(개별) 또는 체크박스 선택 후 "출고 완료 처리"(일괄)로 `status='completed'`로 바꾼다. 실수로 처리한 건은 완료 카드의 "출고 취소"로 `paid`로 되돌린다. 태블릿 겸용이므로 모든 복사 아이콘은 상시 노출(hover-reveal 금지).

## 표시 정보 (라벨 단위, 누락 금지)

### 페이지 헤더 (PageHeader)
- [ ] 제목: **"출고 관리"** + `LocalShippingIcon` (2026-06-12 "출고 현황"에서 개칭)
- [ ] 서브타이틀: "총 {N}건 · 대기 {N}건 · 완료 {N}건" — 학회+뷰모드 적용 후·상태/검색 적용 전 기준, 로딩 중에는 빈 문자열
- [ ] 헤더 우측 액션: "출고 완료 처리 (N)" 버튼 — `orders:edit` 권한 + 선택 건수>0일 때 활성

### 필터 카드 (SectionCard)
- [ ] 카드 제목: `FilterListIcon` + "필터"
- [ ] 학회 선택 드롭다운: 라벨 "학회", 기본값 "전체 학회" + DB 학회 목록
  - MenuItem: 학회명 + 시작일 `yyyy.M.d`(inline caption, null이면 "시작일 미정")
  - 옵션 정렬: `sortEventsForDropdown` — 오늘±7일 이내 시작 학회 최상단 고정, 그 다음 나머지. 각 그룹 내부 start_date 내림차순, null 맨 뒤 (`getEvents` 결과에 적용, `src/utils/eventSort.js`)
  - 렌더: `groupEventsForDropdown`으로 pinned/rest 분리, "전체 학회" 아래 상단 고정 그룹과 내림차순 그룹 사이 `<Divider/>`로 구분(양쪽 그룹 모두 있을 때만)
- [ ] 검색 TextField 1개: placeholder "이름·연락처·ID 검색" — customer_name·phone_number·inpsyt_id 부분일치(클라이언트, trim·소문자 비교)
- [ ] 상태 세그먼트 (ToggleButtonGroup): "출고 대기 ({N})" / "출고 완료 ({N})" / "전체" — **기본값 '출고 대기'**. 카운트 N은 학회+뷰모드 적용 후·상태 필터 적용 전 기준(상태 토글을 눌러도 양쪽 N이 살아있음)
- [ ] 뷰 모드 토글 그룹 — 3개: "전체" / "도서 뷰"(CATEGORY_COLORS.book) / "검사 뷰"(CATEGORY_COLORS.test)

### 그룹 카드 — 헤더 (FulfillmentGroupCard)
- [ ] 체크박스 (`orders:edit` 권한 보유 시만, 44×44 터치 영역)
- [ ] 고객명 (`customer_name`) — **인라인 복사 타깃**: 이름 텍스트 직후 16px ContentCopy 아이콘 상시 노출, 이름+아이콘 전체가 단일 클릭 타깃(cursor:copy), hover 시 알파 배경+아이콘 primary. 체크박스와 오터치 간격 유지
- [ ] StatusBadge: `status` 값 (paid/completed)
- [ ] 연계 칩(조건부): "연계 {N}건" (warning 색, parent 주문에 linkedChildren 있을 때만, N=자식+1)
- [ ] 결제금액: `mergedTotal ?? final_payment` 천 단위 콤마 + "원", tabular-nums, 우측 정렬
- [ ] 학회명 + 상품 개수(조건부): "{event.name} · {N}개 상품" (caption)
- [ ] 완료 카드는 카드 전체 opacity 0.7 — 별도 "출고처리 완료" 칩은 없음(StatusBadge가 상태 표시, 2026-06-12 중복 제거)

### 그룹 카드 — 데이터 라인 (InfoRow 5~6줄, 인라인 복사)
- [ ] 연락처: `phone_number`, mono(tnum), 값 있으면 인라인 복사, 없으면 "-" muted
- [ ] ID(조건부): `inpsyt_id` 존재 시만 렌더, mono, 인라인 복사 (복사 토스트 라벨 "인싸이트 ID")
- [ ] 도로명: **우편번호 `[{postcode}]` 병기(caption·tnum) + 도로명주소 한 줄**. 복사는 도로명주소만(우편번호 제외), multiline
- [ ] 상세: `detailAddress || detail`, multiline, 단독 복사. **도로명과 통합 금지** (핵심 발견 #1)
- [ ] 요청: `customer_request`(trim), multiline, 값 있으면 복사
- [ ] 메모: `admin_memo`(trim), multiline, 값 있으면 복사
- [ ] InfoRow 복사 패턴: 값 텍스트 직후 16px ContentCopy 아이콘(gray[400]) 상시 노출, 값+아이콘 단일 클릭 타깃, hover 알파 배경+아이콘 primary, 행 minHeight 40. 우측 끝 44px IconButton 패턴은 폐기(2026-06-12)

### 그룹 카드 — 현장수령 안내 (조건부)
- [ ] **주문 전체 현장수령** 판정(OR): `order.is_on_site_sale === true` OR (상품이 1개 이상이며 모든 item `on_site_pickup === true`)일 때 헤더 안내줄 노출 — "현장수령" 배지(StatusBadge kind=category, warning 톤) + "현장 수령 주문건 · 택배 출고 불필요" 캡션. **숨김 금지**(판매량 파악용, 수량·상품명·금액 그대로 노출)

### 그룹 카드 — 액션 행 (ActionSlot, 버튼 없으면 행 자체 미렌더)
- [ ] "출고 처리" 버튼: `status='paid'` + `orders:edit`일 때만. contained success + CheckCircleIcon. **주문 전체 현장수령이면 라벨 "확인 완료"로 치환**(status는 그대로 completed로 UPDATE — 라벨만 치환)
- [ ] "출고 취소" 버튼: `status='completed'` + `orders:edit`일 때만. outlined. **주문 전체 현장수령이면 라벨 "확인완료 취소"로 치환**(status는 그대로 paid로 UPDATE)
- [ ] 조회 전용(`orders:edit` 미보유) 사용자는 액션 행 자체가 보이지 않음
- [ ] 구 "단축 복사" 5종 아이콘 버튼 행은 폐기(2026-06-12) — 인라인 복사로 일원화

### 그룹 카드 — 상품 목록
- [ ] 행 5컬럼 그리드: 상품명(ellipsis) / 분류 칩 / 단가 / ×수량 / 합계
- [ ] 분류 칩 — **누락 금지** (핵심 발견 #2): `StatusBadge kind="category"`, 라벨은 원본 `rawCategory`, 색은 정규화 후 키('도구'→'검사'→test) — book/test 색은 CATEGORY_COLORS
- [ ] 단가 `price_at_purchase`, 수량 `quantity`, 합계 = 단가×수량 — 모두 tabular-nums 우측 정렬
- [ ] 뷰 모드별 그레이드: book 뷰에서 검사 상품, test 뷰에서 도서 상품은 opacity 0.35 + gray[50] 배경
- [ ] **상품별 현장수령**(`isWholeOnSite || item.on_site_pickup === true`): 뷰 모드와 무관하게 해당 상품 행 dim(기존 isGreyed 패턴 재사용, opacity 0.35 + gray[50]) + 상품명 옆 "현장수령" 배지(StatusBadge kind=category, warning 톤). 출고 제외 표시일 뿐 수량·상품명·금액은 그대로 노출(숨김 금지). **B=true(`isWholeOnSite`, 상위 계층)면 개별 체크와 무관하게 전체 상품행이 일관되게 dim+배지** — A/B 계층 표시 일관성 확보

### 그룹 카드 — 합계 영역
- [ ] 배송비(조건부): `delivery_fee > 0`일 때 "배송비 {N}원 포함" (caption, 우측 정렬)

## 액션·기능 (누락 금지)
- [ ] 학회 필터 변경 → 서버 재조회 (`getFulfillmentOrders`) + 선택 초기화
- [ ] 검색 입력 → 클라이언트 필터 (이름·연락처·ID 부분일치)
- [ ] 상태 세그먼트 변경 → 클라이언트 필터 + 선택 초기화 (데이터 로드는 paid+completed 일괄 유지)
- [ ] 뷰 모드 변경 → 카드 필터링(혼합은 양쪽에 표시) + 상품 행 그레이드 + 선택 초기화
- [ ] 체크박스 선택/해제 (`orders:edit`만) → 헤더 "출고 완료 처리 (N)" 버튼 카운트 갱신
- [ ] 일괄 출고: 헤더 버튼 → **확인 다이얼로그 "{N}건을 출고 완료 처리할까요?" (취소/처리, MUI Dialog — 전역 theme radii)** → 확인 시 `eligibleSelectedIds`(선택분 중 현재 표시 중인 paid만)에 한해 `status='completed'` 일괄 update → "{N}개 주문이 일괄 출고 처리되었습니다." 토스트 → 재조회
- [ ] 개별 출고 처리: `status='completed'` update → "{이름}님의 주문이 출고 처리되었습니다." 토스트 → 재조회
- [ ] 출고 취소: 완료 카드 버튼 → `status='paid'` update → "{이름}님의 주문을 출고 대기로 되돌렸습니다." 토스트 → 재조회
- [ ] 인라인 복사(이름·연락처·인싸이트 ID·도로명주소·상세주소·요청사항·관리자 메모): `navigator.clipboard.writeText` → "{라벨}을(를) 복사했습니다." 토스트, 실패 시 "복사에 실패했습니다."
- [ ] 재조회(`loadOrders`) 시마다 선택 초기화
- [ ] 실시간 자동 갱신 없음(처리 후 명시적 reload만)
- [ ] 상태 update 시 status_history·audit_log는 기존 DB 트리거가 기록 — 페이지에서 별도 호출 없음. 알림톡 발송 없음(알림톡은 주문관리/상세모달의 명시적 발송 플로우 전용)

## 입력 폼 구조 (이 화면은 편집 폼 없음 — 표시가 입력 분리 구조와 1:1 매칭돼야 함)
- `CustomerInfoStep.jsx`에서 주소는 세 필드로 분리 입력: `address`(도로명, Daum 검색) / `detailAddress`(직접 입력) / `postcode`(readOnly)
- 따라서 출고 화면 표시도 도로명(+우편번호 병기)·상세 분리 + 각각 독립 복사. **한 줄 통합 금지**

## 권한별 차이
- `orders:edit` 보유(master, editor): 체크박스·개별 출고 처리·일괄 출고·출고 취소
- 미보유(viewer 등): 조회·필터·검색·복사만. 체크박스와 액션 행 미렌더
- 메뉴 접근 자체는 `orders:view` (AdminLayout 라우트 게이트)

## 데이터 모델

### `orders` 테이블 (SELECT 필드)
- `id` (bigint)
- `parent_order_id` (bigint, nullable) — 합배송 시 부모 주문 ID. 있으면 목록에서 숨김
- `customer_name` (text)
- `phone_number` (text) — 하이픈 포함 포맷
- `shipping_address` (jsonb) — **객체 구조, 3요소 분리 유지**:
  - `postcode` (text)
  - `address` (text) — 도로명 (fallback: `roadAddress`, `jibunAddress`)
  - `detailAddress` (text) — 상세 (fallback: `detail`)
- `final_payment` (numeric)
- `delivery_fee` (numeric)
- `status` (text) — 이 화면은 `paid`/`completed`만 조회
- `created_at` (timestamptz)
- `customer_request` (text, nullable)
- `admin_memo` (text, nullable)
- `event_id` (bigint, FK → events)
- `inpsyt_id` (text, nullable)

### `orders` 추가 필드
- `is_on_site_sale` (boolean) — 주문 전체 현장수령 판정(OR 규칙)에 사용

### join: `events(name)`, `order_items(...)`
- `order_items`: `id`, `product_id`, `quantity`, `price_at_purchase`, `product_name`, `product_code`, `category`, `list_price`, `on_site_pickup`
- `order_items.on_site_pickup` (boolean, DEFAULT false) — 상품별 현장수령 dim·배지 + 주문 전체 현장수령 판정에 사용
- `order_items.products(name, category)` — order_items 스냅샷이 없을 때 fallback

### 클라이언트 가공 (`groupLinkedOrders`)
- parent 주문에 `linkedChildren`, `mergedItems`, `mergedTotal` 부여
- child 주문은 `parent_order_id`가 있는 채로 반환 → 목록 필터에서 숨김

## 필터·뷰 모드
- 학회 필터: 단일 선택 or 전체, 기본 `''` (서버 필터)
- 데이터 로드 상태: 코드 고정 — `['paid', 'completed']` 일괄 조회
- 상태 세그먼트: `paid`(출고 대기) / `completed`(출고 완료) / `all`. **기본 `paid`**. 클라이언트 필터
- 검색: 이름·연락처·ID 부분일치. 클라이언트 필터
- 뷰 모드: `all`/`book`/`test`. 카드 필터링 + 상품 행 그레이드. '도구' 카테고리는 '검사'로 정규화
- 적용 순서: [서버] 학회 → [클라] parent 숨김 → 뷰모드 → (여기까지가 카운트 기준) → 상태 세그먼트 → 검색

## 빈 상태·로딩·오류 처리
- 검색 결과 0건: `SearchOffIcon` + "검색 결과가 없습니다" / "이름·연락처·ID를 다시 확인해 보세요"
- 대기 탭 0건(검색 없음): `CheckCircleIcon` + "출고 대기 주문이 없습니다" / "모두 처리됐어요"
- 그 외 0건: `LocalShippingIcon` + "해당 조건의 주문이 없습니다" / "학회 필터 또는 뷰 모드를 변경해 보세요"
- 로딩: `CircularProgress` size=32 중앙
- 오류: 상단 `Alert severity="error"` (toast 아님, 화면 안 잔류)

## 핵심 발견 (시안·구현 검수 시 반드시 확인)
1. **주소는 도로명(+우편번호 병기)·상세 분리 표시. 한 줄 통합 금지.** 입력 폼이 분리돼 있고 택배 접수 시 필드 단위 복사가 필요.
2. **상품 행마다 카테고리 칩 필수.** 칩이 빠지면 도서/검사 분리 출고 작업과 뷰 모드 토글의 시각 정합이 깨진다.
3. **복사는 인라인 단일 패턴.** 값 직후 상시 노출 아이콘 + 값 전체 클릭 타깃. hover-reveal·우측 끝 IconButton·단축 복사 행은 모두 폐기됨(2026-06-12).
4. **합배송(parent_order_id)은 "연계 N건" 칩으로 노출.** 단일 주문만 가정하면 합배송 정보가 사라진다.
5. **일괄 출고는 eligibleSelectedIds(표시 중인 paid 선택분)만 처리.** 필터 변경으로 화면에서 사라진 선택분이 처리되는 사고 방지 — 필터·재조회 시 선택 초기화와 한 쌍.
6. **출고 취소는 completed→paid 단순 복귀.** 알림톡 재발송 없음(발송은 주문관리 플로우의 명시적 호출 전용). status_history·audit_log는 DB 트리거가 기록.

## 변경 이력
- 2026-05-13 신설 — PR #6 출고 시안 검수 중 주소 통합·카테고리 누락·서식 불일치 3건 발견. 게이트 1.5 절차 신설과 함께 작성.
- 2026-06-12 전면 재작성 — 구 좌우 패널 구조 기술 폐기, 현 그룹 카드 구조 반영. 출고 고도화 사이클: 명칭 "출고 관리" 개칭 / 상태 세그먼트(기본 출고 대기) / 검색 / InfoRow 인라인 복사(우측 IconButton·단축 복사 행 폐기) / 고객명 인라인 복사 / 일괄 처리 안전화(eligible만 + 확인 다이얼로그 + 선택 초기화) / 출고 취소 / "출고처리 완료" 중복 칩 제거.
- 2026-07-07 현장수령 연동 — `getFulfillmentOrders` select에 `orders.is_on_site_sale` + `order_items.id, on_site_pickup` 추가. OR 규칙(주문 is_on_site_sale OR item on_site_pickup)으로 현장수령 판정. 상품별 현장수령: 기존 isGreyed dim 재사용 + "현장수령" 배지. 주문 전체 현장수령: 헤더 안내줄("택배 출고 불필요") + 액션 라벨 "출고 처리"→"확인 완료"/"출고 취소"→"확인완료 취소" 치환(status는 여전히 completed/paid로 UPDATE, 라벨만 치환). **숨김 금지**(판매량 파악용).
- 2026-07-08 합배송 껍데기 부모 모델 — `getFulfillmentOrders` select에 `is_group_parent` 추가. 그룹 카드 상태 배지·필터·카운트는 `effectiveStatus`(껍데기=`summarizeGroupStatus` 종합값, 그 외=자기 status). **그룹 일괄 출고 결함 수정**: "출고 처리"/"출고 취소"가 껍데기면 모든 활성 자식 status를 함께 UPDATE(`shipTargetIds` — 기존 대표 1건만 바뀌던 결함 제거). 일괄 출고도 선택된 껍데기를 활성 자식으로 확장(`bulkTargetIds`). "연계 N건" 칩 N=자식 수(`linkedChildren.length`). 자식 행은 여전히 목록에서 숨김.
