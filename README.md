# Inpsyt Order V2

의료 학회 현장 도서/검사 판매 전용 주문 관리 시스템.
고객용 모바일 주문서 + 관리자 어드민을 함께 제공합니다.

## 주요 기능

### 고객 화면
- 학회별 전용 주문 페이지 (QR 또는 링크 진입)
- 상품 검색/필터/장바구니 → 배송 정보 입력 → 주문 확인/제출 (3단계)
- 토큰 기반 주문 조회 (카카오 알림톡 발송)

### 관리자 어드민
- **대시보드**: KPI, 매출 분석, YoY 비교, 실시간 주문 알림
- **주문 관리**: 조회/편집/상태 변경/일괄 처리/엑셀 다운로드/연계 주문(합배송)
- **학회 관리**: 행사 CRUD, QR SVG 생성/다운로드, URL 복사
- **상품 관리**: CRUD, 엑셀 업로드(진행률 바/에러 보고), 일괄편집
- **출고 현황**: 결제완료 주문 뷰, 배송지 클릭 복사, 인싸이트 ID 복사
- **사용자 관리**: 계정 CRUD, 역할 템플릿 매트릭스 UI
- **설정**: 배송비 정책, 리다이렉트 학회(QR용)
- **피드백**: 관리자 피드백 수집/상태 관리
- **게시판**: 매뉴얼/패치노트/공지사항, 마크다운 서식, 읽음 추적

### 백엔드
- Supabase Auth (RBAC, 역할 템플릿)
- RLS (Row Level Security)
- Edge Functions (주문 생성, 사용자 관리, 알림톡, 상품 업로드)
- 주문 시점 상품 정보 박제 (스냅샷)

## 기술 스택

| 영역 | 기술 |
|------|------|
| 프론트엔드 | React 19, Vite 7, MUI 7, React Router |
| 백엔드 | Supabase (PostgreSQL, Auth, Realtime, Edge Functions) |
| 배포 | Vercel (Analytics, Speed Insights) |
| 개발 도구 | ESLint, Vitest |

## 저장소 구조

```
.
├─ inpsyt-order-frontend/     # 프론트엔드 앱
│  └─ src/
│     ├─ api/                  # Supabase 쿼리 모듈
│     ├─ components/           # 페이지 및 UI 컴포넌트
│     ├─ hooks/                # useAuth, useNotification
│     ├─ constants/            # 주문 상태 등 상수
│     └─ AuthContext.jsx       # 인증/RBAC 컨텍스트
├─ supabase/
│  ├─ functions/               # Edge Functions
│  └─ migrations/              # DB 마이그레이션
├─ DOCS/                       # 프로젝트 문서, 로드맵, 온보딩 가이드
└─ README.md
```

## 주요 라우트

| 경로 | 설명 |
|------|------|
| `/order?events=<slug>` | 고객 주문 페이지 |
| `/order/status/:token` | 주문 조회 페이지 |
| `/go` | QR 리다이렉트 (활성 학회로 이동) |
| `/login` | 어드민 로그인 |
| `/admin/*` | 어드민 페이지 |

## 환경 변수

`inpsyt-order-frontend/.env.local`:

```env
VITE_SUPABASE_URL=https://<project>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon-key>
VITE_SUPABASE_FUNCTIONS_URL=https://<project>.supabase.co/functions/v1
VITE_ONESHOT_CALLBACK=<callback-number>
VITE_APP_URL=<public-app-url>
```

## 시작하기

```bash
# 루트 의존성 (Supabase CLI)
npm install

# 프론트엔드 의존성
cd inpsyt-order-frontend && npm install

# 개발 서버
npm run dev

# 빌드
npm run build

# 테스트
npm test
```

## 문서

- [개발 로드맵](DOCS/ROADMAP.md)
- [고객 주문 안내서](DOCS/ONBOARDING_고객안내.md)
- [내부 운영 가이드](DOCS/ONBOARDING_내부운영.md)
