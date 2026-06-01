# 사양 시트 — C1 고객 주문서 (OrderPage)

> 이 시트는 고객 주문서 화면의 정보·기능·데이터 구조의 단일 진실 소스다.
> 시안과 실서비스 구현은 이 시트의 모든 항목을 1:1로 반영해야 한다.
> 임의 단순화·통합·생략은 건우님의 명시적 승인 후 이 시트를 먼저 갱신한 다음에만 허용된다.
> 마지막 갱신: 2026-05-13 신설 (M2 시안 착수 사전 정독).

## 참조 파일
- 실 컴포넌트: `inpsyt-order-frontend/src/components/OrderPage.jsx` (418줄, 3-step 컨테이너)
- 자식 단계: `ProductSelectionStep.jsx`(300줄) / `CustomerInfoStep.jsx`(282줄) / `OrderReviewStep.jsx`(140줄)
- 보조: `OrderStepIndicator.jsx`(110줄), `FloatingBottomBar.jsx`(189줄), `CartBottomSheet.jsx`(215줄), `ProductCard.jsx`(213줄), `CostSummary.jsx`(135줄)
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
- [ ] **Step 0(상품 선택)에서는 표시하지 않음** — `activeStep > 0`일 때만 렌더 (`OrderPage.jsx:298`)
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

#### 상품 그리드 (line 251-289)
- [ ] CSS Grid, `gridTemplateColumns: 'repeat(auto-fill, minmax(155px, 1fr))'`, gap 1.5
- [ ] 페이지네이션: 40개씩 무한 스크롤 (`IntersectionObserver`, `PAGE_SIZE=40`)
- [ ] 정렬 규칙: 인기 상품 우선(`is_popular`) → 이름 오름차순 (`localeCompare`)
- [ ] 필터 조합: 학회 태그(`eventTags`) ∩ 카테고리 ∩ 뷰 모드(인기/신규/전체) ∩ 검색
  - 검색 중에는 학회 태그·뷰 모드 무시 (line 49-65)

#### 상품 카드 (`ProductCard.jsx`)
- [ ] 보더 1.5px — 장바구니에 있으면 `primary.main`, 없으면 `divider`
- [ ] 상단 배지 영역 (mb 0.75):
  - **배지 = 솔리드 칩 아님. 소프트 틴트 박스(높이 18, radius 4px, alpha 0.12~0.14 배경 + 컬러 텍스트). 2026-06-01 /preview 목업 정합.**
  - 카테고리 배지 — `category` 있으면 표시(`도구`는 `검사`로). `검사`=`alpha(info.main,0.14)` 배경+`info.dark` 텍스트 / 그 외(`도서` 등)=`gray[200]` 배경+`text.secondary`
  - 인기 배지 — `is_popular=true`일 때, `alpha(accent.attention,0.14)` 배경 + `accent.attention` 색 + **`StarIcon`(11px) + "인기" 텍스트** (★ 단독 아님)
  - 신규 배지 "NEW" — `is_new=true`일 때, `alpha(error.main,0.12)` 배경 + `error.main` 텍스트
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
- [ ] 필드 6: **우편번호** — `name="postcode"`, readOnly, 모달이 자동으로 채움
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
- [ ] position fixed bottom 0, 좌우 max(0, (100vw - 600px) / 2)로 **부모 콘텐츠 컬럼(600px)에 맞춰 가운데 정렬** (뷰포트 풀폭 아님 — 부모 컨테이너 폭에 정합), zIndex 1200
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
  - Step 1: `!isCustomerInfoValid || !hasCartItems` (성함·연락처 필수)
  - Step 2: 위 + `isSubmitting`
- [ ] 제출 중: 아이콘 자리에 `CircularProgress` size 20, 라벨 "주문 처리 중..."
- [ ] 끝 아이콘: Step 0·1은 `ArrowForwardIcon`, Step 2는 없음

### CartBottomSheet (`CartBottomSheet.jsx`, Step 0의 카트 아이콘 클릭 시)
> 2026-06-01 디자인 시스템 정합(M3 후속): raw-hex·인라인 토큰을 theme 토큰으로 교체. 시각·기능 동일, 라벨 구조 불변.
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

### `products` 테이블 (조회만)
- `id`, `name`, `product_code`, `category`, `list_price`, `is_discountable`, `is_popular`, `is_new`, `tags`

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

## 변경 이력
- 2026-06-01 상품 카드/하단바 목업 정합 (건우님 좌우 비교 지시) — (1) **배지 솔리드 칩 → 소프트 틴트 박스**(alpha 0.12~0.14), 인기 배지 "★" 단독 → **StarIcon+"인기"**. (2) **"담기" 버튼 파랑(primary) → 회색**(테마 기본 outlined). (3) ~~하단바 배경 풀폭~~ **철회·복구**(건우님 지시) — 하단바는 **부모 콘텐츠 컬럼(600px)에 맞춰 정렬**. 뷰포트 풀폭으로 채운 건 오판, 즉시 복구. (4) **`도구` 카테고리 → `검사`로 정규화**(별도 칩 X, 검사 필터에 포함, 카드 배지도 검사). 파일: `ProductCard.jsx`·`ProductSelectionStep.jsx`·`FloatingBottomBar.jsx`.
- 2026-06-01 고객 주문 화면 보강 (건우님 지시) — (1) **검색바** 회색 채움 `#F2F4F6` → **흰색 기본 아웃라인**(/preview 목업 정합, 플레이스홀더 멀티키워드 힌트 유지). (2) **뷰/카테고리 칩** 알약형 → `radii.sm`(8px) 둥근 사각. (3) **Step 1 헤더** `isOnsitePurchase` 분기 — 배송 "배송 받으실 주소를 입력해주세요" / 현장 "주문자 정보를 입력해주세요" 유지. (4) **Step 1·2 부제** → "{이벤트명} · N% 할인 적용"(Step 0 패턴 통일, 양쪽 모드). (5) **CTA Step 0** "주문서 작성하기" → 배송 "배송지 입력하기" / 현장 기존 유지. (6) **제출 후 OrderStatusPage 연락처** `mono`(monospace) 제거 → 일반 폰트. **보존**: 주소 3필드 분리·현장구매 배송지 숨김·할인/무료배송 로직·검색 멀티키워드 전부 무변경. **현장구매 모드 문구는 전부 기존 보존**(배송 문구 강제 주입 안 함).
- 2026-05-13 신설 — M2 시안 착수 사전 정독. `OrderPage.jsx` 외 6개 자식·보조 컴포넌트 + DB 마이그레이션 + create-order edge function 전수. 환각 방지 위해 컬럼명 불일치·문구 잔재·`is_on_site_sale` 미사용 등 의심 8건은 "확인 필요"로 표기.
- 2026-05-29 M3-10 시안 정합 — `OrderPage.jsx` + 자식 7종(`OrderStepIndicator`/`FloatingBottomBar`/`ProductCard`/`ProductSelectionStep`/`CustomerInfoStep`/`OrderReviewStep`/`CostSummary`) 토큰화. **보존**: 트리플탭 600ms 3회·Step 0 인디케이터 숨김·주소 3필드 분리(DaumPostcode 모달)·`hasOnlineCode` 조건부 인싸이트 ID·현장구매 배송지 섹션 숨김·API/Supabase/Edge Function/알림톡 트리거·`CartBottomSheet` 변경 0·성공 다이얼로그 fallback·접근 차단 화면. **교체**: 인라인 raw hex 0건(theme 토큰 경유), 인라인 `fontSize`/`borderRadius` 흡수(글로벌 MuiCard·MuiButton·MuiTextField·MuiChip 토큰 위임), `bgcolor: '#F8F9FA'` → `theme.gray[50]`, `'#F2F4F6'` → `theme.gray[100]`, `'rgba(43,57,143,...)'` → `alpha(primary.main, ...)`, 사양 §발견 7 잔재 문구 정리 — `OrderPage:139`의 "성함, 연락처, 이메일" → "성함, 연락처", 배송 예정일 안내의 트럭 이모지 → `ShippingIcon` 컴포넌트. **신규 없음**(시안 답습 0건). **사양 §발견 1~7 모두 보존 확인.**
