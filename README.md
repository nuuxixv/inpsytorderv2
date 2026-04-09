# Inpsyt Order V2

Inpsyt Order V2는 학회 현장 주문 운영을 위한 고객용 주문 화면과 관리자 어드민을 함께 제공하는 서비스입니다.  
이 문서는 외부 공개용 README로, 프로젝트의 구조와 실행 방법을 빠르게 이해할 수 있도록 정리한 안내서입니다.

## 프로젝트 개요

이 저장소는 다음 요소로 구성됩니다.

- 고객 주문용 프론트엔드
- 관리자 운영용 어드민
- Supabase 기반 백엔드, 데이터베이스, 인증, 권한 제어
- Edge Function, 마이그레이션, 유지보수 문서

이 서비스는 일반적인 범용 커머스 플랫폼보다는, 짧은 기간의 행사/학회 운영에 맞춘 주문 시스템에 가깝습니다.

## 주요 기능

### 고객 화면

- 학회 행사별 주문 페이지 진입
- 상품 검색 / 필터 / 장바구니
- 고객 정보 입력 및 주문 접수
- 토큰 기반 주문 조회 페이지 (알림톡 발송)

### 관리자 어드민

- 주문 조회, 수정, 상태 변경
- 상품 관리
- 학회 행사 관리
- 관리자 초대 및 권한 관리
- 배송비 / 무료배송 기준 등 운영 정책 관리

### 백엔드 기능

- Supabase Auth 기반 로그인
- RLS 및 RBAC 기반 권한 제어
- 주문 생성 / 사용자 관리 / 알림톡 / 상품 업로드용 Edge Function

## 기술 스택

### 프론트엔드

- React 19
- Vite
- MUI
- React Router
- Supabase JS

### 백엔드

- Supabase
- PostgreSQL
- Row Level Security
- Edge Functions

### 개발 도구

- ESLint
- Vitest

## 저장소 구조

```text
.
├─ inpsyt-order-frontend/     # 프론트엔드 앱
├─ supabase/
│  ├─ functions/              # Edge Functions
│  ├─ migrations/             # 데이터베이스 마이그레이션
│  └─ config.toml             # 로컬 Supabase 설정
├─ DOCS/                      # 프로젝트 문서
├─ package.json               # 루트: Supabase CLI 용도
└─ README.md
```

## 주요 라우트

- `/` 또는 `/order` : 고객 주문 페이지
- `/order/status/:token` : 주문 조회 페이지
  
## 환경 변수

`inpsyt-order-frontend/.env.local` 파일을 생성하고 아래 값을 설정합니다.

```env
VITE_SUPABASE_URL=https://<your-project>.supabase.co
VITE_SUPABASE_ANON_KEY=<your-anon-key>
VITE_SUPABASE_FUNCTIONS_URL=https://<your-project>.supabase.co/functions/v1
VITE_ONESHOT_CALLBACK=<callback-number>
VITE_APP_URL=<public-app-url>
```

## 시작하기

### 1. 의존성 설치

루트에서 Supabase CLI 관련 의존성을 설치합니다.

```bash
npm install
```

프론트엔드 의존성을 설치합니다.

```bash
cd inpsyt-order-frontend
npm install
```

### 2. 프론트엔드 실행

```bash
cd inpsyt-order-frontend
npm run dev
```

### 3. 빌드

```bash
cd inpsyt-order-frontend
npm run build
```

### 4. 린트

```bash
cd inpsyt-order-frontend
npm run lint
```

### 5. 테스트

```bash
cd inpsyt-order-frontend
npm test
```

## Supabase 로컬 개발

일반적인 로컬 개발 흐름은 아래와 같습니다.

```bash
supabase start
supabase db reset
supabase functions serve
```

로컬 개발 전에는 아래 내용을 먼저 확인하는 것이 좋습니다.

- 어떤 Supabase 프로젝트를 기준으로 작업하는지
- 어떤 마이그레이션까지 적용되어야 하는지
- 어떤 Edge Function secret이 필요한지

## 배포 메모

- 프론트엔드는 Vercel 배포를 기준으로 사용합니다.
- Vercel의 Root Directory는 `inpsyt-order-frontend` 이어야 합니다.
- 일반적인 Build Command는 `vite build` 입니다.

## 참고 문서

- 본 서비스 개발에는 Claude Code, Gemini, Codex의 든든한 지원이 있었습니다.
- 또한 gstack skills를 활용해 더 높은 완성도를 추구했습니다. 
- 어드민에서는 UXUI, 오류에 대한 리포트를 할 수 있는 창구가 있습니다.