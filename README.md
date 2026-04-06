# Inpsyt Order V3

이 프로젝트는 기관 및 B2B 고객을 위한 심리검사/교구 모바일 주문 시스템(V2/V3)입니다.
기존 서면 수기 주문과 복잡했던 파편화된 주문 과정을 디지털화하고, 관리자 어드민 및 데이터베이스 연동을 통해 현장 오퍼레이션을 혁신하기 위해 구축되었습니다.

## 📌 프로젝트 개요

*   **목적**: 오프라인 학회, 행사 및 기관 주문의 모바일/웹 디지털 전환
*   **주요 기능**:
    *   사용자(회원) 로그인 및 권한별(master, edit, view 등) RBAC 분기
    *   동적 배송비 및 관리자 설정 (`site_settings`) 실시간 연동
    *   상품(Products), 행사(Events), 주문(Orders) 관리 및 무한 스크롤 탐색
    *   모바일 환경에 최적화된 라운지 UX (장바구니 뷰, 다단계 주문 플로우)
    *   Supabase Edge Functions 기반의 안전한 DB 및 권한 조작

## 🛠️ 기술 스택 (Tech Stack)

### Frontend
*   **프레임워크**: React (Vite)
*   **패키지 매니저**: npm
*   **주요 라이브러리**: `@supabase/supabase-js`, `lucide-react` (아이콘)

### Backend & Database
*   **BaaS**: Supabase
*   **데이터베이스**: PostgreSQL
*   **보안**: Row Level Security (RLS) 및 커스텀 RBAC(Role-Based Access Control) 정책
*   **기타**: Supabase Edge Functions (Deno/TypeScript)

## 📁 폴더 및 문서 구조

루트 디렉토리에 산재해 있던 관련 마크다운 파일들은 문맥 유지를 위해 `DOCS/` 로 아카이브되었습니다.
상세한 코드 로직 파악이나 과거 개발 이력은 아래 문서를 참고하세요.

*   `DOCS/CODE_MANUAL.md`: 각 컴포넌트, API 함수, Edge Function 라인 바이 라인 매뉴얼 (기획자/CTO 인수인계용)
*   `DOCS/ROADMAP.md`: V3 고도화 및 어드민 개선을 위한 개발 비전 로드맵
*   `DOCS/archive/`: 이전 버전(V2)의 마일스톤, 진행 상황(PROGRESS_SUMMARY), Gemini/Claude 리뷰 기록 보관소

## 🚀 시작하기 (Getting Started)

### 환경 변수 설정
`inpsyt-order-frontend` 폴더에 `.env.local` 파일을 생성하고 아래 값을 추가합니다.
```env
VITE_SUPABASE_URL=당신의_SUPABASE_웹_URL
VITE_SUPABASE_ANON_KEY=당신의_SUPABASE_ANON_API_KEY
```

### 프론트엔드 실행
```bash
cd inpsyt-order-frontend
npm install
npm run dev
```

### 데이터베이스 마이그레이션 적용
Supabase CLI를 사용하거나, 웹 대시보드 SQL Editor에 접속하여 `supabase/migrations/` 내의 `.sql` 파일들을 작성된 일자 순서대로 실행합니다.
(최신 RLS 정책 및 RBAC 함수는 `20251121_apply_rbac_rls.sql` 및 `20260401000000_patch_rls_and_create_site_settings.sql` 파일에 정의되어 있습니다.)
