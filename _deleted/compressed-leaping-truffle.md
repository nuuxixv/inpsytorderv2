# 토스 테이블오더 스타일 전면 UX/UI 고도화

## Context

학회 현장 온라인 주문서 서비스의 전면적인 UX/UI 고도화. 토스 테이블오더의 핵심 원칙을 도입:
- **"1 Thing / 1 Page"**: 한 화면에 하나의 목적
- **Floating Bottom CTA**: 항상 보이는 하단 액션 바
- **상품 카드 그리드**: 드롭다운 → 카드형 상품 탐색
- **Bottom Sheet 장바구니**: 펼쳐볼 수 있는 장바구니
- **48px+ 터치 타깃**: 모바일 최적화 입력 크기

고객 99%가 모바일, 관리자는 태블릿/모바일 사용.

---

## 0단계: 브랜치 생성

```bash
git checkout -b feature/toss-style-ux-overhaul
```

---

## 1단계: 테마 기반 업데이트

**파일: `src/theme.js`**

### Typography 모바일 최적화
```
h1: 800 / 1.75rem    h2: 800 / 1.5rem     h3: 700 / 1.25rem
h4: 700 / 1.125rem   h5: 700 / 1rem       h6: 600 / 0.9375rem
body1: 0.9375rem (15px)   body2: 0.8125rem (13px)
button: 600 / 0.9375rem / textTransform:none
```

### shape.borderRadius: `4 → 8`
- `borderRadius: 2` = 16px, `borderRadius: 3` = 24px → 더 부드러운 Toss 느낌

### 컴포넌트 오버라이드 변경
| 컴포넌트 | 기존 | 변경 | 추가 |
|----------|------|------|------|
| MuiCard | borderRadius:12, shadow | borderRadius:16, **shadow:none**, border 유지 | — |
| MuiButton | borderRadius:8, pad 8x16 | borderRadius:12, pad 10x20, **minHeight:44** | `&:active { scale(0.98) }`, sizeLarge: minHeight 52, fontSize 17px |
| MuiTextField | borderRadius:8, bg:white | borderRadius:12, bg:`#F8FAFC`, **fontSize:16px** | minHeight:48 (iOS zoom 방지) |
| MuiChip | borderRadius:6 | borderRadius:8, **height:32** | fontWeight:600 |

### 트랜지션 토큰
```js
transitions.easing.tossEaseOut: 'cubic-bezier(0.33, 1, 0.68, 1)'
```

---

## 2단계: 고객 주문 플로우 — 3단계 위자드 전환

현재: 단일 긴 페이지 (폼 → 상품 → 결제요약 → 제출)
변경: **Step 0: 상품 선택 → Step 1: 주문자 정보 → Step 2: 주문 확인 & 제출**

### 2-A. OrderPage.jsx 재작성 (위자드 오케스트레이터)

**파일: `src/components/OrderPage.jsx`** — 전면 재작성

```
구조:
┌─────────────────────────┐
│  OrderStepIndicator     │  ← sticky top, 56px
├─────────────────────────┤
│                         │
│   Step Content          │  ← flex:1, scrollable, pb:100px
│   (0/1/2 조건부 렌더링)  │
│                         │
├─────────────────────────┤
│  FloatingBottomBar      │  ← fixed bottom, 장바구니요약+CTA
└─────────────────────────┘
```

핵심 상태 추가:
- `activeStep` (0, 1, 2)
- `cartSheetOpen` (bottom sheet 토글)

기존 상태 유지: `customerInfo`, `cart`, `eventInfo`, `loading`, `error`, `showSuccessDialog` 등

Step 전환 로직:
- Step 0→1: `cart.filter(i => i.id).length > 0` 검증
- Step 1→2: `name && phone && email` 검증
- Step 2→제출: 기존 `handleSubmitOrder` 호출

이벤트 선택 Dialog, 성공 Dialog는 기존 그대로 유지.

### 2-B. 새 컴포넌트: `OrderStepIndicator.jsx`

3개 스텝 점+라인 인디케이터 (MUI Stepper 대신 커스텀):
- "상품 선택" / "주문자 정보" / "주문 확인"
- sticky top, height 56px, white bg, bottom border
- 활성: primary.main + fontWeight 700, 완료: 체크 아이콘
- 비활성: text.secondary

### 2-C. 새 컴포넌트: `FloatingBottomBar.jsx`

```
Step 0: [🛒 {N}개 {총액}원 (클릭→바텀시트)]  [다음 →]
Step 1: [← 이전]                              [다음 →]
Step 2: [← 이전]                              [주문 제출하기]
```

- position: fixed, bottom: 0, z-index: 1200
- white bg, border-top, boxShadow: `0 -4px 20px rgba(0,0,0,0.08)`
- CTA 버튼: minHeight 52px, borderRadius 14, fontWeight 700, fontSize 17px
- safe-area: `pb: env(safe-area-inset-bottom)`

### 2-D. ProductSelector.jsx → 상품 카드 그리드로 재작성

**파일: `src/components/ProductSelector.jsx`** — 전면 재작성

현재: Autocomplete 드롭다운 + 테이블/카드 목록
변경: 검색바 + 카테고리 칩 필터 + 상품 카드 그리드

```
┌─────────────────────────┐
│  "상품을 선택해주세요"    │  헤더
│  {이벤트명} - {할인율}   │
├─────────────────────────┤
│  🔍 상품명으로 검색      │  검색 TextField (height:48)
├─────────────────────────┤
│  [전체] [인기⭐] [도서]...│  가로 스크롤 Chip 필터
├─────────────────────────┤
│  ┌────┐ ┌────┐ ┌────┐  │
│  │카드 │ │카드 │ │카드 │  │  CSS Grid: minmax(160px, 1fr)
│  │    │ │    │ │    │  │
│  │담기 │ │-2+│ │담기 │  │  담기 또는 수량스테퍼
│  └────┘ └────┘ └────┘  │
│  ...더 많은 카드...      │
└─────────────────────────┘
```

데이터 로딩 변경:
- 마운트 시 `fetchProducts('', eventTags, { productsPerPage: 50 })` 호출 (인기순 정렬)
- 검색: 기존 300ms 디바운스 유지
- 카테고리 필터: `fetchProducts({ category })` 호출
- 기존 `fetchProducts` API는 이미 category, tags, isPopularOnly 지원 → 변경 불필요

### 2-E. 새 컴포넌트: `ProductCard.jsx`

개별 상품 카드:
- borderRadius: 16, border: 1px solid divider, **shadow: none**
- 카트에 있으면: border-color → primary.main (0.2s transition)
- 상품명: body2, fontWeight 600, max 2줄 line-clamp
- 가격: 할인 시 취소선 + 할인가 + 할인율 Chip
- 하단: 미담기 → "담기" 버튼 (outlined, h:40px) / 담기됨 → 수량 스테퍼 (primary bg, white 아이콘)
- 수량 1이고 - 누르면 삭제 (DeleteIcon)

### 2-F. 새 컴포넌트: `CartBottomSheet.jsx`

MUI `SwipeableDrawer` anchor="bottom":
- PaperProps: borderRadius '16px 16px 0 0', maxHeight '70vh'
- 드래그 핸들 바 (40×4px grey bar)
- 헤더: "장바구니" + 개수 Badge + 닫기
- 아이템 리스트: 이름, 가격, 수량 스테퍼, 삭제
- 푸터: 총 금액 표시

### 2-G. OrderForm.jsx 개선

**파일: `src/components/OrderForm.jsx`** — 구조 개선

변경:
- 외부 `<Card>` 래퍼 제거 (위자드 컨테이너가 패딩 제공)
- 섹션별 그룹핑: **필수 정보** (이름/연락처/이메일) → **배송지** (주소/상세/우편번호) → **추가 정보** (ID/요청)
- 각 섹션에 `<Typography variant="overline">` 라벨
- 섹션 간 `<Divider>`
- 큰 헤더: "주문자 정보를 입력해주세요" (h5, fontWeight 800)
- 서브: "배송에 필요한 정보입니다" (body2, text.secondary)
- 입력 높이: 52px (theme에서 48px 기본, 여기서 추가 조정)
- 기존 DaumPostcode 모달, 전화번호 포맷팅 로직 그대로 유지

### 2-H. 새 컴포넌트: `OrderReviewStep.jsx`

최종 확인 화면:
- "주문 내용을 확인해주세요" (h5, fontWeight 800)
- **주문 상품 카드**: 각 아이템 이름, 단가×수량, 소계 / "수정" 버튼 → Step 0으로
- **주문자 정보 카드**: 이름, 연락처, 이메일, 주소 요약 / "수정" 버튼 → Step 1로
- **결제 정보**: CostSummary 컴포넌트 임베드

### 2-I. CostSummary.jsx 수정

**파일: `src/components/CostSummary.jsx`** — 소규모 수정

- 외부 `<Card>` 래퍼 제거 → OrderReviewStep에서 감싸거나 standalone 사용
- `compact` prop 추가: true면 무료배송 바 숨기고 금액만 표시 (FloatingBottomBar용)
- 기존 계산 로직 완전 유지

---

## 3단계: 어드민 모바일 개선

### 3-A. OrderManagementPage.jsx 모바일 카드 뷰

**파일: `src/components/OrderManagementPage.jsx`**

추가:
- `useMediaQuery(theme.breakpoints.down('md'))` → `isMobile`
- 모바일: Table 대신 `Stack<Card>` 렌더링 (이름, 상태Chip, 날짜, 금액)
- 모바일 필터: `<Button startIcon={FilterList}>필터</Button>` + `SwipeableDrawer anchor="bottom"` 안에 필터 컨트롤 세로 배치
- 기존 데스크탑 Table/Filter는 그대로 유지 (조건부 렌더링)

### 3-B. DashboardPage.jsx 모바일 개선

**파일: `src/components/DashboardPage.jsx`**

- 최근 주문 Table → 모바일에서 카드 리스트
- 이벤트 선택 헤더: `flexDirection: { xs: 'column', md: 'row' }`
- StatCard는 이미 Grid xs=12 sm=6 md=3 → 유지

### 3-C. OrderDetailModal.jsx 모바일 풀스크린

**파일: `src/components/OrderDetailModal.jsx`**

- 모바일: `Drawer anchor="bottom"` (borderRadius '16px 16px 0 0', maxHeight '95vh')
- 데스크탑: 기존 Modal 유지

### 3-D. AdminSidebar.jsx 터치 개선

**파일: `src/components/AdminSidebar.jsx`**

- ListItemButton py: `1.5 → 2` (minHeight 52px)
- 활성 표시: 4px 좌측 border primary

---

## 수정/생성 파일 요약

### 새 파일 (7개)
| 파일 | 설명 |
|------|------|
| `src/components/OrderStepIndicator.jsx` | 3단계 진행 인디케이터 |
| `src/components/FloatingBottomBar.jsx` | 고정 하단 CTA 바 |
| `src/components/ProductCard.jsx` | 개별 상품 카드 |
| `src/components/CartBottomSheet.jsx` | 바텀시트 장바구니 |
| `src/components/OrderReviewStep.jsx` | Step 2: 주문 확인 |
| `src/components/CustomerInfoStep.jsx` | Step 1: OrderForm 래퍼 (섹션 구조화) |
| `src/components/ProductSelectionStep.jsx` | Step 0: 상품 그리드 (ProductSelector 대체) |

### 수정 파일 (8개)
| 파일 | 변경 범위 |
|------|-----------|
| `src/theme.js` | Typography, borderRadius, 컴포넌트 오버라이드 전면 업데이트 |
| `src/components/OrderPage.jsx` | 전면 재작성 (위자드 오케스트레이터) |
| `src/components/OrderForm.jsx` | Card 제거, 섹션 그룹핑, 입력 크기 증가 |
| `src/components/CostSummary.jsx` | Card 제거, compact prop 추가 |
| `src/components/OrderManagementPage.jsx` | 모바일 카드 뷰 + 필터 드로어 추가 |
| `src/components/DashboardPage.jsx` | 최근 주문 모바일 카드 뷰 |
| `src/components/OrderDetailModal.jsx` | 모바일 바텀 Drawer 전환 |
| `src/components/AdminSidebar.jsx` | 터치 타깃 확대, 활성 인디케이터 |

### 변경하지 않는 파일
- `src/api/products.js` — 이미 category, tags, isPopularOnly 파라미터 지원
- `src/App.jsx` — 라우팅 구조 변경 없음
- `src/supabaseClient.js` — 백엔드 변경 없음
- `ProductSelector.jsx` — 어드민 주문 생성 모달에서 계속 사용 (기존 Autocomplete 유지)

---

## 구현 순서

1. **브랜치 생성** → `feature/toss-style-ux-overhaul`
2. **theme.js** → 모든 시각 변경의 기반
3. **OrderStepIndicator + FloatingBottomBar** → 위자드 뼈대
4. **OrderPage.jsx 재작성** → 스텝 상태머신, 기존 컴포넌트를 스텝으로 래핑
5. **ProductCard + ProductSelectionStep** → 상품 카드 그리드 (핵심 UX 변화)
6. **CartBottomSheet** → 바텀시트 장바구니
7. **CustomerInfoStep + OrderForm 수정** → 주문자 정보 섹션 개선
8. **OrderReviewStep + CostSummary 수정** → 주문 확인 화면
9. **어드민 모바일** → OrderManagement, Dashboard, OrderDetailModal, Sidebar

---

## 검증 방법

1. `npm run dev` → `http://localhost:5173`
2. Chrome DevTools → iPhone 14 Pro (393px) / iPad (768px) / Desktop (1280px)
3. **고객 플로우 검증:**
   - 상품 카드 그리드가 정상 로딩되는지
   - 상품 담기/수량 변경/삭제가 되는지
   - 바텀시트 장바구니 열고 닫기
   - FloatingBottomBar CTA로 다음 단계 이동
   - 주문자 정보 입력 (필수 검증)
   - 주문 확인 화면에서 수정 버튼 동작
   - 주문 제출 및 성공 Dialog
4. **어드민 검증:**
   - 모바일에서 주문 목록 카드 뷰
   - 필터 드로어 열고 닫기
   - 주문 상세 바텀 시트
5. **테마 검증:**
   - borderRadius가 Toss처럼 부드러운지 (16px 카드, 12px 버튼)
   - 버튼/입력 터치 타깃이 44px+ 인지
   - 폰트 크기가 모바일에서 읽기 편한지
