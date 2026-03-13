# Inpsyt Order v2 — 코드 분석, QA, FAQ 및 개선 방향

> 작성일: 2026-03-12
> 분석 대상: `feature/toss-style-ux-overhaul` 브랜치

---

## 1. 현재 코드 상태 세밀 분석

### 1-A. 프로젝트 아키텍처

| 계층 | 기술 스택 | 상태 |
|------|-----------|------|
| Frontend | React 19 + Vite 7 + MUI 7.2 + Emotion | 안정 |
| Backend | Supabase (PostgreSQL 17 + Deno Edge Functions) | 안정 |
| 인증 | Supabase Auth + RLS/RBAC (view/edit/master) | 구현 완료 |
| 이메일 | Resend API (주문 확인 메일) | 구현 완료 |
| 배포 | Vercel (vercel.json 존재) | 구성 완료 |

### 1-B. 고객 주문 플로우 (핵심 페이지) 상세 분석

**OrderPage.jsx** — 3단계 위자드 오케스트레이터
- Step 0: `ProductSelectionStep` → 상품 그리드 + 카테고리 필터
- Step 1: `CustomerInfoStep` → 필수정보 + 배송지 + 선택사항
- Step 2: `OrderReviewStep` → 주문 확인 + 비용 요약
- 상태 관리: `activeStep`, `cart[]`, `customerInfo{}`, `eventInfo`, `isOnsitePurchase`
- 하단 고정 바: `FloatingBottomBar` (장바구니 아이콘 + CTA 버튼)
- 장바구니: `CartBottomSheet` (SwipeableDrawer)

**ProductSelectionStep.jsx** — 상품 목록
- 검색: 300ms 디바운스 검색
- 필터: viewMode (전체/인기) + category (전체/검사/도서/기타)
- 그리드: `repeat(auto-fill, minmax(155px, 1fr))` — 반응형 4열
- 상품 로딩: `fetchProducts()` API 호출 (category, tags, isPopularOnly 지원)

**ProductCard.jsx** — 개별 상품 카드
- 표시 정보: 상품명(2줄 클램프), 가격, 할인율 Chip(빨간색)
- 액션: "담기" 버튼 또는 수량 스테퍼 (-/수량/+)
- 선택 상태: border-color가 primary.main으로 변경
- **문제점: 카테고리(검사/도서) 구분이 전혀 표시되지 않음**

**CustomerInfoStep.jsx** — 주문자 정보 입력
- 필수: 성함, 연락처(자동포맷 010-1234-5678), 이메일(도메인 자동완성)
- 배송지: 다음 우편번호 검색 → 주소 + 상세주소
- 선택: 인싸이트 ID(온라인코드 구매 시), 요청사항
- 현장구매 모드: 배송지 섹션 숨김

**OrderReviewStep.jsx** — 주문 확인
- 3개 카드: 주문 상품, 주문자 정보, 결제 정보
- 각 카드에 "수정" 버튼 → 해당 스텝으로 이동

**CostSummary.jsx** — 비용 계산
- 총 상품 금액, 할인 금액, 배송비(3만원 미만 3,000원), 최종 결제 금액
- 무료배송 프로그레스 바 (그라데이션)

**FloatingBottomBar.jsx** — 하단 고정 바
- Step 0: 장바구니 아이콘(Badge) + "다음" 버튼
- Step 1-2: 뒤로가기 + "다음"/"주문 제출하기" 버튼
- 무료배송 진행률 표시 (Step 0)

### 1-C. 어드민 페이지 분석

**DashboardPage.jsx** — 관리자 대시보드
- KPI 카드: 총 주문, 총 매출, 검사 판매, 도서 판매
- 상태 분포 바 (pending/paid/preparing/shipped 등)
- 카테고리별 Top 5 상품 랭킹
- 최근 주문 목록
- 현장 보고서 (field_reports) 섹션

**OrderManagementPage.jsx** — 주문 관리
- 테이블 기반 주문 목록 + 필터/검색
- OrderDetailModal로 상세 보기/수정

**ProductManagementPage.jsx** — 상품 관리 (CRUD + 엑셀 업로드)

**EventManagementPage.jsx** — 학회/이벤트 관리

**UserManagementPage.jsx** — 사용자/권한 관리

### 1-D. 데이터 모델 핵심

**products 테이블:**
```
id, product_code, category, sub_category, name, list_price,
notes, is_discountable, is_popular, created_at
```
- `category` 필드: '검사', '도서', '도구', '온라인코드' 등의 값
- `is_discountable`: 할인 적용 여부
- `is_popular`: 인기 상품 표시

**orders 테이블:**
```
id, customer_name, email, phone_number, shipping_address(jsonb),
inpsyt_id, customer_request, status, event_id, total_cost,
discount_amount, delivery_fee, final_payment, is_email_sent, admin_memo
```

**order_items 테이블:**
```
id, order_id, product_id, quantity, price_at_purchase
```

**events 테이블:**
```
id, name, start_date, end_date, order_url_slug, discount_rate, tags
```

### 1-E. 디자인 시스템 현황

| 요소 | 현재 값 | 비고 |
|------|---------|------|
| Primary | `#2B398F` (딥블루) | 토스 스타일 |
| Secondary | `#6C5CE7` (퍼플) | |
| Background | `#F5F6F8` | 밝은 회색 |
| Card radius | 16px | 부드러운 카드 |
| Button radius | 12px | |
| Font | Pretendard Variable | 한글 최적화 |
| Easing | `cubic-bezier(0.33, 1, 0.68, 1)` | 토스 스타일 |
| 터치 타깃 | 44px+ | 모바일 최적화 |

---

## 2. 카테고리 배지 기능 (검사/도서 구분)

### 현재 문제
ProductCard에는 상품의 카테고리(검사/도서)를 구분하는 시각적 표시가 없다. 사용자가 상품 목록을 볼 때 상품이 검사 도구인지 도서인지 즉시 파악하기 어렵다. 카테고리 필터로 구분은 가능하지만, "전체" 모드에서 혼합 표시될 때 구분이 불가능하다.

### 해결 방안

**카테고리별 색상 배지:**

| 카테고리 | 색상 | HEX | 라벨 |
|---------|------|-----|------|
| 검사 | 인디고 | `#6366F1` | "검사" |
| 도서 | 블루 | `#3B82F6` | "도서" |
| 도구 | 그린 | `#10B981` | "도구" |
| 온라인코드 | 앰버 | `#F59E0B` | "온라인" |
| 기타 | 회색 | `#8B95A1` | 카테고리명 |

**적용 위치:**
- `ProductCard.jsx` — 상품명 위에 카테고리 배지 (height 20px, fontSize 10px)
- `CartBottomSheet.jsx` — 장바구니 아이템 이름 옆에 소형 태그
- `OrderReviewStep.jsx` — 주문 확인 상품 목록에 소형 태그

---

## 3. 사용자 관점 QA 분석

### 3-A. 고객 주문 플로우 QA

| # | 시나리오 | 현재 상태 | 심각도 | 상세 |
|---|---------|-----------|--------|------|
| Q1 | 상품 카테고리 구분 | **미흡** | 중 | ProductCard에 검사/도서 구분 배지 없음. 전체 보기 시 어떤 상품이 검사이고 도서인지 알 수 없음 |
| Q2 | 이벤트 없이 접근 | 정상 | - | 학회 선택 Dialog가 뜨며 필수 선택 후 진행 가능 |
| Q3 | 잘못된 이벤트 slug | 정상 | - | 에러 메시지 + 학회 선택 Dialog 표시 |
| Q4 | 빈 장바구니로 다음 단계 | 정상 | - | "상품을 1개 이상 담아주세요" 에러 |
| Q5 | 필수 정보 미입력 | 정상 | - | "필수 정보를 입력해주세요" 에러 |
| Q6 | 수량 0으로 감소 | 정상 | - | 수량 1에서 - 클릭 시 장바구니에서 삭제(DeleteIcon) |
| Q7 | 중복 상품 추가 | 정상 | - | "이미 추가된 상품입니다" 알림 |
| Q8 | 전화번호 포맷팅 | 정상 | - | 자동으로 010-1234-5678 형식 적용 |
| Q9 | 이메일 자동완성 | 정상 | - | @naver.com, @gmail.com 등 도메인 제안 |
| Q10 | 주소 검색 | 정상 | - | 다음 우편번호 API 모달로 검색 |
| Q11 | 현장구매 모드 | 정상 | - | 헤더 3탭으로 토글, 배송지 섹션 숨김, 배송비 0원 |
| Q12 | 주문 성공 후 초기화 | 정상 | - | 성공 Dialog 닫으면 cart/customerInfo/step 모두 초기화 |
| Q13 | 할인 계산 정확성 | **확인 필요** | 중 | 배송비 무료 판단 기준 불일치 (아래 상세) |
| Q14 | 온라인코드 + 인싸이트 ID | 정상 | - | 온라인코드 상품 담으면 인싸이트 ID 필드 자동 표시 |
| Q15 | 검색 결과 없음 | 정상 | - | "검색 결과가 없습니다" 빈 상태 표시 |
| Q16 | Step 이동 시 스크롤 | 정상 | - | `window.scrollTo(0, 0)` 호출 |

### 3-B. 관리자 플로우 QA

| # | 시나리오 | 현재 상태 | 심각도 | 상세 |
|---|---------|-----------|--------|------|
| A1 | 대시보드 카테고리 분류 | 정상 | - | 검사/도서 매출을 `category.includes()` 로 정확히 분리 |
| A2 | 주문 상세 모달 | 정상 | - | 주문 정보, 상품 목록, 상태 변경 가능 |
| A3 | 권한 기반 메뉴 | 정상 | - | view/edit/master 레벨별 메뉴 필터링 |
| A4 | 엑셀 다운로드 | 정상 | - | xlsx 라이브러리로 주문 데이터 내보내기 |

### 3-C. 발견된 잠재적 이슈

#### 이슈 1: 배송비 무료 판단 기준 불일치 (심각도: 중)

배송비 무료 기준(3만원)을 판단하는 금액이 컴포넌트마다 다릅니다:

| 컴포넌트 | 파일:라인 | 기준 금액 |
|---------|-----------|-----------|
| CostSummary | `CostSummary.jsx:34` | `totalOriginalPrice` (**할인 전** 금액) |
| FloatingBottomBar | `FloatingBottomBar.jsx:78` | `totalPrice` (**할인 후** 금액) |
| CartBottomSheet | `CartBottomSheet.jsx:190` | `totalPrice` (**할인 후** 금액) |

**영향:** 할인율이 높은 경우, CostSummary에서는 "무료배송"으로 표시되지만 FloatingBottomBar에서는 "배송비 3,000원"으로 표시될 수 있습니다.

**권장:** 하나의 기준(할인 후 금액 또는 할인 전 금액)으로 통일 필요.

#### 이슈 2: 카테고리 배지 부재 (심각도: 중)

전체 보기 모드에서 상품이 검사인지 도서인지 구분 불가. 이번 작업에서 해결 예정.

#### 이슈 3: 수량 상한선 없음 (심각도: 하)

ProductCard, CartBottomSheet 모두 수량에 max limit 없음. 재고 관리 기능이 없으므로 현재 실질적 문제는 아니나, 비정상적 대량 주문 방지를 위해 향후 고려 필요.

---

## 4. 주요 FAQ

### 고객용 FAQ

**Q1. 주문은 어떻게 하나요?**
상품 선택 → 주문자 정보 입력 → 주문 확인 → 제출의 3단계로 진행됩니다.
학회별 전용 URL(`/order?events={slug}`)로 접속하거나, 학회 선택 화면에서 학회를 선택하면 됩니다.

**Q2. 할인은 어떻게 적용되나요?**
학회별로 할인율이 설정되어 있으며, 할인 대상 상품에만 적용됩니다.
할인 적용 상품에는 빨간색 할인율 배지가 표시됩니다.

**Q3. 배송비는 얼마인가요?**
3만원 미만 주문 시 3,000원, 3만원 이상 무료배송입니다.
현장구매 모드에서는 배송비가 부과되지 않습니다.

**Q4. 현장구매는 어떻게 하나요?**
학회명 영역을 3번 빠르게 탭하면 현장구매 모드가 활성화됩니다.
현장구매 시 배송지 입력이 생략되고 배송비가 0원입니다.

**Q5. 온라인코드 상품은 무엇인가요?**
온라인코드 상품을 장바구니에 담으면 인싸이트 홈페이지 ID 입력란이 나타납니다.
해당 ID로 온라인코드가 발급됩니다.

**Q6. 주문 후 결제는 어떻게 하나요?**
주문 접수 후 이메일로 결제 안내가 발송됩니다.
(현재 온라인 결제 연동은 없으며, 별도 안내에 따라 결제)

**Q7. 주문 취소/수정은 가능한가요?**
주문 제출 후에는 고객이 직접 수정할 수 없습니다.
관리자에게 연락하여 수정/취소를 요청해야 합니다.

### 관리자용 FAQ

**Q8. 주문 상태는 어떤 것들이 있나요?**
pending(결제 대기) → paid(결제완료) → preparing(상품준비중) → shipped(배송중) → delivered(배송완료)
또는 cancelled(주문취소), refunded(결제취소)

**Q9. 상품은 어떻게 일괄 등록하나요?**
상품 관리 페이지에서 엑셀 파일 업로드. `product_code` 기준 upsert 처리됩니다.

**Q10. 학회별 할인율은 어떻게 설정하나요?**
이벤트 관리 페이지에서 학회 정보에 `discount_rate` (0~1 사이 소수) 설정.
예: 10% 할인 = 0.1

---

## 5. 개선 방향성

### 5-A. 즉시 개선 (현재 작업 범위)

| 우선순위 | 항목 | 설명 |
|----------|------|------|
| **P0** | 카테고리 배지 | ProductCard에 검사/도서/도구/온라인 배지 추가 |
| P1 | 배송비 계산 기준 통일 | CostSummary/FloatingBottomBar/CartBottomSheet 간 기준 통일 |

### 5-B. 단기 개선 제안 (다음 스프린트)

| 항목 | 설명 | 난이도 |
|------|------|--------|
| 주문 확인 이메일 미리보기 | 고객에게 발송될 이메일 내용을 주문 확인 단계에서 미리보기 | 중 |
| 주문 조회 페이지 | 고객이 주문번호/이메일로 주문 상태 확인 가능 | 중 |
| 검색 UX 개선 | 초성 검색, 상품코드 검색 지원 | 하 |
| 최근 주문 자동완성 | 이메일 입력 시 이전 주문 정보 자동 채우기 (로컬스토리지) | 하 |
| 수량 상한선 | 상품별 최대 주문 수량 설정 기능 | 하 |

### 5-C. 중장기 개선 제안

| 항목 | 설명 | 난이도 |
|------|------|--------|
| 온라인 결제 연동 | 토스페이먼츠/카카오페이 등 PG 연동 | 상 |
| 재고 관리 | products에 stock 필드 추가, 실시간 재고 차감 | 중 |
| 주문 알림 | 관리자에게 실시간 알림 (웹 푸시/카카오톡) | 중 |
| 상품 이미지 | Supabase Storage 활용 상품 이미지 업로드/표시 | 중 |
| 다국어 지원 | i18n 적용 (영어 등) | 중 |
| 접근성 개선 | ARIA 레이블, 키보드 내비게이션, 고대비 모드 | 중 |
| PWA 전환 | 오프라인 지원, 홈 화면 추가 | 중 |
| A/B 테스트 | 상품 배치, CTA 문구 등 전환율 최적화 | 상 |

---

## 6. 컴포넌트 의존성 맵

```
OrderPage.jsx (오케스트레이터)
├── OrderStepIndicator.jsx (스텝 진행 표시)
├── ProductSelectionStep.jsx (Step 0)
│   └── ProductCard.jsx (개별 상품 카드)
├── CustomerInfoStep.jsx (Step 1)
│   └── react-daum-postcode (주소 검색)
├── OrderReviewStep.jsx (Step 2)
│   └── CostSummary.jsx (비용 계산)
├── FloatingBottomBar.jsx (하단 CTA)
└── CartBottomSheet.jsx (장바구니 드로어)
```

```
AdminLayout.jsx
├── AdminSidebar.jsx (좌측 메뉴)
├── AdminHeader.jsx (상단 바)
├── DashboardPage.jsx (대시보드)
├── OrderManagementPage.jsx (주문 관리)
│   └── OrderDetailModal.jsx (주문 상세)
├── ProductManagementPage.jsx (상품 관리)
├── EventManagementPage.jsx (이벤트 관리)
└── UserManagementPage.jsx (사용자 관리)
```

---

## 7. API 레이어 요약

| 파일 | 함수 | 설명 |
|------|------|------|
| `api/products.js` | `fetchProducts(params)` | 상품 검색/필터 (category, tags, isPopularOnly, searchTerm) |
| `api/products.js` | `fetchAllProducts()` | 전체 상품 조회 (청크 페이지네이션) |
| `api/orders.js` | `getOrders(params)` | 주문 목록 (status, event, date range, search) |
| `api/events.js` | `getEvents()` | 활성 이벤트 목록 |

**Edge Functions:**

| 함수 | 설명 |
|------|------|
| `create-order` | 주문 생성 (서버 사이드 비용 계산) |
| `update-order` | 주문 수정 (RPC 함수 호출) |
| `send-order-email` | 주문 확인 이메일 발송 (Resend API) |
| `upload-products-excel` | 엑셀 상품 일괄 업로드 |
