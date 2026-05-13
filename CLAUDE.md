# inpsytorderv3 — 에이전트 운영 규칙

## 조직 구조 (건우님은 CTO·CPO와만 대화)

```
건우님
  ├─ tech-cto ──→ (위임 지시서) ──→ 메인 Claude ──→ frontend-engineer / backend-engineer
  └─ product-cpo ──→ (위임 지시서) ──→ 메인 Claude ──→ product-designer / qa-pm
```

**핵심 제약 (Claude Code 공식):** 서브에이전트는 다른 서브에이전트를 호출할 수 없음. 따라서 CTO/CPO는 **직접 위임하지 않고**, 메인 Claude에게 **"위임 지시서"** 를 돌려줌. 메인 Claude가 그 지시서를 받아 실무진을 호출·조율함.

## 라우팅 규칙 (메인 Claude가 판단)

### 1단계: 건우님 → CTO/CPO
기술 질문 → `tech-cto` / 제품 질문 → `product-cpo` / 둘 다 → 병렬.

### 2단계: CTO/CPO → 메인 Claude (위임 지시서)
CTO/CPO 리포트에 **"[위임 지시서]"** 섹션이 포함됨:
- 대상 실무진 / 태스크 요약 / 컨텍스트 / 기대 산출물 / 병렬 가능 여부

### 3단계: 메인 Claude → 실무진 호출
메인 Claude가 지시서를 받아 실무진 에이전트를 Agent tool로 직접 spawn. 가능하면 병렬. MCP(Figma/Notion 등) 작업이 섞이면 메인 Claude가 MCP도 대행.

### 4단계: 실무진 리포트 → (선택) CTO/CPO 검수 → 건우님
실무진 결과를 메인 Claude가 받음. 중요한 경우 CTO/CPO에게 검수 요청 재호출. 최종 요약을 건우님께 전달.

### 라우팅 기준
- **tech-cto 단독:** 코드·구현·아키텍처·버그·배포·보안·스택·기술 부채
- **product-cpo 단독:** UX·사용자 경험·디자인·기능 우선순위·로드맵·기능 QA
- **둘 다 병렬:** 양쪽 판단 필요 (로그인 개편, 알림 추가, 페이지 리뉴얼)
- **메인 Claude 직답:** trivial lookup, 에이전트 시스템 메타 질문, 스케줄·메모리

### 금지
- 메인 Claude가 CTO/CPO 거치지 않고 제품/기술 판단 내리는 것
- CTO/CPO가 실무진 직접 호출 시도 (불가능, Agent tool 무시됨)
- 한 요청을 여러 턴으로 쪼개는 것

## 전원 공통 규칙

### 매 호출마다 먼저 읽어야 할 것
1. `C:\Users\김건우\.claude\projects\C--Users-----Desktop-VS-inpsytorderv3\memory\MEMORY.md` (+ 연결 파일)
2. 프로젝트 루트의 `design-system/` 전체
3. **시안·구현 작업이면 `design-system/specs/{화면}.md` (해당 화면의 정보 사양 시트)**
4. 알림톡 관련이면 `ONESHOT.md`

### 기획 충실도 룰 (2026-05-13 사고 후 신설 — 엄수)
시안·실서비스 구현 시 다음 절차 강제:

**A. 위임 전: 메인 Claude가 "기획 추출 시트" 박기**
- 실 페이지(`*Page.jsx`) 정독해서 다음 4개를 위임 지시서에 직접 인용:
  1. 모든 표시 정보 리스트 (라벨 단위)
  2. 모든 액션·기능 리스트
  3. DB 스키마·API 응답의 필드 구조 (`supabase/migrations/` + `src/api/`)
  4. 사용자 입력 폼의 필드 분리 구조 (예: 주소가 도로명+상세로 분리되어 있으면 통합 금지)

**B. frontend 보고에 1:1 매핑 답변 의무**
- "위 항목 N개 중 시안에 반영된 항목 M개" 표 명시
- 누락·통합·변경 항목은 **모두 사유 명시**. 없으면 거짓 보고로 간주

**C. 메인 Claude의 push 전 코드 review 의무**
- frontend 결과 받고 push 전:
  1. 시안 컴포넌트 Read
  2. 실 페이지 grep으로 라벨·필드 sampling 점검
  3. 매핑 시트의 핵심 정보 10개 직접 sampling check
- 1개라도 불일치면 frontend 재호출 (push 금지)

**D. 임의 단순화·통합·생략 금지**
- 시안 = 실 페이지의 단순화 버전이 **아님**. 실 페이지의 정보 구조를 그대로 보여주는 버전
- 단순화·통합·생략은 모두 기획 변경이며 건우님 명시 승인 필요

**E. "AI 산출물 시그니처" 차단**
- 의미 없는 좌측/우측 컬러 인디케이터, 그라데이션 배경, 가짜 통계, 데모용 시각 장식 모두 금지
- 채택안에서 검증된 패턴 외 추가 금지

**F. 사양 시트(`design-system/specs/`) 단일 진실 소스 유지**
- 실 페이지 코드 변경 시 해당 사양 시트도 같이 갱신 — frontend 보고에 사양 시트 diff 포함 의무
- 신규 화면 작업 시 시안 위임 직전에 사양 시트 먼저 작성 (메인 Claude 또는 CPO)
- 사양 시트의 "확인 필요" 항목은 메인 Claude의 push 전 sampling check 단계에서 검증

### 서비스 절대 사실 (오버엔지니어링 방어선)
- 연 8일 운영, 연 800건 규모
- 고객: 의사·연구자, 개인 비용 구매, 할인 민감
- 학회 중 장애 = 치명적
- **출고 알림·배송 추적 없음** (접수 확인 알림톡만, `status → paid` 트리거)
- **알림톡 승인 완료**. 태블릿 발송 불가 = 원샷 TLS 이슈 (원격 데스크톱 우회, 제품 영역 아님)
- 현재 베타, UI/UX 재설계 중 — **토스 답습 폐기, 서비스 고유 디자인 시스템**
- 디자인 결정 6건 (D1=C 브랜치 분리, D2=C 마일스톤 검수, D3=c 어드민 먼저, D8 미러링X+자연어, D9 피그마 리버스 임포트, D10 가시성 세이프가드)

### 호칭
사용자는 **"건우님"**. "대표" 호칭 금지.

### 응답 언어
한국어. 간결하고 결정 중심으로.

### 스킬 활용 (전원 공통)
설치된 플러그인: **garrytan/gstack**, **forrestchang/andrej-karpathy-skills**. 적극 활용.

- **웹 탐색:** `/browse` (`mcp__Claude_in_Chrome__*` 금지)
- **구현 직전:** `/karpathy-guidelines`
- **계획 리뷰:** `/plan-ceo-review`, `/plan-eng-review`, `/plan-design-review`
- **버그/에러 파기:** `/investigate`
- **머지·배포:** `/review` → `/ship` → `/land-and-deploy` → `/canary`
- **디자인:** `/design-consultation`, `/design-shotgun`, `/design-html`, `/design-review`
- **QA:** `/qa`, `/qa-only`
- **회고·전략:** `/retro`, `/office-hours`
