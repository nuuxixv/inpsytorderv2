# Code Review Report — inpsyt-order-frontend

**작성일**: 2026-03-19
**리뷰 대상**: `inpsyt-order-frontend/src/`
**스택**: React 19 + Vite 7 + MUI 7 + Supabase
**규모**: ~35 files, ~6,800 LOC

---

## 요약 대시보드

| 등급 | 항목 수 | 설명 |
|------|---------|------|
| 🔴 P0 Critical | 1 | 즉시 수정 필요한 런타임 버그 |
| 🟠 P1 Architecture | 2 | 구조적 문제, 예측 불가능한 버그 유발 가능 |
| 🟡 P2 Quality | 6 | 번들 사이즈, 코드 품질, 프로덕션 노출 |
| 🟢 P3 Minor | 5 | 장기적 개선 권장 사항 |
| ✅ Good Practices | 5 | 잘 구현된 부분 |

---

## 우선순위 액션 플랜

| 우선순위 | 항목 | 예상 공수 |
|---------|------|---------|
| P0 | DashboardPage `addNotification` 버그 수정 | 5분 |
| P1 | `main.jsx` 이중 Provider 정리 | 15분 |
| P1 | `statusToKorean` / `statusColors` 상수 파일 추출 | 30분 |
| P2 | 미사용 npm 패키지 제거 (6개) | 10분 |
| P2 | 미사용 import 정리 (2개 파일) | 10분 |
| P2 | `console.log` 프로덕션 노출 수정 | 5분 |
| P3 | Error Boundary 추가 | 1시간 |
| P3 | 테스트 커버리지 확대 | 지속적 |

---

## 🔴 P0 — Critical Bugs (즉시 수정)

### 1. DashboardPage.jsx — `addNotification` 타입 오류

**파일**: `src/components/DashboardPage.jsx`, line 383

**문제**

`useNotification()` hook은 `{ notifications, addNotification, removeNotification }` 객체를 반환한다. 그러나 현재 코드는 반환값 전체를 `addNotification` 변수에 할당하고, 이를 `OrderDetailModal`에 함수 prop으로 전달한다. `OrderDetailModal` 내부에서 `addNotification('message', 'severity')`를 호출할 때 **객체를 함수처럼 호출**하게 되어 런타임 오류가 발생한다.

**증상**: 주문 수정 저장 시 알림이 표시되지 않으며 콘솔에 `TypeError: addNotification is not a function` 출력

**Before (버그)**

```jsx
// DashboardPage.jsx line 383
const addNotification = useNotification(); // 객체 전체를 할당
```

**After (수정)**

```jsx
const { addNotification } = useNotification(); // 구조 분해로 함수만 추출
```

---

## 🟠 P1 — Architecture Issues (이번 스프린트 내 수정)

### 2. 이중 Provider 래핑 (main.jsx + App.jsx)

**파일**: `src/main.jsx`, `src/App.jsx`

**문제**

`main.jsx`와 `App.jsx` 양쪽에서 동일한 Provider를 중복으로 래핑하고 있다. 실제 렌더링되는 Provider 트리는 다음과 같다.

```
ThemeProvider (main.jsx)
  └── AuthProvider (main.jsx)
        └── App
              └── ThemeProvider (App.jsx)  ← 중복
                    └── AuthProvider (App.jsx)  ← 중복
                          └── NotificationProvider
                                └── AppRoutes
```

내부 `ThemeProvider`가 외부 `ThemeProvider`를 덮어쓰게 되며, `AuthProvider`가 두 번 마운트되어 Context가 분리된다. 컴포넌트가 어느 Context를 구독하는지에 따라 **예측 불가능한 인증 상태 버그**가 발생할 수 있다.

**Before (버그)**

```jsx
// main.jsx
root.render(
  <ThemeProvider theme={theme}>
    <CssBaseline />
    <AuthProvider>
      <App />
    </AuthProvider>
  </ThemeProvider>
);

// App.jsx
export default function App() {
  return (
    <ThemeProvider theme={theme}>  {/* 중복 */}
      <CssBaseline />              {/* 중복 */}
      <AuthProvider>               {/* 중복 */}
        <NotificationProvider>
          <AppRoutes />
        </NotificationProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
```

**After (수정)**

```jsx
// main.jsx — 모든 전역 Provider를 여기에 통합
root.render(
  <ThemeProvider theme={theme}>
    <CssBaseline />
    <AuthProvider>
      <NotificationProvider>
        <App />
      </NotificationProvider>
    </AuthProvider>
  </ThemeProvider>
);

// App.jsx — Provider 없이 라우팅만 담당
export default function App() {
  return <AppRoutes />;
}
```

---

### 3. `statusToKorean` / `statusColors` 중복 정의

**파일**: `src/components/DashboardPage.jsx`, `src/components/OrderManagementPage.jsx`, `src/components/FulfillmentPage.jsx`

**문제**

동일한 주문 상태 매핑 객체가 3개 파일에 각각 하드코딩되어 있다. 상태명을 추가하거나 색상을 변경할 때 **3개 파일을 모두 수정**해야 하며, 누락 시 파일 간 불일치가 발생한다.

**Before (3개 파일에 동일 코드 반복)**

```jsx
// DashboardPage.jsx, OrderManagementPage.jsx, FulfillmentPage.jsx 각각에 존재
const statusToKorean = {
  pending: '대기 중',
  confirmed: '확인됨',
  processing: '처리 중',
  shipped: '발송됨',
  delivered: '배달됨',
  cancelled: '취소됨',
};

const statusColors = {
  pending: 'warning',
  confirmed: 'info',
  processing: 'primary',
  shipped: 'secondary',
  delivered: 'success',
  cancelled: 'error',
};
```

**After (단일 공유 상수 파일)**

```js
// src/constants/orderStatus.js (새 파일)
export const STATUS_TO_KOREAN = {
  pending: '대기 중',
  confirmed: '확인됨',
  processing: '처리 중',
  shipped: '발송됨',
  delivered: '배달됨',
  cancelled: '취소됨',
};

export const STATUS_COLORS = {
  pending: 'warning',
  confirmed: 'info',
  processing: 'primary',
  shipped: 'secondary',
  delivered: 'success',
  cancelled: 'error',
};
```

```jsx
// 각 컴포넌트에서 import
import { STATUS_TO_KOREAN, STATUS_COLORS } from '../constants/orderStatus';
```

---

## 🟡 P2 — Code Quality (다음 스프린트 내 수정)

### 4. 미사용 npm 패키지 — 번들 사이즈 낭비

**파일**: `package.json`

**문제**

`package.json`에 선언되어 있지만 소스 코드 어디서도 import되지 않는 패키지가 6개 발견되었다. 이 패키지들은 `node_modules` 용량을 늘리고, 일부는 번들에 포함될 수 있다.

| 패키지 | 상태 | 비고 |
|-------|------|------|
| `dayjs` | 미사용 | `date-fns`로 통일됨 |
| `recharts` | 미사용 | 차트 기능 미구현 |
| `lucide-react` | 미사용 | MUI Icons로 통일됨 |
| `@mui/x-date-pickers` | 미사용 | — |
| `tslib` | 미사용 | TypeScript 미사용 프로젝트 |
| `react-date-range` | CSS만 import | 컴포넌트 사용 없음 |

**예상 번들 절감**: ~400KB+ (gzip 전)

**수정 명령**

```bash
npm uninstall dayjs recharts lucide-react @mui/x-date-pickers tslib react-date-range
```

---

### 5. 미사용 Import — 파일별

#### DashboardPage.jsx

```jsx
// 제거 대상
import EmojiEvents as TrophyIcon from '@mui/icons-material/EmojiEvents'; // 사용 없음
import Save as SaveIcon from '@mui/icons-material/Save';                   // 사용 없음
import { subYears, endOfToday } from 'date-fns';                          // 사용 없음
import { Grid } from '@mui/material';                                       // Box flexbox로 교체됐으나 잔존
```

#### OrderManagementPage.jsx

```jsx
// 제거 대상
import { Skeleton } from '@mui/material'; // TableSkeleton 컴포넌트로 대체됨
```

**확인 방법**: ESLint `no-unused-vars` 규칙을 활성화하면 CI에서 자동으로 감지할 수 있다.

---

### 6. `console.log` 프로덕션 노출

**파일**: `src/components/AdminLayout.jsx`, line 41

**문제**

Supabase Realtime 콜백 내의 `console.log`가 프로덕션 환경에서 **실제 주문 데이터(payload)를 브라우저 콘솔에 노출**한다. 브라우저 DevTools에 접근 가능한 누구든 신규 주문 내용을 볼 수 있다.

**Before (프로덕션 데이터 노출)**

```js
// AdminLayout.jsx line 41
console.log('New order received:', payload); // payload에 주문 정보 포함
```

**After (개발 환경에서만 출력)**

```js
if (import.meta.env.DEV) {
  console.log('New order received:', payload);
}
```

---

### 7. `console.error` 남발 — 에러 트래킹 부재

**파일**: 전체 소스 파일 (23개 파일, 다수의 catch 블록)

**문제**

모든 `try/catch` 블록이 `console.error`로만 에러를 처리한다. 프로덕션에서 발생하는 에러가 **개발팀에 전달되지 않으며**, 콘솔 로그도 민감한 에러 메시지를 노출할 수 있다.

**현재 패턴 (전체 코드에서 반복)**

```js
try {
  await someApiCall();
} catch (error) {
  console.error('Failed to load data:', error); // 프로덕션에서 노출, 팀에 미전달
}
```

**권장 방향**

```js
// 단기: 에러 심각도에 따라 분기
try {
  await someApiCall();
} catch (error) {
  if (import.meta.env.DEV) console.error('Failed to load data:', error);
  addNotification('데이터를 불러오는 데 실패했습니다.', 'error');
}

// 장기: Sentry 등 에러 트래킹 서비스 도입
import * as Sentry from '@sentry/react';

try {
  await someApiCall();
} catch (error) {
  Sentry.captureException(error);
  addNotification('데이터를 불러오는 데 실패했습니다.', 'error');
}
```

---

### 8. DashboardPage.jsx 파일 크기 (750+ 줄)

**파일**: `src/components/DashboardPage.jsx`

**문제**

단일 파일에 5개의 내부 컴포넌트와 메인 컴포넌트가 혼재한다. 파일 크기가 750줄을 초과하여 가독성, 유지보수성, 테스트 작성이 어렵다.

**식별된 분리 가능 컴포넌트**

```
DashboardPage.jsx (750+ 줄)
├── FieldReportSection    → src/components/dashboard/FieldReportSection.jsx
├── AuditLogSection       → src/components/dashboard/AuditLogSection.jsx
├── StatsCard             → src/components/dashboard/StatsCard.jsx
└── (기타 내부 컴포넌트)
```

**권장 디렉토리 구조**

```
src/components/
├── dashboard/
│   ├── FieldReportSection.jsx
│   ├── AuditLogSection.jsx
│   └── StatsCard.jsx
└── DashboardPage.jsx  (메인 페이지 레이아웃만, ~200줄 목표)
```

---

### 9. OrderManagementPage.jsx reducer 복잡도 (150+ 줄)

**파일**: `src/components/OrderManagementPage.jsx`

**문제**

20개 이상의 action type을 단일 `reducer` 함수가 처리하며, 그 중 상당수가 `newOrder` 폼 상태 관리와 관련되어 있다. Reducer 길이가 150줄을 초과하여 로직 파악이 어렵다.

**권장 방향**

```jsx
// Before: 모든 상태를 단일 reducer로 관리
const reducer = (state, action) => {
  switch (action.type) {
    case 'SET_ORDERS': ...
    case 'SET_NEW_ORDER_PRODUCT': ...
    case 'SET_NEW_ORDER_CUSTOMER': ...
    // 20+ cases
  }
};

// After: 관심사 분리
// 1. 주문 목록 상태 → 기존 reducer 유지 (간소화)
// 2. 신규 주문 폼 상태 → 별도 useReducer 또는 React Hook Form으로 분리
import { useForm } from 'react-hook-form';

const { register, handleSubmit, reset } = useForm({
  defaultValues: { product: '', customer: '', quantity: 1 }
});
```

---

## 🟢 P3 — Minor Issues (백로그 관리)

### 10. `react-date-range` CSS 불필요 import

**파일**: `src/main.jsx`

```jsx
// main.jsx — 컴포넌트 미사용인데 CSS 번들에 포함됨
import 'react-date-range/dist/styles.css';
import 'react-date-range/dist/theme/default.css';
```

패키지 제거(항목 4 참조) 시 이 import도 함께 제거된다.

---

### 11. 레거시 라우트 주석 미흡

**파일**: `src/App.jsx`

```jsx
// 현재 — 의도 불명
<Route path="/smartadmin" element={<Navigate to="/admin" />} />

// 권장 — 하위 호환 목적임을 명시
{/* 레거시 URL 하위 호환: 구 관리자 URL을 신규 경로로 리다이렉트 (2025-xx 이후 제거 검토) */}
<Route path="/smartadmin" element={<Navigate to="/admin" />} />
```

---

### 12. 테스트 커버리지 부족

**현황**: 프로젝트 전체에 테스트 파일 3개만 존재. 핵심 비즈니스 로직에 대한 테스트 없음.

**테스트 미작성 영역**

```
src/api/orders.js       — Supabase 쿼리 함수 (단위 테스트 없음)
src/api/products.js     — Supabase 쿼리 함수 (단위 테스트 없음)
src/api/events.js       — Supabase 쿼리 함수 (단위 테스트 없음)
src/context/AuthContext — 인증 상태 전환 (통합 테스트 없음)
주문 상태 전환 로직     — 비즈니스 규칙 (단위 테스트 없음)
```

**권장 우선순위**

1. `src/api/*.js` — Supabase 클라이언트 mock 후 단위 테스트
2. `AuthContext` — 로그인/로그아웃 상태 전환 통합 테스트
3. `orderStatus.js` 상수 추출 후 상태 변환 함수 단위 테스트

---

### 13. 접근성(Accessibility) — `aria-label` 누락

**현황**: 대부분의 `IconButton`에 `aria-label`이 없어 스크린 리더가 버튼 용도를 식별할 수 없다. 현재는 관리자 전용 앱이므로 우선순위는 낮지만, 향후 접근성 요구사항 충족을 위해 점진적으로 추가를 권장한다.

```jsx
// Before
<IconButton onClick={handleEdit}>
  <EditIcon />
</IconButton>

// After
<IconButton onClick={handleEdit} aria-label="주문 수정">
  <EditIcon />
</IconButton>
```

---

### 14. Error Boundary 없음

**현황**: 컴포넌트 렌더링 중 uncaught 에러 발생 시 앱 전체가 빈 화면으로 크래시된다. 사용자는 오류 원인을 알 수 없다.

**권장 구현**

```jsx
// src/components/ErrorBoundary.jsx (신규)
import { Component } from 'react';

class ErrorBoundary extends Component {
  state = { hasError: false, error: null };

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    // Sentry.captureException(error, { extra: info });
    if (import.meta.env.DEV) console.error(error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <Box sx={{ p: 4, textAlign: 'center' }}>
          <Typography variant="h6">페이지를 불러오는 중 오류가 발생했습니다.</Typography>
          <Button onClick={() => window.location.reload()}>새로고침</Button>
        </Box>
      );
    }
    return this.props.children;
  }
}

// AdminLayout.jsx에서 적용
<ErrorBoundary>
  <Outlet />
</ErrorBoundary>
```

---

## ✅ 잘 구현된 부분 (Good Practices)

### 15. 권한 시스템 일관성

`hasPermission()` 헬퍼를 통한 일관된 접근 제어가 구현되어 있다. 라우트 레벨(ProtectedRoute)과 UI 레벨(버튼 표시 여부) 양쪽에서 이중으로 방어하고 있어 권한 우회 가능성이 낮다.

### 16. API 레이어 분리

`src/api/` 디렉토리에 Supabase 쿼리가 격리되어 있다. 컴포넌트에서 직접 Supabase를 호출하는 케이스가 최소화되어 있어, 향후 백엔드 교체나 mock 작성이 용이한 구조다.

### 17. 반응형 디자인

MUI breakpoint 시스템과 `SwipeableDrawer`를 활용하여 데스크톱/모바일 양쪽에서 일관된 UX를 제공한다.

### 18. 실시간 업데이트

Supabase Realtime 구독을 통해 신규 주문 발생 시 관리자에게 즉시 알림을 전달하는 기능이 구현되어 있다. 폴링 방식 대비 서버 부하가 낮고 반응성이 높다.

### 19. `useReducer` 패턴 적용

`OrderManagementPage`의 복잡한 다단계 폼 상태를 `useReducer`로 체계적으로 관리하고 있다. 단순 `useState` 남발 대비 상태 전환 추적이 명확하다. (다만 action 수가 늘어남에 따라 분리가 필요한 시점에 도달했음 — 항목 9 참조)

---

## 체크리스트 요약

```
[ ] P0: DashboardPage.jsx line 383 — const { addNotification } = useNotification();
[ ] P1: main.jsx 이중 Provider 제거
[ ] P1: src/constants/orderStatus.js 생성 및 3개 파일에서 import로 교체
[ ] P2: npm uninstall dayjs recharts lucide-react @mui/x-date-pickers tslib react-date-range
[ ] P2: DashboardPage.jsx 미사용 import 4개 제거
[ ] P2: OrderManagementPage.jsx Skeleton import 제거
[ ] P2: AdminLayout.jsx line 41 console.log → DEV 조건부 처리
[ ] P3: ErrorBoundary 컴포넌트 생성 및 AdminLayout에 적용
[ ] P3: /smartadmin 레거시 라우트에 주석 추가
[ ] P3: API 함수 단위 테스트 작성 시작
```

---

*이 문서는 2026-03-19 기준 소스 코드 정적 분석을 바탕으로 작성되었습니다.*
