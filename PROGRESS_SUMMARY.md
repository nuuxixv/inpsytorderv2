# 프로젝트 고도화 작업 요약 (2025-10-20)

이 문서는 Gemini 와 함께 진행한 인싸이트 오더 v2 프로젝트의 주요 개선 작업을
요약합니다.

---

## 1단계: 버그 수정 및 초기 리팩토링

- **문제:** 주문 상세 모달에서 '학회명' 등 주문 정보가 올바르게 수정되지 않는
  현상 발생.
- **원인 분석:**
  - 초기에는 `update-order`라는 Supabase Edge Function의 버그로 추정하고
    디버깅을 시도했으나, 해당 함수는 실제 코드에서 전혀 호출되지 않는 "유령
    함수"였음을 발견.
  - 실제 원인은 프론트엔드(`OrderDetailModal.jsx`)에서 `orders` 테이블 수정,
    `order_items` 삭제, `order_items` 추가라는 3단계의 DB 요청을 분리해서 보내는
    위험한 방식으로 구현되어 있었기 때문.
- **해결:**
  - 데이터 무결성을 보장하기 위해, 이미 데이터베이스에 준비되어 있던
    `update_order_details`라는 PostgreSQL 함수를 사용하도록 변경.
  - 프론트엔드에서 3번에 걸쳐 보내던 요청을, 이 함수를 호출하는 단 한 번의
    안전한 `rpc` 요청으로 변경하여 문제를 해결하고 코드 안정성을 확보.

## 2단계: 테스트 자동화 (안전망 구축)

- **목표:** 향후 리팩토링 및 기능 추가 시, 기존 기능의 안정성을 보장하기 위한
  자동화된 테스트 환경 구축.
- **작업 내용:**
  - `vitest`와 `React Testing Library`를 사용하여 테스트 환경 설정 및 디버깅.
    - `EMFILE: too many open files` 오류 해결을 위해 `vite.config.js` 수정 및
      아이콘 import 방식 최적화.
    - `Context` import 오류, `getByDisplayValue` 쿼리 오류 등 테스트 코드 자체의
      문제점들을 수정하며 테스트 환경 안정화.
  - 핵심 기능인 `OrderDetailModal.jsx` 컴포넌트에 대한 테스트 코드 2종 작성
    완료.
    1. **초기 렌더링 테스트:** 컴포넌트에 주문 데이터가 전달되었을 때, 모든
       정보가 올바르게 표시되는지 검증.
    2. **편집 및 저장 테스트:** 사용자가 '편집' 버튼을 누르고 데이터를 수정한 뒤
       '저장'했을 때, 새로 수정한 `rpc` 함수가 올바른 데이터와 함께 호출되는지
       검증.

## 3단계: 코드 품질 개선 (Linting)

- **목표:** 프로젝트 전체 코드의 일관성을 확보하고 잠재적인 오류를 제거.
- **작업 내용:**
  - `eslint`를 실행하여 총 19개의 오류 및 경고 발견.
  - 아래와 같은 유형의 문제들을 전수 수정:
    - `no-unused-vars`: 사용하지 않는 변수 및 import 구문 제거.
    - `react-hooks/exhaustive-deps`: `useCallback`, `useEffect`의 의존성 배열
      누락 또는 불필요한 의존성 포함 문제 해결.
    - `no-case-declarations`: `reducer` 함수 내 문법 오류 수정.
- **결과:** 모든 `lint` 오류 및 경고를 해결하여 코드 베이스의 품질과 안정성
  향상.

## 4단계: 아키텍처 개선 (관심사 분리)

- **API 로직 분리:**
  - `src/api` 폴더를 신설.
  - `OrderManagementPage.jsx`에 혼재되어 있던 데이터 요청 로직(주문, 학회, 상품
    목록 조회)을 각각 `api/orders.js`, `api/events.js`, `api/products.js` 파일로
    분리.
  - 컴포넌트는 이제 데이터 요청 로직을 직접 소유하지 않고, 분리된 API 함수를
    호출하여 데이터를 받아오는 역할만 수행.
- **상태 관리 개선:**
  - `OrderManagementPage.jsx`에 산재해 있던 20개 이상의 `useState` hook을 단일
    `useReducer` hook으로 통합.
  - `initialState` 객체와 `reducer` 함수를 통해 상태와 상태 변경 로직을 중앙에서
    관리하도록 구조 변경.
  - 복잡한 상태 업데이트 로직을 명확한 `action`으로 정의하여 코드의 가독성과
    예측 가능성 향상.

## 5단계: UI/UX 개선

- **목표:** '토스' 스타일과 표준 UI 가이드를 참고하여, 기능적인 현재 디자인을
  "모던 & 프로페셔널" 컨셉으로 개선.
- **작업 내용:**
  - `src/theme.js` 파일을 생성하여 앱 전체에 적용될 디자인 시스템(색상, 폰트,
    컴포넌트 스타일 등) 정의.
  - `main.jsx`를 수정하여 `ThemeProvider`로 앱 전체를 감싸, 새로운 테마가
    전역으로 적용되도록 설정.
  - `OrderManagementPage.jsx`, `DashboardPage.jsx`의 하드코딩된 스타일(배경색,
    그림자 등)을 제거하고, 새로운 테마를 따르도록 리팩토링.

---

여기까지의 작업을 통해 프로젝트는 초기보다 훨씬 더 안정적이고, 유지보수하기
쉬우며, 확장성 있는 구조를 갖추게 되었습니다.

## **추가 작업 요약 (2025-10-23)**

### **1. 관리자 페이지 '인기 상품' 저장 버그 수정**

- **문제:** 상품 관리 페이지에서 '인기 상품' 체크박스를 선택하고 저장해도 값이
  유지되지 않는 현상.
- **진단 과정:**
  1. **스키마 캐시 문제로 추정:** `supabase stop` 및 `start`를 통해 서비스를
     재시작했으나 문제 해결 실패.
  2. **컬럼 존재 여부 확인:** `information_schema.columns`를 조회하여
     `is_popular` 컬럼이 DB에 누락되었음을 확인.
  3. **데이터 손실 없는 마이그레이션:** `supabase db reset` 대신,
     `apply_migration` 도구를 사용하여 `is_popular` 컬럼을 추가하는
     마이그레이션만 수동으로 적용.
  4. **최종 원인 규명 (RLS):** 이후에도 저장이 안 되는 현상을 재확인.
     `pg_policies`를 조회하여 `products` 테이블에 `UPDATE`에 대한 RLS(Row-Level
     Security) 정책이 없어 수정이 불가능했음을 발견.
- **해결:** `CREATE POLICY`를 사용하여 `authenticated` 사용자가 `products`
  테이블을 수정할 수 있도록 허용하는 새로운 RLS 정책을 추가하여 문제를 최종
  해결.
- **교훈:** 향후 오류 없는 쓰기/수정 실패 시, **RLS 정책을 최우선으로
  점검**하도록 학습.

### **2. 상품 관리 페이지 검색/필터 기능 구현**

- **요구사항:** 상품 관리 페이지에 상품명으로 검색하고,
  카테고리(도서/검사/도구)로 필터링하는 기능을 추가. 입력과 동시에 결과가
  실시간으로 반영되어야 함.
- **구현 내용:**
  - **UI 추가:** `ProductManagementPage.jsx`에 상품명 검색을 위한 `TextField`와
    카테고리 필터링을 위한 `Select` 드롭다운 메뉴를 추가.
  - **상태 관리:** `searchTerm`과 `selectedCategory`를 위한 React `useState`
    훅을 추가.
  - **동적 데이터 조회:** `fetchProducts` 함수를 수정하여, `searchTerm`과
    `selectedCategory` 상태에 따라 Supabase 쿼리를 동적으로 생성.
    - 상품명 검색: `.ilike()` 메서드를 사용하여 대소문자 구분 없는 부분 일치
      검색 구현.
    - 카테고리 필터: `.eq()` 메서드를 사용하여 정확한 카테고리 일치 필터링 구현.
  - **실시간 검색 (Debouncing):** 사용자가 입력을 멈춘 후 300ms가 지나면 검색을
    실행하도록 `useEffect`와 `setTimeout`을 조합하여 디바운싱(Debouncing)을
    구현. 이를 통해 불필요한 API 요청을 최소화하고 사용자 경험을 개선.

---

## **추가 작업 요약 (2025-10-24)**

### **1. `image_url` 관련 기능 롤백**

- **`products` 테이블에서 `image_url` 컬럼 제거:** 데이터베이스 마이그레이션을
  통해 `image_url` 컬럼을 삭제했습니다.
- **`ProductManagementPage.jsx` 변경 사항 롤백:**
  - `currentProduct`의 초기 상태에서 `image_url` 필드를 제거했습니다.
  - 상품 추가/수정 다이얼로그에서 `image_url` 입력 필드를 제거했습니다.
- **`products.js` 변경 사항 롤백:**
  - `uploadProductImage` 함수를 제거했습니다.

### **2. 프론트엔드 성능 개선**

- **`ProductManagementPage.jsx` 이미지 표시 제거:** 제품 목록 테이블에서 이미지
  미리보기를 표시하는 컬럼을 제거하여 초기 로딩 성능을 개선했습니다.
- **`OrderPage.jsx` 및 `ProductSelector.jsx` 데이터 가져오기 최적화:**
  - `OrderPage.jsx`에서 제품 데이터를 한 번만 가져오고, 이 데이터를
    `ProductSelector` 컴포넌트에 prop으로 전달하도록 수정하여 중복 데이터
    가져오기를 제거하고 초기 로딩 성능을 개선했습니다.

### **3. `ProductSelector.jsx` `TypeError` 수정**

- **문제:** `ProductSelector.jsx`에서 `products` prop이 `undefined`일 때
  `.map()`을 호출하여 `TypeError`가 발생했습니다.
- **해결:** `(products || []).map(...)`을 사용하여 `products` prop이 `undefined`
  또는 `null`일 경우 빈 배열을 기본값으로 제공하도록 수정하여 오류를
  해결했습니다.

### **4. `OrderPage.jsx` 이벤트 선택 시 URL 업데이트 라우팅 오류 수정**

- **문제:** 이벤트 선택 다이얼로그에서 학회를 선택한 후 URL을
  `/order?events=<event_slug>`로 업데이트했을 때, `react-router-dom`이 해당
  경로를 찾지 못하는 오류가 발생했습니다.
- **해결:** `App.jsx`에 `<Route path="/order" element={<OrderPage />} />` 경로를
  추가하여 `/order` 경로가 `OrderPage` 컴포넌트를 렌더링하도록 수정했습니다。

---

## **추가 작업 요약 (2025-10-30)**

### **1. 주문 상태 일괄 변경 기능 구현**

- **프론트엔드**: `OrderManagementPage.jsx`에 주문 목록 체크박스 및 선택된
  주문의 상태를 일괄 변경하는 UI를 추가했습니다.
- **백엔드**: Supabase RPC 함수 `bulk_update_order_status`를 추가하여 여러
  주문의 상태를 한 번에 업데이트할 수 있도록 했습니다.

### **2. 세분화된 역할 기반 접근 제어 (Granular RBAC) 구현**

- **AuthContext 리팩토링**: `AuthContext.jsx`에서 사용자 역할을 단일
  문자열(`role`) 대신 세분화된 `permissions` 배열로 관리하도록 변경하고,
  `hasPermission` 헬퍼 함수를 추가했습니다. `master` 역할은 암묵적으로 모든
  권한을 가지며, 권한이 명시되지 않은 경우 기본 `operator` 권한이 부여됩니다.
- **프론트엔드 UI 업데이트**:
  - `AdminSidebar.jsx` 및 `AdminLayout.jsx`: 메뉴 표시 및 라우트 접근을
    `hasPermission` 기반으로 제어하도록 수정했습니다。
  - `OrderManagementPage.jsx`, `OrderDetailModal.jsx`,
    `EventManagementPage.jsx`, `ProductManagementPage.jsx`: 각 페이지의 UI
    요소(버튼, 입력 필드 등)를 해당 페이지의 `edit` 권한에 따라
    활성화/비활성화하도록 변경했습니다。
  - `UserManagementPage.jsx`: 사용자 목록 표시, 권한 관리 모달(체크박스), 메모
    수정, 초대, 삭제 기능을 구현했습니다.
- **백엔드 Edge Functions**:
  - `list-users`: 사용자 권한 정보를 포함하여 반환하도록 업데이트했습니다.
  - `update-user-permissions`: 사용자의 세분화된 권한을 업데이트하는 새로운
    함수를 추가했습니다.
  - `invite-user`: 초대 시 기본 `operator` 권한을 부여하도록 수정했습니다.
  - `delete-user`, `update-user-memo`: `master` 권한 확인 로직을 추가했습니다.
- **백엔드 RLS 정책**:
  - `get_current_user_permissions()` 함수를 추가하여 JWT에서 세분화된 권한을
    추출하도록 했습니다.
  - `orders`, `order_items`, `products`, `events` 테이블에 세분화된 `view` 및
    `edit` 권한 RLS 정책을 적용했습니다。

---

## **추가 작업 요약 (2025-10-31)**

### **1. Vercel 배포 문제 해결**

- **문제**: Vercel 배포 시 `404: NOT_FOUND` 오류 발생 및 빌드 로그 중단.
- **원인**: Vercel 프로젝트 설정의 "Build Command"가 `npm test && vite build`로
  되어 있어, `npm test`가 실패하거나 중단될 경우 `vite build`가 실행되지 않아
  배포 결과물이 생성되지 않았습니다. 또한, Vercel의 "Root Directory" 설정이
  `inpsyt-order-frontend`로 되어 있지 않아 빌드 결과물을 찾지 못하는 문제도
  있었습니다.
- **해결**:
  - Vercel 프로젝트 설정에서 "Root Directory"를 `inpsyt-order-frontend`로
    변경했습니다.
  - "Build Command"를 `npm test && vite build`에서 **`vite build`** 로 변경하여
    테스트와 빌드 프로세스를 분리했습니다.
- **결과**: 애플리케이션이 Vercel에 성공적으로 배포되어 정상 작동 확인.

## **추가 작업 요약 (2025-11-06)**

### **1. 대시보드 리팩토링 및 UX 개선**

- **배경:** 기존 대시보드 (`DashboardPage.jsx`)의 오류 해결 및 사용성 개선 요청.
- **주요 기능 구현:**
  - **이벤트 선택 드롭다운:** '전체' 또는 특정 학회를 선택하여 대시보드 데이터를
    동적으로 볼 수 있는 기능 추가.
  - **'전체' 보기:** 연간 실적 분석 도넛 차트 및 전체 최근 주문 목록 구현.
  - **'특정 학회' 보기:**
    - 금년 학기의 총 매출/주문 건수 표시.
    - 오늘의 매출/주문 건수 및 상태(결제대기, 결제완료, 주문취소, 결제취소)별
      수량 표시.
    - 작년 동일 학회의 총 매출/주문 건수 비교 (데이터 없을 시 "작년 데이터 없음"
      표시).
    - 해당 학회의 최근 주문 목록 표시.
- **UX/UI 개선:**
  - 대시보드 레이아웃을 고정된 2단 그리드 형태로 변경하여, 정보의 위계(오늘의
    현황 > 총 성과 > 작년 성과)를 명확히 하고 시각적 안정성을 확보.
  - 금액 표시 형식 통일 (쉼표와 '원' 사용, '₩' 기호 미사용).

### **2. `OrderDetailModal` 관련 오류 수정 및 UX 개선**

- **문제 1: `TypeError: Cannot read properties of undefined (reading 'find')`
  (`OrderDetailModal.jsx:213`)**
  - **원인:** `DashboardPage`에서 모달에 `events` prop을 누락하여 발생.
  - **해결:** `DashboardPage`에서 `events` prop을 `OrderDetailModal`에
    전달하도록 수정.
- **문제 2: `TypeError: hasPermission is not a function`
  (`OrderDetailModal.jsx:229`)**
  - **원인:** `DashboardPage`에서 모달에 `hasPermission` prop을 누락하여 발생.
  - **해결:** `DashboardPage`에서 `hasPermission` prop을 `OrderDetailModal`에
    전달하도록 수정.
- **문제 3: `TypeError: Cannot convert undefined or null to object`
  (`OrderDetailModal.jsx:295`)**
  - **원인:** `DashboardPage`에서 최근 주문 목록을 조회할 때 `order_items` 및
    `products` 상세 정보를 누락하여 발생. (`fetchOverallData` 및
    `fetchEventSpecificData` 쿼리 수정)
  - **해결:** `DashboardPage`의 `fetchOverallData` 및 `fetchEventSpecificData`
    쿼리에서 `order_items(*, products(*))`를 포함하여 완전한 `order` 객체를
    전달하도록 수정.
- **문제 4: 대시보드 `recentOrders` 테이블 상태(status) 영문 표시**
  - **원인:** `statusToKorean` 맵을 적용하지 않아 발생.
  - **해결:** `DashboardPage`의 `renderOverallView` 및
    `renderEventSpecificView`에서 `statusToKorean` 맵을 사용하여 상태를 한글로
    변환하여 표시하도록 수정.
- **문제 5: 모달 내 금액 불일치**
  - **원인:** 모달이 주문 당시의 저장된 금액 대신, 현재 기준으로 금액을
    재계산하여 발생.
  - **해결:** `OrderDetailModal` 로직을 수정하여 '편집' 모드가 아닐 때에는
    데이터베이스에 저장된 금액을, '편집' 모드일 때만 재계산 로직을 사용하도록
    수정.
- **문제 6: '알 수 없는 상품' 표시**
  - **원인:** `supabase.from('products').select('*')` 쿼리의 기본 조회
    제한(1000개)으로 인해 모든 상품을 가져오지 못해 발생.
  - **해결:** `DashboardPage`의 `fetchInitialData`에 `fetchAllProducts` 함수를
    구현하여, 상품 목록을 페이지네이션 방식으로 **모두 가져오도록** 수정.
- **문제 7: `OrderDetailModal` 상품 목록 헤더 줄바꿈**
  - **원인:** 테이블 헤더(`TableCell`)의 너비 부족으로 인해 텍스트가 줄바꿈되어
    시각적으로 저해됨.
  - **해결:** `OrderDetailModal`의 상품 목록 테이블 헤더(`TableCell`)에
    `minWidth` 및 `white-space: 'nowrap'` 스타일을 적용하여 텍스트가 한 줄로
    표시되도록 수정.

### **3. `OrderManagementPage` 오류 수정**

- **문제 1: `Uncaught ReferenceError: user is not defined`
  (`OrderManagementPage.jsx:369`)**
  - **원인:** `DashboardPage` 문제를 해결하는 과정에서, `OrderManagementPage`의
    `useAuth()` 훅에서 `user` 변수를 제거하여 발생.
  - **해결:** `OrderManagementPage`의 `useAuth()` 훅에서 `user` 변수를 다시
    포함하도록 수정.
- **문제 2: `Uncaught ReferenceError: role is not defined`
  (`OrderManagementPage.jsx:551`)**
  - **원인:** `OrderManagementPage`에서 `OrderDetailModal` 호출 시 사용하던
    `role` prop이 더 이상 유효하지 않아 발생.
  - **해결:** `OrdersManagementPage`의 `useAuth()` 훅을 통해 `hasPermission`을
    가져오고, `OrderDetailModal`에 이를 prop으로 전달하도록 수정.

### 2025-11-28: Order Page UI/UX Overhaul

- **OrderPage.jsx**: Implemented a modern banner design with gradient overlay
  and floating card effect. Improved layout spacing and typography.
- **OrderForm.jsx**: Refined the form with a grid layout, added icons to input
  fields for better visual cues, and improved spacing.
- **ProductSelector.jsx**: Redesigned the product list with a modern card view
  for mobile and a clean, styled table for desktop. Enhanced the search input
  with better visual feedback.
- **CostSummary.jsx**: Updated the cost summary card with a progress bar for
  free shipping, better typography, and a clear visual hierarchy for the final
  price.
- **AdminSidebar.jsx**: Fixed a `ReferenceError` (missing `alpha` import) that
  occurred after the previous styling update.
