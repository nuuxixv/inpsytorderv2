# ♊️ GEMINI Project Guide

이 문서는 Gemini AI 에이전트가 이 프로젝트를 일관되고 효율적으로 지원하기 위한 핵심 가이드입니다. 에이전트는 작업을 수행하기 전에 반드시 이 문서를 참고해야 합니다.

## 1. 프로젝트 개요

- **프로젝트명**: 인싸이트 오더 v2 (inpsytorderv2)
- **핵심 기능**: 학회/이벤트 기반 주문 관리 시스템
- **기술 스택**:
  - **프론트엔드**: React, Vite, JavaScript
  - **백엔드/DB**: Supabase (PostgreSQL)
  - **스타일링**: CSS (App.css, index.css)

## 2. 개발 환경

- **운영체제**: **Windows (`win32`)**
  - **파일/폴더 명령어**:
    - 파일 삭제: `del [파일명]` (절대 `rm` 사용 금지)
    - 폴더 삭제: `rmdir /s /q [폴더명]` (절대 `rm -rf` 사용 금지)
- **패키지 매니저**: `npm`
- **프론트엔드 위치**: `inpsyt-order-frontend/`

## 3. 주요 명령어

- **의존성 설치**:
  ```bash
  cd inpsyt-order-frontend
  npm install
  ```
- **프론트엔드 개발 서버 실행**:
  ```bash
  cd inpsyt-order-frontend
  npm run dev
  ```
- **Supabase 로컬 환경 시작**:
  ```bash
  supabase start
  ```
- **테스트 실행**:
  - 현재 설정되지 않음 (향후 `Vitest` 또는 `React Testing Library` 도입 예정)
- **린트 실행**:
  ```bash
  cd inpsyt-order-frontend
  npm run lint
  ```

## 4. 데이터베이스 (Supabase)

- **DB 종류**: PostgreSQL
- **스키마 관리**: Supabase Migrations
  - **새 마이그레이션 생성**: `supabase migrations new [마이그레이션_이름]`
  - **로컬 DB에 마이그레이션 적용**: `supabase db reset` (Docker Desktop 실행 필수)
- **주요 테이블**: `events`, `orders`, `order_items`, `products`

## 5. 코딩 컨벤션 및 아키텍처

- **프론트엔드**:
  - 컴포넌트 기반 아키텍처 (`src/components`)
  - 상태 관리: React Context API (`AuthContext`, `NotificationContext`)
  - 라우팅: `react-router-dom`
  - 인증: `ProtectedRoute`를 사용한 라우트 보호
- **백엔드**:
  - 비즈니스 로직은 Supabase Edge Functions 로 구현 (`supabase/functions`)
  - 데이터베이스 트리거는 `pg_notify`를 사용하여 함수를 간접적으로 호출하는 것을 선호 (HTTP 요청 직접 호출 지양)

## 6. 프로젝트 비전 및 핵심 원칙

이 섹션은 프로젝트의 본질적인 목적, 운영 모델, 제약 사항을 정의하여 모든 참여자(AI 에이전트 '지니' 포함)가 일관된 방향성을 유지하도록 돕습니다.

- **프로젝트 목적 (Purpose):**
  - 특정 학회 및 단기 이벤트를 위한 임시 주문 접수 및 관리 시스템입니다.
  - 상시 운영되는 쇼핑몰이 아니며, 연간 약 20회 내외로 단발성으로 사용됩니다.

- **핵심 운영 모델 (Operating Model):**
  - 이벤트별 고유 URL을 통해 주문을 접수합니다.
  - 관리자는 관리자 페이지를 통해 접수된 주문을 확인하고, 필요한 경우 수동으로 상태를 변경합니다.
  - 배송 및 CS 관련 업무는 이 시스템에서 처리하지 않고, 기존 채널(홈페이지, 유선 등)을 통해 진행합니다.

- **주요 제약사항 (Constraints & Non-Goals):**
  - **재고 관리:** 회사 메인 ERP와 연동하지 않으며, 실시간 재고 관리를 하지 않습니다. (단, 이벤트별 판매 수량 제한은 고려할 수 있습니다.)
  - **결제 시스템:** PG(결제 대행사)와 연동하지 않습니다. 모든 결제 확인 및 환불 처리는 관리자가 외부 수단을 통해 수동으로 진행합니다.
  - **고객 기능:** 고객이 직접 주문을 추적하거나 정보를 수정하는 기능은 제공하지 않습니다.

- **고도화 방향성 (Future Vision):**
  - **운영자 편의성 극대화:** 주문 관리, 상태 변경, 정보 확인 등 관리자가 수동으로 처리해야 하는 업무를 최대한 빠르고 정확하게 수행할 수 있도록 지원하는 기능을 중심으로 발전시킵니다.
  - **휴먼 에러 방지:** 수동 작업 시 발생할 수 있는 실수를 최소화하기 위한 기록(예: 관리자 메모) 및 검증 장치를 마련합니다.
