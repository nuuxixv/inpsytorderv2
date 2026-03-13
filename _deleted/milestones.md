# 프로젝트 마일스톤 및 진행 상황

## 2025년 7월 19일

### 1. `/smartadmin` 경로 리다이렉션 및 라우팅 문제 해결
*   **문제:** `/smartadmin` 경로로 접속 시 "No routes matched location" 오류 발생.
*   **해결:** `src/App.jsx`에 `/smartadmin`을 `/admin`으로 리다이렉트하는 `Route` 추가.
*   **관련 오류:** `react-router-dom`의 `Navigate` 컴포넌트 임포트 누락, `/admin` 라우트의 JSX 닫는 태그 오류.
*   **해결:** `Navigate` 임포트 추가 및 `/admin` 라우트의 JSX 구조 수정 (`<Route path="/admin/*" ... />`).

### 2. 로그인 후 어드민 페이지 이동 문제 해결
*   **문제:** 로그인 후에도 로그인 페이지에 머무름.
*   **원인:** `ProtectedRoute` 컴포넌트가 `user` prop을 제대로 받지 못함.
*   **해결:** `src/App.jsx`에서 `ProtectedRoute`에 `useAuth()` 훅을 통해 가져온 `user` 객체를 `user` prop으로 전달.

### 3. `AdminHeader.jsx` `useState` 오류 해결
*   **문제:** `AdminHeader.jsx`에서 `useState` 사용 시 "useState is not defined" 오류 발생.
*   **원인:** `useState` 훅을 React에서 임포트하지 않음.
*   **해결:** `src/components/AdminHeader.jsx`에 `import React, { useState } from 'react';` 추가.

### 4. `/admin/products` 페이지 컬럼 불일치 및 UI 개선
*   **문제:** 제품 관리 페이지에서 DB 테이블의 모든 컬럼이 표시되지 않고, 컬럼명이 일치하지 않음.
*   **해결:**
    *   `src/components/ProductManagementPage.jsx`에서 `products` 테이블의 모든 컬럼(`id, product_code, category, sub_category, name, list_price, notes, is_discountable, created_at`)을 표시하도록 테이블 헤더 및 바디 수정.
    *   상품 추가/수정 모달에 `category`, `sub_category`, `notes`, `is_discountable` 필드 추가.
    *   `is_discountable` 필드를 체크박스로 처리하고, `handleChange` 함수에서 불리언 값을 올바르게 처리하도록 수정.
*   **관련 오류:** `<TableCell>` 닫는 태그 오류.
*   **해결:** `src/components/ProductManagementPage.jsx`에서 `<TableCell>` 태그를 올바르게 닫도록 수정.

### 5. `/admin/events` 페이지 기능 개선
*   **문제:** 학회 관리 페이지에 `start_date`, `end_date`, `order_url_slug` 컬럼 관리 기능 부재.
*   **해결:**
    *   `src/components/EventManagementPage.jsx`에서 `fetchEvents` 함수에 `start_date`, `end_date`, `order_url_slug` 컬럼을 포함하도록 수정.
    *   학회 추가/수정 모달에 `start_date`, `end_date` 입력 필드 추가 (type="date").
    *   학회 목록 테이블에 `시작일`, `종료일`, `고유 주소` 컬럼 추가.
    *   Supabase 실시간 구독을 `supabase.channel().on()` 방식으로 변경하여 데이터 변경 시 목록 자동 갱신.
*   **남은 문제:** Supabase `events` 테이블에 `order_url_slug`, `start_date`, `end_date` 컬럼이 수동으로 추가되어야 함. (현재 `order_url_slug` 컬럼 부재로 인한 "Error fetching events" 오류 발생 중)
*   **UI 개선:** 할인율 표시를 소수점에서 백분율(`15%`)로 변경하고, 입력 필드는 숨김 처리. "URL 슬러그"를 "고유 주소"로 변경 제안 (아직 미적용).

### 6. `/admin/orders` 페이지 주문 상세 모달 개선
*   **문제:** 주문 목록 클릭 시 모달이 열리지 않고 "handleRowClick is not defined" 오류 발생.
*   **해결:** `src/components/OrderManagementPage.jsx`에 `handleRowClick` 함수 정의.
*   **추가 개선 요청:** 모달에서 학회명, 총 금액, 상태를 보고 수정하며, 주문 상품 목록의 상품명과 금액 계산을 정확하게 표시.
*   **해결:**
    *   `OrderDetailModal` 컴포넌트에 `editedEventId`, `editedStatus` 상태 추가 및 `useEffect`로 초기화.
    *   모달 내에 학회명, 총 금액, 상태 표시 UI 추가 (편집 모드에서 학회명, 상태 수정 가능).
    *   주문 상품 목록에서 상품 ID 대신 실제 상품명 표시 및 정가, 할인가, 합계 정확히 계산하여 표시.
    *   `handleSave` 함수에서 `editedEventId`와 `currentStatus`를 Supabase에 업데이트하도록 수정.
*   **추가 요청:** 상태는 편집 버튼을 누르지 않아도 편집 가능해야 함.
*   **해결:** `OrderDetailModal`의 상태 `Select` 컴포넌트를 `isEditing` 조건 없이 항상 활성화되도록 수정.
*   **현재 문제:** 모달에서 학회명 수정 시 "주문 정보 업데이트 실패: Could not find the 'event_id' column of 'orders' in the schema cache" 오류 발생.
*   **원인 추정:** Supabase `orders` 테이블의 RLS 정책 문제 또는 스키마 캐시 문제.
*   **다음 단계:** RLS 정책 확인 및 필요 시 임시 비활성화 (개발 환경에서만).

---

### RLS (Row Level Security) 정책이란?

RLS (Row Level Security)는 데이터베이스 수준에서 특정 행(row)에 대한 접근을 제어하는 보안 기능입니다. 즉, 누가 어떤 데이터를 보고, 수정하고, 삭제할 수 있는지에 대한 규칙을 정의하는 것입니다.

Supabase는 PostgreSQL을 기반으로 하며, PostgreSQL의 RLS 기능을 활용합니다. RLS 정책은 테이블에 적용되며, 특정 조건이 충족될 때만 데이터 작업(SELECT, INSERT, UPDATE, DELETE)을 허용하거나 거부합니다.

**왜 필요한가요?**

*   **보안 강화:** 애플리케이션 코드에서 접근 제어를 구현하는 것보다 데이터베이스 수준에서 직접 제어함으로써 보안을 강화합니다.
*   **데이터 노출 방지:** 사용자가 자신의 데이터만 볼 수 있도록 하거나, 특정 역할(예: 관리자)만 민감한 데이터를 수정할 수 있도록 제한할 수 있습니다.

**어떻게 작동하나요?**

RLS 정책은 SQL 문법으로 작성되며, `USING`과 `WITH CHECK` 절을 사용합니다.

*   **`USING` 절:** `SELECT`, `UPDATE`, `DELETE` 작업 시 어떤 행에 접근할 수 있는지 정의합니다. 이 조건이 `true`인 행만 해당 작업이 허용됩니다.
*   **`WITH CHECK` 절:** `INSERT`와 `UPDATE` 작업 시 새로 삽입되거나 업데이트될 행이 이 조건을 만족하는지 확인합니다. 이 조건이 `true`인 경우에만 작업이 허용됩니다.

**예시 (`Master can update orders` 정책):**

```sql
ALTER POLICY "Master can update orders"
ON "public"."orders"
TO authenticated
USING (
  ((auth.jwt() ->> 'role'::text) = 'master'::text)
)
WITH CHECK (
  ((auth.jwt() ->> 'role'::text) = 'master'::text)
);
```

이 정책은 다음과 같이 해석됩니다:

*   **`ON "public"."orders"`:** `orders` 테이블에 적용됩니다.
*   **`TO authenticated`:** `authenticated` 역할을 가진 사용자에게 적용됩니다. (즉, 로그인된 모든 사용자)
*   **`USING ((auth.jwt() ->> 'role'::text) = 'master'::text)`:** `orders` 테이블의 행을 `SELECT`, `UPDATE`, `DELETE`할 때, 사용자의 JWT 토큰에 있는 `role` 클레임이 `'master'`인 경우에만 해당 작업을 허용합니다.
*   **`WITH CHECK ((auth.jwt() ->> 'role'::text) = 'master'::text)`:** `orders` 테이블에 새 행을 `INSERT`하거나 기존 행을 `UPDATE`할 때, 사용자의 JWT 토큰에 있는 `role` 클레임이 `'master'`인 경우에만 해당 작업을 허용합니다.

**현재 문제와의 연관성:**

"Could not find the 'event_id' column of 'orders' in the schema cache" 오류는 Supabase가 `event_id` 컬럼을 찾지 못했다는 메시지이지만, 실제로는 RLS 정책 때문에 업데이트 쿼리가 데이터베이스에 도달하지 못하고 Supabase 내부에서 차단되었을 가능성이 높습니다. 즉, `master` 역할이 아닌 사용자가 `event_id`를 포함한 `orders` 테이블을 업데이트하려고 시도했기 때문에 정책에 의해 거부되었고, 이 과정에서 Supabase가 컬럼 관련 오류 메시지를 반환한 것으로 추정됩니다.

**해결을 위한 다음 단계:**

RLS 정책을 이해하셨으니, 다시 한번 Supabase 대시보드에서 `orders` 테이블의 RLS 정책을 확인해 주시겠어요?

1.  **Supabase 대시보드 로그인**
2.  **"Database" -> "Tables" -> `orders` 테이블 선택**
3.  **"Policies" 탭 클릭**
4.  `Master can update orders` 정책을 찾습니다.
5.  **정책을 임시로 비활성화하거나, `USING`과 `WITH CHECK` 절을 `true`로 변경하여 모든 `authenticated` 사용자가 업데이트할 수 있도록 변경**합니다. (예: `USING (true) WITH CHECK (true)`)
    *   **주의:** 이 변경은 보안에 취약하므로, 테스트 목적으로만 사용하고 문제가 해결되면 원래대로 복구하거나 더 적절한 정책을 설정해야 합니다.

이 조치 후에 다시 모달에서 학회명 수정을 시도해 보시고 결과를 알려주세요.

## 2025년 7월 23일

### 7. URL 쿼리 파라미터를 이용한 학회별 주문 관리 구현
*   **기능:** URL 쿼리 파라미터 `?events=학회슬러그`를 통해 특정 학회 전용 주문 페이지를 제공하고, 해당 학회 정보를 주문 데이터에 연결.
*   **세부 구현:**
    *   `src/components/OrderPage.jsx`에서 `react-router-dom`의 `useSearchParams` 훅을 사용하여 `events` 쿼리 파라미터 값을 읽음.
    *   읽어온 학회 슬러그를 기반으로 Supabase `events` 테이블에서 해당 학회의 `id`와 `discount_rate`를 조회.
    *   조회된 `discount_rate`를 주문 금액 계산(`CostSummary.jsx` 포함)에 동적으로 적용.
    *   주문 생성 시 조회된 `event_id`를 `orders` 테이블에 저장하도록 `OrderPage.jsx` 로직 수정.
*   **학회 선택 팝업:**
    *   `events` 쿼리 파라미터가 없거나 유효하지 않은 경우, 사용자에게 학회를 선택하도록 유도하는 팝업(`Dialog`) 구현.
    *   팝업에 표시되는 학회 목록은 `start_date`와 `end_date`가 오늘 날짜 범위에 해당하는 학회만 필터링하여 표시.

### 8. Supabase Edge Function을 통한 안전한 주문 처리 시스템 구축
*   **문제점:** 기존 클라이언트 측 직접 삽입 방식은 RLS 정책으로 인한 오류 발생 및 보안 취약점 존재.
*   **해결:** `create-order` Supabase Edge Function을 도입하여 서버 측에서 주문 생성 로직 처리.
*   **세부 구현:**
    *   `supabase/functions/create-order/index.ts`에 `create-order` Edge Function 생성 및 배포.
    *   Edge Function은 클라이언트로부터 받은 주문 데이터를 기반으로 `products` 및 `events` 테이블에서 실제 가격 및 할인율을 조회하여 주문 금액을 서버에서 재계산.
    *   `orders` 및 `order_items` 테이블에 데이터를 하나의 트랜잭션으로 안전하게 삽입.
    *   `src/components/OrderPage.jsx`의 `handleSubmitOrder` 함수를 수정하여 직접 Supabase 테이블에 삽입하는 대신 `create-order` Edge Function을 호출하도록 변경.
    *   `orders` 및 `order_items` 테이블의 RLS 정책을 `service_role`만 `INSERT`를 허용하도록 조정하여 보안 강화.
    *   Edge Function 내부에 CORS 헤더(`Access-Control-Allow-Origin`, `Access-Control-Allow-Headers`)를 추가하여 `OPTIONS` preflight 요청 및 실제 요청에 대한 CORS 오류 해결.

---

## 2025년 8월 1일

### 9. 관리자 패널 기능 개선
*   **학회 관리:**
    *   학회명 입력 시 `order_url_slug`가 자동으로 생성되고, 형식 및 중복 유효성을 검사하는 기능 추가.
    *   페이지 간 UI 일관성을 위해 날짜 선택기(DatePicker)를 주문 관리 페이지와 동일한 스타일(기본 HTML Date Input)로 통일.
*   **주문 관리:**
    *   대량의 주문 데이터를 효율적으로 처리하기 위해 페이지네이션(Pagination) 기능 구현.
    *   엑셀 다운로드 시, 현재 필터링된 모든 주문 내역을 다운로드하도록 기능 개선.

### 10. 알림 시스템 개선
*   관리자 페이지에 새로운 주문이 접수되면 실시간으로 화면 하단에 알림(Snackbar)이 표시되도록 구현.
*   고객에게 발송되는 주문 확인 이메일에 '학회명' 정보를 추가하여 어떤 학회 관련 주문인지 명확히 함.

### 11. 테스트 및 배포 자동화 (CI/CD)
*   **테스트:** `Vitest`와 `React Testing Library`를 도입하여 프론트엔드 테스트 환경을 구축하고, `DashboardPage`에 대한 샘플 테스트 코드 작성 완료.
*   **CI/CD:**
    *   Vercel 배포 시 `npm test`가 자동으로 실행되도록 `package.json`의 `build` 스크립트 수정.
    *   `main` 브랜치에 `supabase/functions` 관련 변경사항이 푸시될 때마다 자동으로 Supabase Edge Function을 배포하는 GitHub Actions 워크플로우 설정.

### 12. 버그 수정 및 안정화
*   `EventManagementPage.jsx`에서 `useNotification` 훅 중복 선언 및 `DatePicker` 라이브러리 설정 오류로 인해 페이지가 로딩되지 않던 문제 해결.
*   `orders` 테이블 RLS 정책 문제로 인해 주문 목록이 보이지 않고 상태 변경이 되지 않던 문제 해결 (RLS 정책 재설정).
*   `OrderDetailModal.jsx`에서 주문 상태 변경은 '편집' 버튼 없이 상시 가능하도록 수정.
*   `update-order` Edge Function의 `order_items` 업데이트 버그 수정.
*   `OrderDetailModal` 내 `Select` 컴포넌트의 `out-of-range value` 오류 해결 시도 (productsMap 키 변경, MenuItem value 변경).

---

## 앞으로의 개발 제안 사항

### 1. 관리자 패널 기능 개선
*   **학회 관리:**
    *   학회명 기반 `order_url_slug` 자동 생성 기능 (수동 편집 옵션 포함).
    *   `order_url_slug`의 유니크함 및 형식(소문자, 하이픈만 허용 등) 유효성 검사 강화.
    *   `start_date`, `end_date` 입력 필드에 사용자 친화적인 캘린더 컴포넌트 도입.
*   **주문 관리:**
    *   고객명, 이메일, 학회, 상태 등 다양한 조건으로 주문 검색/필터링 기능 구현.
    *   대량 데이터 처리를 위한 주문 목록 페이지네이션(Pagination) 기능 추가.
    *   주문 데이터 CSV 내보내기 기능 구현.
    *   (선택 사항) 고객용 주문 내역 조회 페이지 구현 (고객 인증 시스템 필요).
*   **상품 관리:**
    *   상품 이미지 업로드 및 관리 기능 추가.
    *   재고 관리 기능 구현.

### 2. 알림 시스템 개선
*   관리자 패널에 새로운 주문 발생 시 실시간 알림 기능 추가.
*   주문 확인 및 상태 업데이트를 위한 이메일 템플릿 개선.

### 3. 테스트 프레임워크 통합
*   React 컴포넌트(Vitest/React Testing Library 활용) 및 Edge Function에 대한 단위 및 통합 테스트 코드 작성.

### 4. 배포 자동화 (CI/CD)
*   프론트엔드(Vercel 등) 및 백엔드/함수(Supabase)에 대한 자동화된 테스트 및 배포 파이프라인 구축.

### 5. 오류 처리 및 로깅 강화
*   클라이언트 및 서버 측 오류 로깅 시스템 개선을 통한 디버깅 및 모니터링 효율 증대.
*   사용자에게 더 명확하고 친절한 오류 메시지 제공.

### 6. UI/UX 개선
*   전반적인 사용자 인터페이스 및 경험의 일관성 및 사용 편의성 검토 및 개선.
*   다양한 화면 크기에 대응하는 반응형 디자인 구현.