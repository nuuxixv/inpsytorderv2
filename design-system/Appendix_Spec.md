# Appendix — 수치 명세

> 자연어 문서들이 다루지 않는 픽셀·헥사·ms 단위 수치를 한 곳에 모았다. M1 종료 시점에 정확한 값이 결정되며, 그 전까지는 후보값과 범위로 표시한다.

## 1. 색 (M1 미확정 — 후보 범위)

### Brand
- `brand-primary`: 짙은 청록 계열. 후보 `#0F766E`, `#0E7490`, `#0B6E6E` 중 시안 단계 결정
- `brand-primary-strong`: brand-primary보다 한 단계 짙은 변형
- `brand-primary-soft`: 카드 배경·옅은 강조용

### Status
- `status-paid`: 진한 초록 (예: `#16A34A` 계열)
- `status-pending`: 노란빛 주황 (예: `#D97706` 계열)
- `status-cancelled`: 회색에 가까운 빨강 (예: `#B91C1C` 계열, 채도 한 단계 누름)
- `status-shipped`: brand 톤 안의 진행 색
- `status-completed`: 회색 계열, 의미적으로 '종료' 강조 안 함

각 status 색은 -soft(배경 칩), -bold(텍스트) 변형을 갖는다.

### Surface (회색 5단계)
- `surface-0`: `#FFFFFF` (페이지 배경)
- `surface-1`: `#F8F9FA` (카드 배경)
- `surface-2`: `#E9ECEF` (구분선 옅음)
- `surface-3`: `#CED4DA` (구분선 진함)
- `surface-4`: `#6C757D` 또는 `#666666` (보조 텍스트)

### Text
- `text-primary`: `#111111` (본문)
- `text-secondary`: `#444444` (보조)
- `text-tertiary`: `#666666` 이하로 안 내림
- `text-on-brand`: 흰색

대비는 본문 4.5:1, 큰 글자 3:1 보장.

## 2. 타이포

- 본문(`body`): 16px / line-height 1.5 / weight 400
- 본문 강조(`body-strong`): 16px / 1.5 / 600
- 보조(`small`): 14px / 1.5 / 400
- 캡션(`caption`): 12px / 1.4 / 400 — 보조 정보·법적 고지만
- 카드 제목(`title-card`): 18px / 1.4 / 600
- 섹션 제목(`title-section`): 20px / 1.3 / 700
- 페이지 제목(`title-page`): 24~28px 사이 (시안 단계 결정) / 1.2 / 700

폰트 스택: `Pretendard, -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", system-ui, sans-serif`

## 3. 간격 (8의 배수, 일부 4)

- `space-xs`: 4px
- `space-sm`: 8px
- `space-md`: 12px
- `space-lg`: 16px
- `space-xl`: 24px
- `space-2xl`: 32px
- `space-3xl`: 48px
- `space-4xl`: 64px

## 4. 라운드

- `radius-none`: 0 (구분선·표 셀)
- `radius-sm`: 6px (태그·칩)
- `radius-md`: 10px (카드·드로어)
- `radius-lg`: 14px (모달·큰 영역)
- `radius-button`: 8 또는 10 (시안 단계 결정)

## 5. 그림자

- `shadow-card`: `0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.06)` 후보
- `shadow-pop`: `0 4px 12px rgba(0,0,0,0.10)` 후보 (드로어·드롭다운)
- `shadow-modal`: `0 16px 32px rgba(0,0,0,0.14)` 후보 (모달·바텀시트)

색은 모두 검정 알파만. 보라·파랑 그림자 금지.

## 6. 터치 영역

최소 44x44px. 아이콘 자체가 작더라도 클릭 가능 영역은 44x44 채움.

## 7. 브레이크포인트

- 모바일: ≤ 480px
- 태블릿: 481~1024px (어드민 1차 타깃)
- 데스크탑: ≥ 1025px

## 8. 트랜지션

- 빠른(`transition-fast`): 120ms cubic-bezier(0.4, 0, 0.2, 1)
- 보통(`transition-base`): 200ms cubic-bezier(0.4, 0, 0.2, 1)
- 느린(`transition-slow`): 320ms cubic-bezier(0.4, 0, 0.2, 1) — 드로어·모달 슬라이드

## 9. z-index

- `z-base`: 0
- `z-sticky`: 100 (페이지 내 고정 헤더)
- `z-dropdown`: 1000
- `z-drawer`: 1100
- `z-modal`: 1200
- `z-toast`: 1300

## 10. 확정 일정

이 모든 후보값은 M1 종료 시점(2026-05-31 목표)에 단일 값으로 확정된다. 확정 후 이 문서는 후보 표시를 제거하고 최종값만 남긴다.
