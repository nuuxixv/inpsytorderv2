# 사양 시트 — C1 고객 주문서 (OrderPage)

> 이 시트는 고객 주문서 화면의 정보·기능·데이터 구조의 단일 진실 소스다.
> 시안과 실서비스 구현은 이 시트의 모든 항목을 1:1로 반영해야 한다.
> 임의 단순화·통합·생략은 건우님의 명시적 승인 후 이 시트를 먼저 갱신한 다음에만 허용된다.
> 마지막 갱신: 2026-06-29 **상품 카드 이미지 플레이스홀더 폐기 — 이미지 없으면 슬롯 자체 미렌더**(건우님 결정). 기존 카테고리 색 틴트 박스+ImageIcon 플레이스홀더 제거, `getProductImageUrl(image_filename)`이 null이거나 onError면 `ProductImageSlot`이 `return null`(슬롯 미렌더, 빈 박스 0). 상품명/배지/가격이 카드 상단부터 자연 배치. 이유: 행사 단위로 이미지 유무가 갈림(도구=전부 있음 / 검사·도서=전부 없음, 혼재 없음), 도서·검사는 상품명·옵션 직관성이 이미지보다 중요. **혼재 처리 로직 추가 안 함(오버엔지니어링 방어).** §상품 카드 절 참조.
> 이전 갱신: 2026-06-29 상품 카드 1:1 이미지 슬롯 추가(PRD `DOCS/PRD_상품이미지.md`, P1). `products.image_filename`→`product-images` 공개 버킷 `getPublicUrl`. graceful(컬럼·버킷 미적용 환경 회귀 0). (※ 플레이스홀더는 위 결정으로 폐기.)
> 이전 갱신: 2026-06-29 배지 "최대 2개"는 **표출 정책(본 카드 한정)** 임을 명시 — 입력단(A6 폼·엑셀)은 무제한, 상위 2개 선별 책임은 본 카드 가드레일에 있음(건우님 확정 #1·#2, §상품 카드 동적 배지 절). 카드 코드 변경 없음(정책 문서화).
> 이전 갱신: 2026-06-29 단일 대분류 행사(visible_categories 1종) 상품 카드 상위 카테고리 칩 숨김 — 전부 같은 대분류라 무의미·혼란(`도구`→`검사` 표기 오해 제거), 소분류 칩으로 탐색. 다른 행사(없음/NULL/복수)는 기존 칩 유지(회귀 0). `ProductCard.hideCategoryBadge` prop(`ProductSelectionStep.isSingleCategory` 전달). 건우님 결정.
> 이전 갱신: 2026-06-29 상품 카드 동적 배지(`products.badges`) 표출 구현 — 강조 배지 최대 2개·priority 정렬·미등록 미표시·graceful(실 코드 변경 반영, P1 Open Question 4 확정).

## 참조 파일
- 실 컴포넌트: `inpsyt-order-frontend/src/components/OrderPage.jsx` (418줄, 3-step 컨테이너)
- 자식 단계: `ProductSelectionStep.jsx`(③ 계층 진열 반영) / `CustomerInfoStep.jsx`(282줄) / `OrderReviewStep.jsx`(140줄)
- 보조: `OrderStepIndicator.jsx`(110줄), `FloatingBottomBar.jsx`(189줄), `CartBottomSheet.jsx`(215줄), `ProductCard.jsx`(213줄, 도서·평면 그리드 카드), `TestGroupCard.jsx`(③ 검사군 2뎁스 카드), `CostSummary.jsx`(135줄)
- 진열 유틸: `utils/productGroup.js`(③ 그룹핑 `groupProducts` / 표시명 파싱 `parseProductName` / 할인가 `getDiscountedPrice`) + `productGroup.test.js`
- Edge Function: `supabase/functions/create-order/index.ts` (서버측 금액 재계산 + INSERT)
- 진입 리다이렉트: `GoRedirect.jsx` (`active_event_slug` 사용)
- DB 스키마: `supabase/migrations/20250722070000_create_orders_table.sql` + `20250805_add_new_order_fields.sql` + `20260406_add_status_history_to_orders.sql` + `20260406_add_access_token_to_orders.sql` + 그 외 events/order_items/products/site_settings 관련 파일
- 외부 라이브러리: `react-daum-postcode` (우편번호 검색)

## 사용자 시나리오
의료 학회 부스를 방문한 의사·연구자가 본인 모바일로 학회 전용 링크(`/order?events={slug}`) 또는 QR을 통해 진입한다. 학회 기간 중에만 열리는 화면이고, 결제는 부스 운영자에게 카드를 건네 단말기에서 처리한다. 따라서 이 화면 자체에는 결제 모듈이 붙지 않는다 — 주문 정보를 모으고 제출하는 자리다. 본인 비용 구매라 할인 적용·무료배송 기준선이 결정에 큰 영향을 준다. 1차 사용자는 50대 의사가 안경 너머로 본다는 가정을 잊지 않는다. 진행은 3단계 — 상품 선택 → 주문자 정보 → 확인. 우측 하단 플로팅 바가 각 단계의 다음 액션을 노출한다.

## 진입 흐름
- [ ] `/order?events={slug}` 직접 진입 — `useSearchParams`로 `events` 쿼리 파라미터 추출 (`OrderPage.jsx:29`)
- [ ] `/go` 단축 진입 — `GoRedirect.jsx`가 활성 학회 슬러그(`active_event_slug`)를 받아 `/order?events={slug}`로 `window.location.replace`
- [ ] 어드민 학회 관리 화면에서 운영자가 슬러그 URL을 복사·QR 생성해 고객에게 전달 — `EventManagementPage.jsx:257·263·478·777`
- [ ] 알림톡 본문의 주문 상태 링크(`/order/status/{access_token}`)는 별개 화면 (이 시트의 범위 아님)

## 표시 정보 (라벨 단위, 누락 금지)

### 전 단계 공통 — 상단 헤더 (`OrderPage.jsx:271-295`)
- [ ] 좌·우 균형 공백 박스(`flex: 1`) — 가운데 정렬용
- [ ] 브랜드 타이틀 텍스트 — `variant="subtitle2"`, 굵게(`fontWeight: 800`), letter-spacing 1
  - 일반 모드: "인싸이트 · 학지사 상품 주문하기" (`color: primary.main`)
  - 현장구매 모드(트리플탭 토글, `isOnsitePurchase=true`): " · 현장구매" 접미사 추가, `color: warning.main`
- [ ] 트리플탭(600ms 내 3회 탭) 시 현장구매 모드 토글 — `tapCountRef`, `tapTimerRef` (`OrderPage.jsx:276-287`)
  - 토글 가능 조건: `activeStep < 2` (확인 단계에서는 비활성)
  - 토글 시 `Snackbar` 표시: 켤 때 "현장구매 모드로 전환됐어요" / 끌 때 "일반 배송 모드로 전환됐어요" (anchor top center, 2000ms, 코드엔 이모지 포함)

### 전 단계 공통 — 스텝 인디케이터 (`OrderStepIndicator.jsx`)
- [ ] sticky top, `bgcolor: background.paper`, 하단 1px divider, py 1.5, minHeight 56
- [ ] **전 단계(Step 0 포함) 항상 표시** — 3단계(상품선택→주문자정보→주문확인) 인디케이터 노출. (2026-06-01 건우님 — 기존 Step0 숨김 'Lounge mode' 폐기, 첫 화면부터 전체 흐름 인지)
- [ ] 3개 스텝: "상품 선택" / "주문자 정보" / "주문 확인" — 가운데 정렬, 라인 커넥터(32x2)로 연결
- [ ] 단계별 상태 표시:
  - 미완료: 회색 원(`grey.200`) + 번호, 라벨 `text.disabled`
  - 활성: `primary.main` 원 + 번호, 라벨 `primary.main`, `fontWeight: 700`
  - 완료: `primary.main` 원 + `CheckIcon`, 라벨 `text.primary`, 커넥터도 `primary.main`

### 전 단계 공통 — 에러 알림 (`OrderPage.jsx:301-309`)
- [ ] `Alert severity="error"`, dismissable(닫기 가능), `borderRadius: '12px'`, mx 2 mt 2
- [ ] 발생 조건:
  - Step 0 → 1 전환 시 장바구니 비어 있음: "상품을 1개 이상 담아주세요." (`OrderPage.jsx:131`)
  - Step 1 → 2 전환 시 필수 정보 미입력: "필수 정보(성함, 연락처, 이메일)를 입력해주세요." (`OrderPage.jsx:139` — 텍스트 안의 "이메일"은 현 코드 잔재. **이메일 컬럼이 drop된 상태이므로 시안에서는 "필수 정보(성함, 연락처)를 입력해주세요."로 정리. 실 코드 문구도 동기 수정 필요** — 확인 필요)
  - 제출 실패: "주문 처리 중 오류가 발생했습니다: {error.message}" (`OrderPage.jsx:198`)

### 전 단계 공통 — 페이지 컨테이너 (`OrderPage.jsx:259-269`)
- [ ] `minHeight: 100vh`, `display: flex`, `flexDirection: column`
- [ ] `maxWidth: 600` 가운데 정렬 (모바일 우선이지만 데스크탑 폭 제한)
- [ ] 배경색: `activeStep < 2` → `background.paper` (흰색) / `activeStep === 2` → `#F8F9FA` (회색) — 0.3s ease transition
- [ ] **레이아웃 = 풀폭 회색 음영 backdrop(`gray[100]`=#F2F4F6) + 600px 중앙 컬럼.** 컬럼(inner Box) 표면색은 Step 0·1 흰색 / Step 2 `gray[50]`. 모바일앱을 PC 가운데 둔 프레임. (2026-06-01 건우님 — 600 바깥은 음영이어야 함. ※한때 풀폭 흰색 seamless로 잘못 갔다가 복구)
- [ ] 콘텐츠 영역 하단 `pb: 100px` (플로팅 바 가림 방지)

### Step 0 — 상품 선택 (`ProductSelectionStep.jsx`)

#### 헤더 (line 152-162)
- [ ] 페이지 제목 텍스트: "상품을 선택해주세요" — `variant="h3"`, `fontWeight: 800`
- [ ] 부제(조건부, `eventName` 있을 때): "{이벤트명}" + `discountRate > 0`이면 " · {N}% 할인 적용" 접미사 — `variant="body2"`, `color: text.secondary`

#### 검색바 (line 165-188)
- [ ] `TextField` 풀너비, 시작 아이콘 `SearchIcon`(text.disabled)
- [ ] 플레이스홀더: "상품명으로 검색 (띄어쓰기로 여러 키워드)"
- [ ] 시각: **흰색 기본 아웃라인 TextField(글로벌 테마), `sx={{ mb: 2 }}`만.** (2026-06-01 건우님 결정 — /preview 목업 정합. 기존 회색 채움 `#F2F4F6`/height48/보더투명 폐기. 단 플레이스홀더의 멀티키워드 힌트는 기능 안내라 유지)

#### 뷰 모드 칩 (line 192-219)
- [ ] 가로 스크롤 영역, 칩 3개:
  - "전체" (key=`all`)
  - "인기" (key=`popular`, `StarIcon`) — 기본 선택
  - "신규출시" (key=`new`, `NewIcon` = `FiberNew`)
- [ ] 선택 시 filled+primary, 비선택 시 outlined default. **라운드 `radii.sm`(8px) = 둥근 사각(알약형 아님). 2026-06-01 목업 정합**
- [ ] 검색어가 있을 때는 뷰 모드 필터링 무시 (line 62-65)

#### 카테고리 칩 (line 221-248)
- [ ] 동적 목록 — `['검사', '도서']` + `allProducts`에서 추출한 `category`의 unique 합집합 (line 134-136) + 맨 앞 "전체"(`all`). **`도구`는 `검사`로 정규화 — 별도 칩 노출 안 함, `검사` 선택 시 도구도 포함 (2026-06-01 건우님 규칙)**
- [ ] 선택 시 filled+secondary, 비선택 시 outlined default. **라운드 `radii.sm`(8px) — 뷰 모드 칩과 동일(2026-06-01 목업 정합)**

> **(구현 완료 — 2026-06-25, 행사별 판매 대분류 필터):** 행사가 "도구"만 파는 경우(오티즘 엑스포), 대분류 "도구" 칩을 숨기고 **그 하위 소분류 칩(인지/언어/상담 등, `products.sub_category` 기준)** 으로 탐색하게 한다.
> - **노출 필터(1차)**: `eventInfo.visible_categories`(events 신규 text[] 컬럼)가 값 있으면 **원본 `product.category`**(검사/도서/도구) ∈ visible_categories 인 상품만 노출(`baseProducts`, `ProductSelectionStep.jsx`). ⚠️ 매칭은 **원본 category** 기준 — 도구→검사 정규화는 칩 표시 전용이라 필터에 미적용. NULL 또는 빈 배열 → 전체 노출(기존 행사 보존). 기존 `eventTags`(tags) 필터와 AND 공존.
> - 대분류 "도구" 상위 칩은 **숨김** — 행사가 단일 대분류만 팔면(`visible_categories.length === 1`) 대분류 칩 자체가 무의미(전부 같은 대분류).
> - **(2026-06-29 추가) 상품 카드 상위 카테고리 칩도 숨김**: 단일 대분류 행사(`isSingleCategory`)에서는 `ProductCard`에 `hideCategoryBadge={true}`를 넘겨 카드 상단 카테고리 배지(§아래 ProductCard 카테고리 배지, `도구`→`검사` 표기 포함)를 **렌더하지 않음**. 전부 같은 대분류라 칩 반복이 무의미하고, `도구`→`검사` 표기가 고객에게 혼란. **강조 배지(인기/신규/동적)·상품명·가격은 영향 없음.** `도구`→`검사` 정규화 로직 자체는 다른 행사용으로 유지(단일 대분류일 때만 칩 숨김). 다른 행사(visible_categories 없음/NULL/복수 대분류)는 기존대로 카드 카테고리 칩 표시(회귀 0). 건우님 결정.
> - 단일 대분류 행사 카테고리 칩 = **`baseProducts`에서 추출한 `sub_category` 목록**(localeCompare 정렬) + "전체" + (미지정 상품 있으면 "기타"). 소분류 칩 클릭 시 `sub_category` 일치 필터(미지정은 "기타"로 매칭). **소분류 2종 미만이면 칩 줄 자체 숨김**(탐색 무의미).
> - 여러 대분류를 함께 파는 행사·NULL·빈 배열이면 **기존 대분류 칩**(검사/도서, 도구→검사 정규화) 그대로 노출.
> - 칩 시각(`radii.sm`·filled secondary)은 기존 패턴 유지. 소분류 색 칩 미적용(AI 시그니처 컬러 인디케이터 금지).
> - **저장 위치 확정**: A5 판매 대분류 = `events.visible_categories` 신규 text[] 컬럼(tags 겸용 기각, `20260624000000_DRAFT` 마이그레이션). graceful: 컬럼/GRANT 미적용 환경에서는 OrderPage가 `visible_categories` 뺀 레거시 select로 fallback → 전체 노출 유지.

#### 상품 진열 — 검사군 2뎁스 + 도서 그리드 (③ 상품 계층화, 2026-06-16)
- [ ] **레이아웃 분기**: 검사·도구(`parent_code` truthy로 그룹핑됨) = **풀폭 1열 리스트**(`TestGroupCard`) / 도서·평면(`parent_code` null) = **기존 그리드**(`ProductCard`).
  - '전체' 카테고리 뷰: `[검사 리스트 블록 → 도서 그리드 블록]` 순. 각 블록 위 `overline` 미니헤더("검사 · 도구" / "도서") — 단일 카테고리 선택 시 미니헤더 미표시.
  - '검사' 칩 = 리스트 블록만 / 그 외 평면 카테고리('도서' 등) 칩 = 그리드 블록만.
- [ ] **그룹핑(클라)**: `groupProducts`(`utils/productGroup.js`)가 `parent_code`로 묶음. **graceful — `parent_code`가 truthy인 행만 그룹, falsy(미적용/도서)면 평면 단일.** 마이그레이션 미적용 환경에서도 전부 평면(기존 동작) 보존.
  - 표시명은 클라 파싱(`parseProductName`): groupName = name 마지막 `_{옵션}` 앞부분, optionName = `_` 뒤부분. 파싱 실패(`_` 없음) 시 풀네임 fallback.
- [ ] CSS Grid(도서), `gridTemplateColumns: 'repeat(auto-fill, minmax(155px, 1fr))'`, gap 1.5
- [ ] 페이지네이션: **도서 그리드에만** 40개씩 무한 스크롤(`IntersectionObserver`, `PAGE_SIZE=40`). 검사군(340)은 페이지네이션 없이 전량 — 평균 3.3옵션·340군이라 리스트 가벼움.
- [ ] 정렬 규칙: 인기 상품 우선(`is_popular`) → 이름 오름차순(`localeCompare`). 검사군 내부 옵션도 동일 정렬.
- [ ] 필터 조합: 학회 태그(`eventTags`) ∩ 카테고리 ∩ 뷰 모드(인기/신규/전체) ∩ 검색
  - 검색 중에는 학회 태그·뷰 모드 무시
  - **검색 = 검사군 단위**: ①groupName 1차 매칭 → ②실패 시 옵션명(optionName) fallback. fallback 매칭 검사군은 펼친 상태로 노출. 옵션 낱개 결과는 쏟아내지 않음. 도서는 상품명 직접 매칭. 매칭 옵션 별색 하이라이트 안 함(룰 E).

#### 검사군 카드 (`TestGroupCard.jsx`, ③ 2026-06-16)
> 2뎁스 인라인 아코디언. 바텀시트·상세진입 기각(맥락 끊김·CartBottomSheet 중첩 방지). 3상태.
- [ ] **(1) 접힘**: `ProductCard`와 동일 1.5px 보더 Card(radius lg, shadow none).
  - 배지(소프트 틴트, `ProductCard`와 동일 패턴): "검사"(`info` 틴트) + 그룹 내 하나라도 인기면 `StarIcon`+"인기"(`accent.attention` 틴트) + 하나라도 신규면 "NEW"(`error` 틴트).
  - 검사명 `subtitle1`(16/700). "옵션 N개" `body2`/`text.secondary` — **가격 미표기**(건우님 확정: 검사군 카드 가격 오해·노안 숫자부담 제거).
  - 우측 `ExpandMore`/`ExpandLess`. 그룹에 담긴 옵션 있으면 보더 `primary` + "담음 N" 배지(`primary` 틴트).
  - `role=button`·`aria-expanded`·Enter/Space 토글.
- [ ] **(2) 펼침**: 카드 내부 `Divider` 아래 옵션 행 세로 리스트(**카드 안 카드 금지** — 행+Divider).
  - 옵션 행 = 좌측 옵션명(`body2`/600, 2줄 wrap) + 가격 / 우측 담기 or 수량 스테퍼.
  - 가격 = `ProductCard` 로직 재사용(`getDiscountedPrice`): 할인 시 정가 line-through + `%`(빨강) + 할인가(`primary`), 비할인 단독.
  - 담기 = 회색 outlined(테마 기본) / 스테퍼 = `primary`(수량 1에서 − = `DeleteIcon`).
  - 행 클릭 무반응, 담기/스테퍼만 동작(`e.stopPropagation`). 펼침 = MUI `Collapse`, `easing.toss` 0.2s.
- [ ] **(3) 옵션 1개**(실측 25군): 펼침 없이 접힘 카드에 가격·담기 즉시. "옵션 N개"·펼침 인디케이터 미표시.
- [ ] **다문화 등 옵션 다수(8개↑)**: 펼친 옵션 영역 `maxHeight 320 + overflowY auto`, 컨테이너 `display:flex; flexDirection:column; minHeight:0`(스크롤 결함 교훈).

#### 상품 카드 (`ProductCard.jsx`)
- [ ] 보더 1.5px — 장바구니에 있으면 `primary.main`, 없으면 `divider`
- [ ] **상품 이미지 슬롯 (배지 영역 위, mb 1) — (2026-06-29 구현, PRD `DOCS/PRD_상품이미지.md`; 2026-06-29 플레이스홀더 폐기, 건우님 결정):**
  - **1:1 정방형**(`aspectRatio: '1 / 1'`, 풀폭), `radii.sm` 라운드, `overflow: hidden`. 카드 상단에 위치(배지·상품명·가격 위).
  - `products.image_filename` 있으면 `getProductImageUrl(filename)`(`api/productImages.js` — `product-images` 공개 버킷 `getPublicUrl`, 서명URL 아님)로 `<img objectFit:cover loading:lazy>`. 배경 `gray[50]`.
  - **이미지 없으면(URL null) 또는 onError면 슬롯 자체 미렌더(`ProductImageSlot`이 `return null`).** 플레이스홀더(카테고리 색 틴트 박스·ImageIcon) **폐기**(2026-06-29). 빈 박스·여백 0 — 배지/상품명/가격이 카드 상단부터 자연 배치(CardContent flex column 첫 요소가 배지 영역). **대부분 상품이 미등록(NULL)이 정상** — 슬롯 미표시가 기본.
  - 이유: 행사 단위로 이미지 유무가 갈림(도구=전부 있음 / 검사·도서=전부 없음, **한 행사 내 혼재 없음**), 도서·검사는 상품명·옵션 직관성이 이미지보다 중요. **혼재 처리 로직 추가 안 함(오버엔지니어링 방어).**
  - graceful: `image_filename` 컬럼·`product-images` 버킷 미적용 환경에서도 회귀 0(URL null → 슬롯 미렌더). AI 시그니처·그라데이션 없음.
  - 레이아웃 = **현재 평면 그리드 기준**(③ 검사 2뎁스 미머지 — 머지 시 `TestGroupCard` 이미지 적용 여부 재검토, PRD 명시).
- [ ] 상단 배지 영역 (mb 0.75):
  - **배지 = 솔리드 칩 아님. 소프트 틴트 박스(높이 18, radius 4px, alpha 0.12~0.14 배경 + 컬러 텍스트). 2026-06-01 /preview 목업 정합.**
  - 카테고리 배지 — `category` 있으면 표시(`도구`는 `검사`로). `검사`=`alpha(info.main,0.14)` 배경+`info.dark` 텍스트 / 그 외(`도서` 등)=`gray[200]` 배경+`text.secondary`. **단, `hideCategoryBadge=true`(단일 대분류 행사)면 이 배지 미렌더 — §행사별 판매 대분류 필터 규약 참조.**
  - 인기 배지 — `is_popular=true`일 때, `alpha(accent.attention,0.14)` 배경 + `accent.attention` 색 + **`StarIcon`(11px) + "인기" 텍스트** (★ 단독 아님)
  - 신규 배지 "NEW" — `is_new=true`일 때, `alpha(error.main,0.12)` 배경 + `error.main` 텍스트
  - **(P1 동적화 — 구현 완료 2026-06-29) 동적 배지(`products.badges`, 마스터 `badges`)** — 마스터 색(소프트 틴트, `alpha(color, 0.13)` 배경 + `color` 글자, 높이 18·radius 4 — 기존 배지와 동일 `BadgeBox` 패턴. **솔리드 칩·보더·그라데이션 금지**). 색·우선순위는 `ProductSelectionStep`이 `fetchBadges()`로 마스터를 1회 페치해 `badgeMetaByName`(이름→{color, priority}) 맵으로 카드에 전달. 색 없으면 `MASTER_COLOR_FALLBACK`(회색). **가드레일(필수):**
    - **카드당 강조 배지 최대 2개**(`MAX_EMPHASIS_BADGES`). 강조 배지 후보 = is_popular(인기) + is_new(NEW) + 동적 배지(마스터 등록된 것만). priority ASC 정렬 후 **상위 2개만** 표시, 초과분은 조용히 컷(말줄임·+N 표기 없음 — 카드 과밀·노안 부담 방지).
    - **(2026-06-29) "최대 2개"는 입력 제약이 아니라 표출 정책 — 고객 카드(본 화면) 한정.** 운영자 입력단(A6 상품 폼 칩 토글·엑셀 업로드)은 배지를 **무제한** 받는다(폼은 3개째부터 회색 안내, 엑셀은 2개 초과 행을 경고 로그만 남기고 upsert 통과). 어드민 표(A6)는 전량 노출(§A6 발견 12). 즉 `products.badges`에는 2개를 초과하는 값이 저장될 수 있으며, **상위 2개만 골라 보여주는 책임은 본 카드의 가드레일(이 절)에 있다.** 폼·엑셀·카드 단일 규칙(§A6 발견 13).
    - **카테고리 배지(검사/도서)는 상한 카운트에서 제외**(분류 정보로 강조 배지와 성격이 다름 — 검사군 카드 §line 108 패턴과 정합). 카테고리 배지는 항상 맨 앞에 별도 표시. (PRD Open Question 4 — 2026-06-29 이 규약으로 frontend 구현·확정.)
    - **우선순위 규약**: boolean 배지가 동적 배지보다 항상 앞(인기=`-2`, 신규=`-1` 고정 — 기존 시각 순서·회귀 0 보존). 동적 배지는 `badges.priority` 값 사용(낮을수록 앞), 동률은 배열 안정 순서.
    - 미등록 배지명(마스터에 없음 — `badgeMetaByName`에 키 부재)은 **고객 화면에서 미표시**(어드민 A6은 회색 "미등록"으로 보이지만, 고객에겐 깨진 라벨 노출 금지).
    - **graceful**: `badges` 마스터 미적용(테이블 없음 → `fetchBadges` []) 또는 `products.badges` 컬럼 부재 시 → 기존 인기/신규 boolean 배지만 표출(회귀 0).
- [ ] 상품명 — `variant="body2"`, `fontWeight: 600`, 토큰 외 인라인 `fontSize: '0.8125rem'` 사용 중(13px) → 02 §타이포 §사용 규칙 약속 2에 따라 시안에서는 14(`body2`)로 흡수
- [ ] 가격 영역:
  - 할인 시(상품이 `is_discountable=true` AND `discountRate > 0`): 원가 line-through(`text.disabled`) + `{N}%` **빨강 텍스트**(`caption`, `error.main`, fontWeight 700 — **칩 아님**, 2026-06-01 /preview 목업 정합)
  - 최종가 — `variant="subtitle1"`, `fontWeight: 800`, 할인 시 `primary.main` 색
- [ ] 액션 영역(높이 40, 하단 고정):
  - 카트에 없으면 "담기" outlined 버튼 — **전역 테마 회색 아웃라인(`gray[300]` 보더 + `gray[800]` 텍스트). primary 파랑 override 폐기, 2026-06-01 목업 정합**
  - 카트에 있으면 수량 스테퍼 — `bgcolor: primary.main`, 흰색 텍스트, 좌측 마이너스/Delete(수량 1일 때), 가운데 수량, 우측 플러스

#### 빈 상태·로딩 (line 252-264)
- [ ] 로딩: `CircularProgress` size 32 thickness 4 가운데, py 8
- [ ] 검색 결과 없음: "검색 결과가 없습니다" + "다른 검색어를 시도해보세요" 가운데, py 8
- [ ] 무한 스크롤 추가 로딩: 하단 작은 `CircularProgress` size 24

### Step 1 — 주문자 정보 (`CustomerInfoStep.jsx`)

#### 헤더 (line 87-96)
- [ ] 페이지 제목 — `isOnsitePurchase` 분기 (2026-06-01 건우님 결정):
  - 일반(배송): **"배송 받으실 주소를 입력해주세요"**
  - 현장구매: "주문자 정보를 입력해주세요" (배송지 없으므로 기존 유지)
  - `variant="h3"`, `fontWeight: 800`
- [ ] 부제: **"{이벤트명}" + `discountRate > 0`이면 " · {N}% 할인 적용"** (Step 0 헤더와 동일 패턴, 양쪽 모드 공통). 기존 "배송에 필요한 정보입니다"/"주문자 확인을 위한 정보입니다" 폐기

#### 섹션 1 — 필수 정보 (line 96-157)
- [ ] 섹션 헤더: `variant="overline"`, "필수 정보" — `fontWeight: 700`, `color: text.secondary`
- [ ] 필드 1: **성함** — `name="name"`, required, 시작 아이콘 `PersonIcon`(text.disabled, 20px), `inputSx` 적용(`borderRadius: '12px'`, minHeight 52, `bgcolor: '#F8F9FA'`, `fontSize: '16px'`)
- [ ] 필드 2: **연락처** — `name="phone"`, required, placeholder "010-1234-5678", maxLength 13, helperText "숫자만 입력해주세요.", 시작 아이콘 `PhoneIcon`
  - 자동 하이픈 포맷팅(`handlePhoneChange`, line 68-77): 3-4-4 패턴
- [ ] 필드 3(조건부): **인싸이트 ID** — `hasOnlineCode=true`일 때만 노출. 라벨 "인싸이트 ID (온라인코드 구매 시 필수)", placeholder "인싸이트 홈페이지 ID를 입력해주세요", 시작 아이콘 `BadgeIcon`
  - `hasOnlineCode` 판정: 카트에 `category === '온라인코드'` 또는 상품명에 "온라인" 포함하는 아이템이 있을 때 (`OrderPage.jsx:69`)

#### 섹션 2 — 배송지 정보 (line 159-234, `!isOnsitePurchase`일 때만)
- [ ] 구분선 `Divider` my 3
- [ ] 섹션 헤더 overline "배송지 정보"
- [ ] 필드 4: **주소 검색** — `name="address"`, readOnly, 클릭하면 Daum 우편번호 모달 오픈, 시작 아이콘 `SearchIcon`(`primary.main`), 끝에 outlined 검색 버튼
  - 입력은 절대 직접 못 함 (readOnly), 모달에서만 채워짐
- [ ] 필드 5: **상세주소** — `name="detailAddress"`, 자유 입력, 시작 아이콘 `HomeIcon`
- [ ] 필드 6: **우편번호 — 폼에서 히든** (2026-06-01 건우님). Daum 모달이 `postcode`를 자동 저장하므로 출고/어드민 데이터엔 그대로 포함, 고객 폼에만 미표시(데이터 손실 없음)
- [ ] 모달 동작 (`handleCompletePostcode`, line 50-66):
  - 도로명 주소 시 `bname`·`buildingName`을 조합한 extraAddress를 괄호로 본 주소에 붙임
  - `data.zonecode` → `postcode`, 조합된 주소 → `address`로 저장

> **주소는 세 필드 분리 입력 — 시안 통합 금지.** A3 출고 시트와 1:1 매칭되는 핵심 사실. 운영자가 출고 시 도로명/상세/우편번호를 각각 별도로 복사해 택배 전산에 옮긴다.

#### 섹션 3 — 선택사항 (line 236-269)
- [ ] 구분선 `Divider` my 3
- [ ] 섹션 헤더 overline "선택사항"
- [ ] 필드 7: **요청하실 내용** — `name="request"`, multiline rows 3, 시작 아이콘 `NoteIcon`(상단 정렬)

### Step 2 — 주문 확인 (`OrderReviewStep.jsx`)

#### 헤더 (line 35-43)
- [ ] 페이지 제목: "주문 내용을 확인해주세요" — `variant="h3"`, `fontWeight: 800`
- [ ] 부제: **"{이벤트명}" + `discountRate > 0`이면 " · {N}% 할인 적용"** (Step 0 헤더와 동일 패턴). 기존 "모든 정보가 올바른지 확인 후 제출해주세요" 폐기 (2026-06-01 건우님 결정)

#### 카드 1 — 주문 상품 (line 45-93)
- [ ] 카드 헤더 좌측: "주문 상품 · {N}건" — `variant="h5"`, `fontWeight: 700`
- [ ] 카드 헤더 우측: "수정" 버튼 (small, `EditIcon` 14px) → `onGoToStep(0)` (Step 0으로 점프)
- [ ] 아이템 행(상품마다 반복):
  - 좌측: 상품명 (`variant="body2"`, `fontWeight: 600`) + 하단에 "{단가}원 x {수량}개" (`variant="caption"`, `text.secondary`)
  - 우측: 라인 합계 (`variant="subtitle2"`, `fontWeight: 700`)
  - 행 사이 `Divider`
- [ ] 카드 보더 16px radius(인라인 — 시안에서는 토큰 라운드로 흡수), divider 보더

#### 카드 2 — 주문자 정보 (line 95-118)
- [ ] 카드 헤더 좌측: "주문자 정보" — `variant="h5"`, `fontWeight: 700`
- [ ] 카드 헤더 우측: "수정" 버튼 → `onGoToStep(1)`
- [ ] InfoRow 행 — 라벨(`variant="body2"`, `text.secondary`, minWidth 72) + 값(`variant="body2"`, `fontWeight: 500`, wordBreak break-all)
- [ ] 표시 항목 (조건부):
  - "성함": `customer_name`
  - "연락처": `customerInfo.phone`
  - "배송지"(조건부): `[postcode, address, detailAddress]` 공백 join — **한 줄 통합 표시**. 이 자리에서만은 표시용 통합. 입력·DB는 분리 그대로.
  - "인싸이트 ID"(조건부): `customerInfo.inpsytId`
  - "요청사항"(조건부): `customerInfo.request`

#### 카드 3 — 결제 정보 (`CostSummary` embedded, line 120-125)
- [ ] 섹션 제목: "결제 정보" — `variant="h5"`, `fontWeight: 700`
- [ ] 무료배송 진행바(`!isOnsitePurchase`일 때만): 회색 카드(`#F2F4F6`, radius 12) 안에 안내문 + LinearProgress
  - 미달성: "무료배송까지 {남은금액}원 남았습니다!"
  - 달성: "무료배송 혜택이 적용되었습니다!"
  - LinearProgress 색: brand 그라데이션 — `linear-gradient(90deg, #2B398F 0%, #3d4db0 100%)` (시안에서는 단색 brand-700로 단순화 검토)
- [ ] 비용 행 (좌측 라벨 / 우측 값):
  - "총 상품 금액": `totalOriginalPrice` 원
  - "할인 금액"(조건부, > 0): `-{N}원`, 양쪽 모두 `error.main` 색
  - "배송비"(`!isOnsitePurchase`): 값 > 0이면 "{N}원", 0이면 "무료"
- [ ] dashed `Divider` my 2.5
- [ ] 최종 행: "최종 결제 금액" (`variant="h6"`, `fontWeight: 700`) + 최종 금액 (`variant="h3"`, `color: primary`, `fontWeight: 800`, 모바일 22px / 태블릿+ 24px — 시안에서 `title-page` 토큰으로 흡수)

#### 배송 예정일 안내 (line 127-134, `!isOnsitePurchase` AND `estimatedDeliveryDate` 있을 때)
- [ ] 회색-블루 박스: `bgcolor: rgba(43, 57, 143, 0.06)`, border `rgba(43, 57, 143, 0.18)`, radius 12, p 2, 가운데 정렬
- [ ] 문구: "지금 주문하면 {M월 d일 (E)} 도착 예정이에요." — `date-fns/format` `ko` locale, `primary.main`, `fontWeight: 600` (실제 코드엔 트럭 이모지가 앞에 붙음)

### 전 단계 공통 — 플로팅 하단 바 (`FloatingBottomBar.jsx`)
- [ ] position fixed bottom 0, **`left:0; right:0; maxWidth:600; mx:auto`로 600px 중앙 정렬** — 콘텐츠 컬럼과 동일한 auto-margin 방식이라 스크롤바 오프셋 없이 컬럼과 픽셀 정렬(`100vw` 계산 금지: 스크롤바 폭 포함돼 PC에서 ~7px 어긋나 "양옆 틈" 발생했던 원인). zIndex 1200
- [ ] `bgcolor: background.paper`, top 1px divider, `boxShadow: '0 -4px 20px rgba(0,0,0,0.08)'`
- [ ] 안전 영역: `pb: max(12px, env(safe-area-inset-bottom))`

#### Step 0 — 무료배송 안내 영역 (`!isOnsitePurchase` AND 장바구니 있음일 때, line 78-103)
- [ ] 미달성 + 카트 있음: "무료배송까지 {남은}원 남았어요." (`variant="caption"`, `text.secondary`, `fontWeight: 600`) + LinearProgress(height 4)
- [ ] 달성: "배송비가 무료로 적용됐어요!" (`primary.main`, `fontWeight: 700`)

#### Step 0 — 좌측 장바구니 아이콘 (line 113-142)
- [ ] `CartIcon` (26px) + `Badge`(수량) — primary 색
- [ ] 카트 있으면 클릭하여 `CartBottomSheet` 오픈, 색 `primary.main` / 비어 있으면 `text.disabled`

#### Step 1·2 — 좌측 뒤로 가기 아이콘 (line 143-154)
- [ ] `IconButton` `ArrowBackIcon`, 48x48, `text.secondary` 색
- [ ] 클릭 시 `setActiveStep(prev - 1)` + 스크롤 top

#### 우측 CTA 버튼 (line 157-183)
- [ ] `variant="contained"`, size large, fullWidth, minHeight 52, radius 14(인라인 — 시안에서는 `radius-button`=8로 흡수)
- [ ] 단계별 라벨:
  - Step 0: **"배송지 입력하기"** (배송 주문) / **"주문서 작성하기"** (현장구매 `isOnsitePurchase`) — 2026-06-01 건우님 결정, isOnsitePurchase 분기
  - Step 1: "다음"
  - Step 2: "주문 제출하기"
- [ ] 단계별 비활성 조건(`getNextDisabled`):
  - Step 0: 장바구니 비어 있음
  - Step 1: `!isCustomerInfoValid || !hasCartItems` — **성함·연락처 + (배송 모드면 도로명주소·상세주소도) 필수.** 현장구매는 성함·연락처만. 미입력 시 '다음'/제출 차단 (2026-06-01 건우님)
  - Step 2: 위 + `isSubmitting`
- [ ] 제출 중: 아이콘 자리에 `CircularProgress` size 20, 라벨 "주문 처리 중..."
- [ ] 끝 아이콘: Step 0·1은 `ArrowForwardIcon`, Step 2는 없음

### CartBottomSheet (`CartBottomSheet.jsx`, Step 0의 카트 아이콘 클릭 시 + 'CTA 진행' 확인 시트)
> 2026-06-01 디자인 시스템 정합(M3 후속): raw-hex·인라인 토큰을 theme 토큰으로 교체. 시각·기능 동일, 라벨 구조 불변.
> 2026-06-01 확정 영역 추가(건우님): `onProceed` 전달 시 푸터 하단에 `총 N건 구매` + (배송비 시)무료배송 업셀 + 진행/추가 버튼 노출(변경이력 5 참조). 0→1 전환은 이 시트의 버튼으로 수행.
- [ ] `SwipeableDrawer` anchor bottom, `disableSwipeToOpen`, `maxHeight: 75vh`, top radius `theme.radii.lg`(16)
- [ ] 좌우 600px max 가운데 정렬 (플로팅 바와 동일 폭), `pb: env(safe-area-inset-bottom)`
- [ ] 상단 드래그 핸들 — 40x4 회색 바(`grey.300`, `theme.radii.pill`)
- [ ] 헤더 — "장바구니 {N}" (`variant="h4"`, `fontWeight: 800`, 숫자만 `primary.main`) + `CloseIcon` 우측
- [ ] 아이템 행:
  - 상단: 상품명 (`variant="body2"`, `fontWeight: 600`) + 우측 `CloseIcon` 작은 삭제 버튼
  - 하단: 수량 스테퍼(보더 1px divider, `theme.radii.sm`=8) + 라인 합계 `variant="subtitle2"`(토큰 weight 700)
  - 수량 스테퍼: 수량 1에서 -1 누르면 `DeleteIcon`으로 전환(카트 제거), 2 이상이면 `RemoveIcon`
- [ ] 빈 상태: `ui/EmptyState`(icon=`ShoppingCartOutlined`, title="장바구니가 비어있습니다")
- [ ] 푸터(아이템 있을 때, `bgcolor: grey.50`):
  - **총 상품 금액 행**: `totalOriginalPrice`(정가 합계) — `caption`/`subtitle2`. (2026-06-01 건우님 — 시트에도 정가 대비 할인 표기)
  - **할인 금액 행**(할인 > 0): `-(totalOriginalPrice - totalPrice)`, `error.main` 빨강 — `caption`/`subtitle2`
  - 배송비 행(`!isOnsitePurchase`): 정가(할인 전) 합계가 free_shipping_threshold 이상이면 "무료", 미달이면 `shipping_cost` 표시 (`variant="subtitle2"`)
  - 총 금액 행: 라벨 `variant="body1"`, `text.secondary` + 합계 `variant="h4"`, `primary.main`, `fontWeight: 800`
  - 현장구매(`isOnsitePurchase=true`)면 배송비 행 미표시 + 합계는 배송비 미가산

### 성공 다이얼로그 (`OrderPage.jsx:372-403`)
> 중요: 실제 플로우에서는 거의 도달하지 않는다. `create-order` 응답의 `data.order.access_token`이 있으면 `/order/status/{token}`으로 즉시 navigate하기 때문(line 191-194). 다이얼로그는 토큰이 없을 때의 fallback.
- [ ] borderRadius 16, mx 2
- [ ] 제목: "주문이 접수됐어요" — `fontWeight: 700`, 가운데, pt 4 pb 1
- [ ] 본문: "담당자를 통해 결제를 진행해 주세요. / 결제가 완료되면 카카오 알림톡으로 주문 내역을 보내드려요." (가운데, `text.secondary`, lineHeight 1.8, 사이 br)
- [ ] 액션: "닫기" contained large fullWidth → 카트 비움 + 폼 비움 + Step 0 복귀 (`handleCloseSuccessDialog`)

## 액션·기능 (누락 금지)

- [ ] 진입 시 데이터 페치(`useEffect`, line 73-124):
  1. `site_settings`에서 `free_shipping_threshold`, `shipping_cost` 단일 행 조회. 실패 시 기본값(30000/3000) 유지.
  2. `eventSlug` 없으면 `accessError='no_slug'` 설정 후 종료.
  3. `events` 테이블에서 `order_url_slug = eventSlug` 단일 행 조회. 없으면 `not_found`.
  4. 오늘 날짜(KST `getTodayKST`)가 `start_date~end_date` 밖이면 `expired`.
  5. 통과 시 `eventInfo` 저장 (`id`, `name`, `discount_rate`, `tags`, `start_date`, `end_date`, `estimated_delivery_date`).

- [ ] 접근 차단 화면(`accessError` 있을 때, line 224-256):
  - 3가지 케이스 메시지 매핑:
    - `no_slug`: 링크 이모지 + "링크를 확인해 주세요" — "학회 전용 링크로만 주문할 수 있어요. 담당자에게 올바른 링크를 받아 다시 접속해 주세요."
    - `expired`: 달력 이모지 + "주문이 가능한 날짜가 아니예요." — "주문 내역은 받아보신 알림톡에서 확인할 수 있어요." (`showLookup: true`로 코드에 표시돼 있으나 실제 lookup 버튼은 미렌더 — **확인 필요**)
    - `not_found`: 물음표 이모지 + "찾을 수 없는 링크예요" — `no_slug`와 동일 안내
  - 화면 구성: 큰 이모지(4rem) + 제목(`h6`, `fontWeight: 800`) + 본문(`body2`, `text.secondary`, whiteSpace pre-line, lineHeight 1.8)
  - 가운데 정렬, height `100dvh`, p 4

- [ ] 트리플탭으로 현장구매 모드 토글(`OrderPage.jsx:276-287`):
  - 600ms 윈도우 안에 3회 탭 시 `isOnsitePurchase` 반전
  - `activeStep === 2`일 때는 트리거 차단(확인 단계에서 모드 바뀌면 비용 재계산 혼란)
  - 상단 Snackbar로 모드 변경 안내

- [ ] 상품 담기/수량 조정 (`ProductSelectionStep.jsx:104-132`):
  - 카드 영역 클릭 시 `onAdd` (이미 카트에 있으면 차단)
  - 수량 -1이 1 미만으로 가면 카트에서 제거
  - 중복 추가 시도 시 `addNotification('이미 추가된 상품입니다.', 'info')` — `useNotification` 훅

- [ ] 우편번호 검색(`CustomerInfoStep.jsx:50-66`):
  - `react-daum-postcode`의 `DaumPostcode` 컴포넌트를 모달 안에 60vh 높이로 렌더
  - 도로명일 때 `bname` + `buildingName` 괄호 접미사 자동 조합
  - 완료 시 모달 닫고 `postcode`/`address` 필드 채움

- [ ] 단계 이동:
  - "다음": `handleNext` — 현재 단계 검증 후 `activeStep + 1`, `window.scrollTo(0, 0)`
  - "뒤로": `handleBack` — `Math.max(activeStep - 1, 0)`, scroll top
  - "수정"(Step 2의 카드 헤더): `handleGoToStep(0|1)` — 점프

- [ ] 주문 제출 (`handleSubmitOrder`, line 160-202):
  1. `eventInfo` 없으면 차단
  2. `setIsSubmitting(true)` 후 `supabase.functions.invoke('create-order', { body: {...} })` 호출
  3. body 페이로드:
     - `customer_name` ← `customerInfo.name`
     - `phone_number` ← `customerInfo.phone`
     - `shipping_address` — 객체 `{ postcode, address, detail }` (DB 표시에서는 `detailAddress`/`detail` 둘 다 fallback 처리됨 — A3 시트 참조 — **확인 필요**)
     - `inpsyt_id` ← `customerInfo.inpsytId`
     - `customer_request` — `isOnsitePurchase`면 `[현장구매] {원본}`으로 prefix
     - `cart` — `[{ product_id, quantity }]` 배열
     - `event_id`
  4. 응답 토큰(`data.order.access_token`)이 있으면 `/order/status/{token}`으로 navigate
  5. 토큰 없으면 `showSuccessDialog` 열기(fallback)
  6. 실패 시 에러 알림 표시
  7. `is_on_site_sale` 컬럼은 본 페이로드에 명시되지 않음 — **DB 컬럼 `is_on_site_sale boolean DEFAULT false`은 존재(20250805 마이그레이션)하나, create-order 함수가 이를 INSERT하지 않음. 현장구매 모드는 현재 `customer_request`에 `[현장구매]` 접두사로만 기록되는 형태 — 확인 필요**

- [ ] 서버측 금액 재계산 (`supabase/functions/create-order/index.ts:57-84`):
  - 클라이언트가 보낸 금액은 신뢰하지 않음. 서버가 `products`·`events`·`site_settings`를 다시 조회해 재계산.
  - `is_discountable=true`인 상품만 `discount_rate` 적용 (반올림 `Math.round`)
  - 총 정가가 `free_shipping_threshold` 이상이면 배송비 0
  - DB INSERT 컬럼: `total_cost` / `discount_amount` / `delivery_fee` / `final_payment` + `status_history` 배열 시작값

- [ ] 알림톡 발송:
  - `status='pending'`으로 생성 → 운영자가 어드민에서 `paid`로 변경하면 트리거(`20250722070342_create_paid_order_trigger.sql`) 발화 — 정상 알림톡 발송 경로
  - 이 화면 안에서는 알림톡을 직접 부르지 않음

## 입력 폼 구조 (분리/통합 절대 금지)

- [ ] `customer_name` — `name` 단일 필드 (성+이름 분리 안 함)
- [ ] `customer_phone` — `phone` 단일 필드. 클라이언트에서 010-XXXX-XXXX 포맷팅 적용
- [ ] `inpsyt_id` — 조건부 단일 필드. **카트에 온라인코드 상품이 있을 때만 노출**
- [ ] **배송지 — 세 필드 분리 (절대 한 줄로 통합 금지):**
  - `address` (도로명, readOnly, 모달로만 채움)
  - `detailAddress` (자유 입력)
  - `postcode` (readOnly, 모달로만 채움)
- [ ] `request` — `customer_request`로 매핑되는 단일 multiline 필드 (rows 3)
- [ ] 현장구매(`isOnsitePurchase=true`)일 때 배송지 섹션 자체가 숨겨짐 — 시안에서도 이 분기 처리 반드시 반영

## 데이터 모델

### `orders` 테이블 (`20250722070000_create_orders_table.sql` + 후속 마이그레이션)
- `id` (bigint, sequence)
- `created_at` (timestamptz default now)
- `customer_name` (text)
- `customer_email` — 2026-04-08 `20260408_drop_email_column.sql`로 제거됨
- `phone_number` (text) — `20250805_add_new_order_fields.sql`엔 `contact`로 추가됐으나 현 코드는 `phone_number` 컬럼 참조. **컬럼명 변경/리네임 마이그레이션 파일 미확인 — 확인 필요**
- `shipping_address` (jsonb) — `{ postcode, address, detail|detailAddress, ... }` 객체
- `inpsyt_id` (text, nullable) — 추가 마이그레이션 파일 미확인 — 확인 필요
- `customer_request` (text, nullable) — 추가 마이그레이션 파일 미확인 — 확인 필요
- `total_cost` (numeric) — `20250805`의 `total_amount`와 컬럼명 차이. 현 코드는 `total_cost` 사용 — 확인 필요
- `discount_amount` (numeric)
- `delivery_fee` (numeric) — `20250805`의 `shipping_cost`와 컬럼명 차이 — 확인 필요
- `final_payment` (numeric)
- `is_on_site_sale` (boolean, default false) — 현재 create-order에서 채우지 않음 (위 확인 필요 항목)
- `status` (text) — `pending`/`paid`/`completed`/`cancelled`/`refunded` (생성 시점엔 컬럼 default 또는 status_history만 박힘)
- `status_history` (jsonb, default 빈 배열) — `20260406_add_status_history_to_orders.sql`. INSERT 시 첫 항목 명시.
- `access_token` (uuid, default `gen_random_uuid()`) — `20260406_add_access_token_to_orders.sql`. 결제 완료 후 `/order/status/{token}` URL 키
- `event_id` (bigint, FK → events)

### `order_items` 테이블 (`20260415_002_add_order_item_snapshots.sql`)
- `order_id`, `product_id`, `quantity`, `price_at_purchase`
- 스냅샷 컬럼(주문 시점 박제): `product_name`, `product_code`, `category`, `list_price`

### `events` 테이블 (조회만)
- `id`, `name`, `discount_rate`, `tags` (jsonb 배열), `start_date`, `end_date`, `order_url_slug`, `estimated_delivery_date`
- `visible_categories` (text[], nullable — `20260624000000_DRAFT`): 행사 주문서 노출 대분류 화이트리스트. NULL/빈 배열=전체 노출. 값 있으면 원본 `products.category` ∈ 이 배열인 상품만. anon 공개 컬럼(GRANT 화이트리스트 포함). **graceful**: 컬럼/GRANT 미적용 시 OrderPage가 레거시 select fallback → 전체 노출.

### `products` 테이블 (조회만)
- `id`, `name`, `product_code`, `category`, `list_price`, `is_discountable`, `is_popular`, `is_new`, `tags`
- `sub_category` (text, nullable) — **소분류**. (P1) 단일 대분류 행사에서 카테고리 칩을 이 값으로 그림(마스터 `subcategories` 연동). 노출·탐색 전용.
- `badges` (text[], nullable — P1 신규) — 동적 배지. 카드에 소프트 틴트로 최대 2개(우선순위) 노출. 마스터 `badges` 연동.
- `parent_code` (text, nullable — ③ `20260616000000_add_product_hierarchy_columns.sql`): 검사군 묶음 키. 검사·도구는 `regexp_replace(product_code, '_[0-9]+$', '')`로 자동 백필, 도서·평면=null. 클라 그룹핑 키.
- `option_type` (text, nullable — 동 마이그레이션): 옵션 종류 정규화값(온라인코드/전문가지침서/검사지/SET/모듈/기록지/기타). 현재 진열 클라에서는 미사용(표시명은 name 클라 파싱), ②회원게이팅이 '온라인코드' 식별에 사용 예정.
- **graceful**: 두 컬럼 미적용 환경에서도 `parent_code`가 없으면 전부 평면 → 진열 기존 동작 보존.

### `site_settings` 테이블 (단일 행)
- `free_shipping_threshold` (default 30000)
- `shipping_cost` (default 3000)

## 권한별 차이

이 페이지는 **공개 화면**(고객용). 인증 없이 접근 가능. 단, 학회 슬러그가 유효해야 한다 — 슬러그 없거나 만료·존재하지 않으면 접근 차단(위 진입 흐름 참조). 로그인 사용자 컨텍스트(`master`/`editor`/`viewer`)는 본 페이지와 무관.

## 필터·뷰 모드 (Step 0 상품 그리드)

- [ ] 뷰 모드 칩: `all`/`popular`/`new` (기본 `popular`)
- [ ] 카테고리 칩: `all` + 동적 카테고리 목록 (기본 `all`)
- [ ] 학회 태그 필터: `eventInfo.tags` 배열. 뷰 모드가 `all`이 아니고 검색어가 없을 때만 적용
- [ ] 검색: 상품명 부분 일치(`matchesSearch` 유틸 — 띄어쓰기로 여러 키워드 AND)

## 빈 상태·로딩·오류 처리

- [ ] 페이지 로딩(이벤트 조회 중): `CircularProgress`만 가운데 (`OrderPage.jsx:216-222`)
- [ ] 접근 차단(슬러그 없음/만료/존재 X): 위 표시 정보의 메시지 화면
- [ ] 상품 목록 로딩: `CircularProgress` size 32 가운데, py 8
- [ ] 상품 검색 결과 없음: "검색 결과가 없습니다" + "다른 검색어를 시도해보세요"
- [ ] 카트 비어 있음: CartBottomSheet 본문에 "장바구니가 비어있습니다"
- [ ] 단계 전환 실패: `Alert severity="error"` (상단, dismissable)
- [ ] 주문 제출 실패: 동일한 `Alert`에 메시지 노출, 폼·카트 유지

## 핵심 발견 (시안 검수 시 반드시 확인)

1. **상단 헤더는 트리플탭 영역이다.** 일반 모드/현장구매 모드 두 상태가 있고 색이 바뀐다 (`primary.main` ↔ `warning.main`). 시안이 한 상태만 그리면 현장구매 모드의 시각 안내가 사라진다. 두 상태 다 시안에 둔다.
2. **Step 0에서는 스텝 인디케이터를 표시하지 않는다.** 의도된 디자인 — 첫 진입에서 사용자가 "단계가 있는 줄도 모르고" 상품만 고르게 한다. 시안에서 모든 단계에 인디케이터를 일률 표시하면 의도가 깨진다.
3. **배송지는 세 필드 분리 입력. A3 출고 시트와 1:1 매칭.** 도로명/상세/우편번호. Daum 주소 검색 모달이 도로명·우편번호를 채우고, 상세주소만 직접 입력. 시안에서 한 줄 통합 입력으로 그리면 출고 운영자가 필드 단위 복사를 못 한다.
4. **현장구매 모드에서는 배송지 섹션 자체가 숨겨진다.** 분기 처리. 시안에 두 분기를 모두 그리거나, 적어도 둘 다 명시한다.
5. **`hasOnlineCode`일 때만 인싸이트 ID 필드가 뜬다.** 카트에 온라인코드 상품(카테고리 또는 이름 매칭)이 있을 때 조건부 노출. 시안에서 항상 보이거나 항상 숨기면 안 된다.
6. **`OrderReviewStep`의 "배송지" InfoRow는 표시용 통합이지만, 입력·DB는 분리.** 이 자리에서만 한 줄로 join해서 보여줘도 된다. 단, A3 출고 화면(운영자용)의 표시까지 한 줄로 따라가면 안 된다 — 거기는 분리.
7. **에러 메시지 "성함, 연락처, 이메일"의 "이메일"은 잔재 문구.** `email` 컬럼은 2026-04-08에 제거됐다(`20260408_drop_email_column.sql`). 코드가 이 메시지에서 "이메일" 단어를 아직 들고 있다. 시안·구현 모두 "성함, 연락처"로 정리해야 정합성이 맞는다.
8. **현장구매 정보는 현재 `customer_request`의 `[현장구매]` prefix로만 기록된다.** `is_on_site_sale` boolean 컬럼이 DB엔 있지만, `create-order` 함수가 INSERT 페이로드에 넣지 않는다. 시안 결정과 별개로 데이터 정합성 정리가 필요한 잠재 부채.
9. **CTA 라운드 14, 일반 카드 라운드 16 등 인라인 px이 다수.** M1 토큰(`radius-button`=8, `radius-md`=10)으로 흡수 대상.
10. **`fontSize: '0.8125rem'`(13px), `0.6875rem`(11px) 같은 인라인 값이 카드·칩에 다수.** 02 §타이포 §사용 규칙 약속 2 흡수 표를 그대로 적용.
11. **검사군 카드는 가격을 표시하지 않는다.** 검사명 + "옵션 N개"만. 가격은 펼친 옵션 행에서만 노출(건우님 확정 — 검사군 단위 가격은 옵션별 차이로 오해 소지·노안 숫자부담). 시안이 검사군 카드에 대표가/최저가를 그리면 안 된다.
12. **검사군 진열은 graceful이어야 한다.** `parent_code` 컬럼/값이 없는 환경(마이그레이션 미적용)에선 전부 평면(기존 그리드)으로 떨어진다. truthy 행만 그룹핑. 미적용이어도 화면이 깨지면 안 됨 — `groupProducts`가 falsy를 flat으로 흘려보냄.
13. **표시명은 클라 파싱이다(backend 별도 컬럼 없음).** groupName/optionName은 name의 마지막 `_` 기준 분리. 검사명에 `_`가 다수면 "마지막 `_`" 기준이라 옵션명만 안전 분리, 그래도 실패하면 풀네임 fallback. backend는 `parent_code`(코드 기반)로만 그룹핑 키를 주고, 화면 라벨은 클라가 만든다.
14. **검색은 검사군 단위.** groupName 1차 → 옵션명 fallback. 옵션 낱개가 검색결과로 쏟아지지 않는다. fallback 매칭 검사군은 펼친 채로 노출. 같은 검사군의 여러 옵션 담기는 `order_items`에 개별 product로 자연 저장(스냅샷 4필드 계약 불변).
15. **(P1) 단일 대분류 행사는 대분류 칩을 숨기고 소분류 칩으로 탐색.** 오티즘=도구 단일 → "도구" 상위 칩 숨김, 하위 소분류(인지/언어/상담) 칩 노출. 시안/구현이 도구 상위 칩을 그대로 노출하면 PRD 의도(소분류 탐색)가 깨진다. 저장 위치 확정(A5 확인 필요)과 연동되므로 1차는 사양만.
16. **(P1) 카드당 배지 최대 2개·우선순위.** boolean(인기/신상품)+동적 배지 합산 후 priority 정렬 상위 2개만. 초과분은 +N 없이 조용히 컷(카드 과밀·노안 부담 방지). 시안이 배지를 무제한 나열하면 안 됨. 카테고리 배지를 2개 카운트에 넣을지는 확인 필요(PRD Open Q4).
17. **(P1) 미등록 배지명은 고객 화면 미표시.** 마스터에 없는 배지명은 어드민(A6)에선 회색 "미등록"으로 보이지만, **고객 화면엔 깨진 라벨을 노출하지 않는다**(조용히 생략). 가법·graceful — badges 컬럼 미적용 환경에서도 기존 카드 동작 보존.

## 변경 이력
- 2026-06-29 **상품 카드 이미지 플레이스홀더 폐기 (실 코드 변경, 건우님 결정)**. `ProductCard.jsx` `ProductImageSlot` — `getProductImageUrl(image_filename)`이 null이거나 `onError`면 `return null`(슬롯 미렌더). 기존 카테고리 색 틴트 박스 + `ImageIcon`(28px) 플레이스홀더 코드·`isTest`/`tint` 분기 제거, `ImageIcon` import 삭제. 슬롯 없을 때 배지 영역이 CardContent flex column 첫 요소로 자연 상단 배치(레이아웃 안 깨짐, 빈 박스 0). **이미지 있는 상품은 1:1 슬롯 정상(회귀 0).** 이유: 행사 단위 이미지 유무 분리(혼재 없음)·도서/검사 상품명 직관성 우선. **혼재 처리 로직 추가 안 함(오버엔지니어링 방어), theme.js 무수정, AI 시그니처 없음.** A6 `ProductThumb`도 동형(미등록 셀 비움). **검증**: lint(변경 파일 신규 위반 0, 기존 send-alimtalk 9에러 무관)·vite build 통과. §상품 카드 절·핵심 발견 17 갱신.
- 2026-06-25 행사별 판매 대분류 필터 **구현**(`feature/product-hierarchy`) — **실 코드 변경**: (1) `OrderPage.jsx` events select에 `visible_categories` 추가 + 컬럼/GRANT 미적용 graceful fallback(레거시 select 재조회), `ProductSelectionStep`에 `visibleCategories` prop 전달. (2) `ProductSelectionStep.jsx` `baseProducts` 필터 — **원본 category** 기준(도구→검사 정규화 전), NULL/빈 배열=전체 노출(기존 동작 보존), eventTags와 AND 공존. 단일 대분류 행사(`length===1`)는 대분류 칩 숨기고 `sub_category` 칩(localeCompare 정렬·미지정 "기타"·2종 미만 시 칩 줄 숨김), 카테고리 필터도 sub_category 기준. (3) 데이터 모델 `events.visible_categories` 추가. **보존(무변경)**: 도구→검사 정규화(칩 표시·다중/NULL/빈 행사 fallback), eventTags 필터, 뷰모드/검색/정렬/페이지네이션, ProductCard 동작. **검증**: lint(변경 4파일 0 이슈, 기존 send-alimtalk 9에러는 무관)·build 통과. 라이브 검증은 마이그레이션 적용 후.
- 2026-06-24 카테고리·배지 동적화 PRD 반영 (`DOCS/PRD_오티즘_카테고리배지_동적화.md`, P1·기획 단계) — **사양만 갱신, 실 코드 미변경.** (1) **카테고리 칩**: 단일 대분류 행사("도구"만)는 대분류 칩 숨기고 **소분류 칩(`sub_category`, 마스터 `subcategories` 정렬)** 노출 규칙 추가. 저장 위치(A5 판매 대분류 "확인 필요")와 연동. (2) **ProductCard 배지**: 동적 배지(`products.badges`) 소프트 틴트 노출 + **가드레일(카드당 최대 2개·우선순위)** 추가. 미등록은 고객 화면 미표시. (3) 데이터 모델에 `products.sub_category`·`badges` 추가. (4) 핵심 발견 15~17 신설. **보존**: 도구→검사 정규화는 다중 대분류 행사 fallback으로 잔존(단일 대분류 행사에서만 소분류 칩 우선), 소프트 틴트 배지 패턴·radii.sm 칩·검사군 진열 전부 무변경.
- 2026-06-16 ③ 상품 계층화 — 검사 2뎁스 진열 (`feature/product-hierarchy` 브랜치, main 격리) — **신규**: `utils/productGroup.js`(그룹핑·파싱·할인가), `TestGroupCard.jsx`(검사군 3상태 카드), `ProductSelectionStep.jsx` 계층 진열(검사 리스트 ↔ 도서 그리드 분기·미니헤더·검사군 단위 검색·펼침 상태). **데이터**: `products.parent_code`/`option_type` 가법 컬럼(`20260616000000`). **graceful**: parent_code 미적용 시 전부 평면(기존 동작). **보존(무변경)**: cart·order_items 4필드 스냅샷·CartBottomSheet 풀네임·트리플탭·hasOnlineCode 조건부 인싸이트ID·주소 3필드·무료배송/할인 로직·검색 멀티키워드·도구→검사 정규화·`ProductCard` 도서 그리드 동작·뷰모드/카테고리 칩. **검증**: lint(신규 3파일 0)·build·vitest(105 passed, 신규 11). 라이브 검증은 마이그레이션 적용 후.
- 2026-06-01 주문 흐름 UX 5건 (건우님) — (1) 단계 인디케이터 **Step0 포함 전 단계 표시**(OrderStepIndicator는 이미 3단계, OrderPage가 막던 것 해제). (2) **헤더 전부 중앙정렬**(Step1 CustomerInfoStep·Step2 OrderReviewStep도 `textAlign:center`). (3) **우편번호 칸 히든**(데이터·출고정보 보존). (4) **배송 모드 배송지(도로명+상세) 필수** — `isCustomerInfoValid`에 추가, 미입력 시 '다음'/제출 차단·필드 `required` 표시. 현장구매는 성함·연락처만. (5) **0→1 전환 시 장바구니 확인 바텀시트**(토스트 폐기·건우님) — CTA가 step1로 직행하지 않고 `CartBottomSheet`를 열어 카트 요약 + 무료배송 업셀. 배송비 부과 시: `총 N건 구매 · X원 더 구매하시면 무료배송이에요` + `[그래도 주문하기]`(회색 outlined) `[상품 추가하기]`(파랑 contained = 유도 행동). 무료배송/현장구매: `총 N건 구매` + `[주문하기]`(파랑) `[상품 추가하기]`(회색). 주문하기/그래도주문하기→step1(onProceed), 상품 추가하기→시트 닫고 step0. 파일: OrderPage·CustomerInfoStep·OrderReviewStep·CartBottomSheet.
- 2026-06-01 상품 카드/하단바 목업 정합 (건우님 좌우 비교 지시) — (1) **배지 솔리드 칩 → 소프트 틴트 박스**(alpha 0.12~0.14), 인기 배지 "★" 단독 → **StarIcon+"인기"**. (2) **"담기" 버튼 파랑(primary) → 회색**(테마 기본 outlined). (3) ~~하단바 배경 풀폭~~ **철회·복구**(건우님 지시) — 하단바는 **부모 콘텐츠 컬럼(600px)에 맞춰 정렬**. 뷰포트 풀폭으로 채운 건 오판, 즉시 복구. (4) **`도구` 카테고리 → `검사`로 정규화**(별도 칩 X, 검사 필터에 포함, 카드 배지도 검사). 파일: `ProductCard.jsx`·`ProductSelectionStep.jsx`·`FloatingBottomBar.jsx`.
- 2026-06-01 고객 주문 화면 보강 (건우님 지시) — (1) **검색바** 회색 채움 `#F2F4F6` → **흰색 기본 아웃라인**(/preview 목업 정합, 플레이스홀더 멀티키워드 힌트 유지). (2) **뷰/카테고리 칩** 알약형 → `radii.sm`(8px) 둥근 사각. (3) **Step 1 헤더** `isOnsitePurchase` 분기 — 배송 "배송 받으실 주소를 입력해주세요" / 현장 "주문자 정보를 입력해주세요" 유지. (4) **Step 1·2 부제** → "{이벤트명} · N% 할인 적용"(Step 0 패턴 통일, 양쪽 모드). (5) **CTA Step 0** "주문서 작성하기" → 배송 "배송지 입력하기" / 현장 기존 유지. (6) **제출 후 OrderStatusPage 연락처** `mono`(monospace) 제거 → 일반 폰트. **보존**: 주소 3필드 분리·현장구매 배송지 숨김·할인/무료배송 로직·검색 멀티키워드 전부 무변경. **현장구매 모드 문구는 전부 기존 보존**(배송 문구 강제 주입 안 함).
- 2026-05-13 신설 — M2 시안 착수 사전 정독. `OrderPage.jsx` 외 6개 자식·보조 컴포넌트 + DB 마이그레이션 + create-order edge function 전수. 환각 방지 위해 컬럼명 불일치·문구 잔재·`is_on_site_sale` 미사용 등 의심 8건은 "확인 필요"로 표기.
- 2026-05-29 M3-10 시안 정합 — `OrderPage.jsx` + 자식 7종(`OrderStepIndicator`/`FloatingBottomBar`/`ProductCard`/`ProductSelectionStep`/`CustomerInfoStep`/`OrderReviewStep`/`CostSummary`) 토큰화. **보존**: 트리플탭 600ms 3회·Step 0 인디케이터 숨김·주소 3필드 분리(DaumPostcode 모달)·`hasOnlineCode` 조건부 인싸이트 ID·현장구매 배송지 섹션 숨김·API/Supabase/Edge Function/알림톡 트리거·`CartBottomSheet` 변경 0·성공 다이얼로그 fallback·접근 차단 화면. **교체**: 인라인 raw hex 0건(theme 토큰 경유), 인라인 `fontSize`/`borderRadius` 흡수(글로벌 MuiCard·MuiButton·MuiTextField·MuiChip 토큰 위임), `bgcolor: '#F8F9FA'` → `theme.gray[50]`, `'#F2F4F6'` → `theme.gray[100]`, `'rgba(43,57,143,...)'` → `alpha(primary.main, ...)`, 사양 §발견 7 잔재 문구 정리 — `OrderPage:139`의 "성함, 연락처, 이메일" → "성함, 연락처", 배송 예정일 안내의 트럭 이모지 → `ShippingIcon` 컴포넌트. **신규 없음**(시안 답습 0건). **사양 §발견 1~7 모두 보존 확인.**
