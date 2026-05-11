# Appendix — 수치 명세

> 자연어 문서들이 다루지 않는 픽셀·헥사·ms 단위 수치를 한 곳에 모은다. M1 종료 시점(2026-05-31 목표)에 정확한 값이 단일 값으로 확정되며, 그 전까지는 후보값과 범위로 표시한다.

---

## 1. 색 — Brand (M1 미확정 후보 범위)

| 토큰 | 후보 | 용도 |
|---|---|---|
| `brand-primary` | `#0F766E` / `#0E7490` / `#0B6E6E` 중 결정 | CTA 버튼, 메인 강조 |
| `brand-primary-strong` | `brand-primary` 명도 -10~-15% | hover, pressed 강조 |
| `brand-primary-soft` | `brand-primary` 명도 +40~+50% (옅은 톤) | 카드 배경, 옅은 강조 |
| `brand-on-primary` | `#FFFFFF` | brand 위 텍스트 |

## 2. 색 — Status (4종, 각 -soft·-bold 변형 보유)

| 토큰 | 후보 | 용도 |
|---|---|---|
| `status-paid` | `#16A34A` 계열 | 결제완료 표시 |
| `status-paid-soft` | `#DCFCE7` 계열 | paid 칩 배경 |
| `status-paid-bold` | `#15803D` 계열 | paid 칩 텍스트 |
| `status-pending` | `#D97706` 계열 | 미결제 |
| `status-pending-soft` | `#FEF3C7` 계열 | pending 칩 배경 |
| `status-cancelled` | `#B91C1C` (채도 한 단계 누름) | 취소·환불 |
| `status-cancelled-soft` | `#FEE2E2` 계열 | 칩 배경 |
| `status-shipped` | brand 톤 안의 진행 색 | 배송중·발송완료 |
| `status-completed` | 회색 계열 (#6C757D 톤) | 종료. 의미적으로 강조하지 않음 |

## 3. 색 — Surface (회색 5단계)

| 토큰 | 값 | 용도 |
|---|---|---|
| `surface-0` | `#FFFFFF` | 페이지 배경 |
| `surface-1` | `#F8F9FA` | 카드 배경 |
| `surface-2` | `#E9ECEF` | 구분선 (옅음) |
| `surface-3` | `#CED4DA` | 구분선 (진함), 비활성 |
| `surface-4` | `#6C757D` | 보조 강한 회색 |

가장 옅은 두 단계는 `prefers-contrast: more` 시 다음 단계 값으로 끌어올린다(§11 참조).

## 4. 색 — Text

| 토큰 | 값 | 용도 |
|---|---|---|
| `text-primary` | `#111111` | 본문, 헤딩 |
| `text-secondary` | `#444444` | 보조 텍스트 |
| `text-tertiary` | `#666666` | 가장 옅은 보조 — 이 이하로 내리지 않음 |
| `text-on-brand` | `#FFFFFF` | brand 위 텍스트 |
| `text-disabled` | `#9CA3AF` | 비활성. 대비 3:1은 유지 |

대비 보장: 본문 4.5:1 이상 / 큰 글자(18px+ bold 또는 24px+) 3:1 이상.

## 5. 타이포

| 토큰 | size / line-height / weight | 용도 |
|---|---|---|
| `body` | 16 / 1.5 / 400 | 본문 |
| `body-strong` | 16 / 1.5 / 600 | 본문 강조 |
| `small` | 14 / 1.5 / 400 | 보조 텍스트 |
| `caption` | 12 / 1.4 / 400 | 캡션·법적 고지 (12 이하 금지) |
| `title-card` | 18 / 1.4 / 600 | 카드 제목 |
| `title-section` | 20 / 1.3 / 700 | 섹션 제목 |
| `title-page` | 24~28 (M1 결정) / 1.2 / 700 | 페이지 제목 |
| `button-label` | 16 / 1.2 / 600 | 버튼 라벨 |

폰트 스택: `Pretendard, -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", system-ui, sans-serif`

자간(`letter-spacing`)은 거의 0. 한글에 음수 자간 강하게 주지 않음.

## 6. 간격 (4의 배수)

| 토큰 | 값 |
|---|---|
| `space-xs` | 4px |
| `space-sm` | 8px |
| `space-md` | 12px |
| `space-lg` | 16px |
| `space-xl` | 24px |
| `space-2xl` | 32px |
| `space-3xl` | 48px |
| `space-4xl` | 64px |

페이지 좌우 여백: 모바일 16 / 태블릿 24 / 데스크탑 32.
카드 내부: 16, 카드 사이: 12, 섹션 사이: 32 또는 48.

## 7. 라운드

| 토큰 | 값 | 용도 |
|---|---|---|
| `radius-none` | 0 | 구분선·표 셀 |
| `radius-sm` | 6px | 태그·칩 |
| `radius-md` | 10px | 카드·드로어 |
| `radius-lg` | 14px | 모달·바텀시트·큰 영역 |
| `radius-button` | 8 또는 10 (M1 결정) | 버튼 |
| `radius-pill` | 999px | CTA 한 자리에서만, 또는 미사용 |

## 8. 그림자

| 토큰 | 후보 값 | 용도 |
|---|---|---|
| `shadow-card` | `0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.06)` | 일반 카드 |
| `shadow-pop` | `0 4px 12px rgba(0,0,0,0.10)` | 드로어·드롭다운·플로팅 |
| `shadow-modal` | `0 16px 32px rgba(0,0,0,0.14)` | 모달·바텀시트 |

색은 모두 검정 알파. 보라·파랑 그림자 금지.

## 9. 터치 영역

최소 44×44px. 아이콘 자체가 더 작아도 클릭 가능 영역은 44×44 채움.
인접한 클릭 영역 사이에는 최소 8px 여백.

## 10. 브레이크포인트

| 토큰 | 범위 | 1차 타깃 |
|---|---|---|
| `bp-mobile` | ≤ 480px | 고객 주문서 |
| `bp-tablet` | 481~1024px | 어드민 (1차) |
| `bp-desktop` | ≥ 1025px | 어드민 (2차) |

## 11. 가시성 세이프가드 — CSS 매핑 (09 문서와 1:1)

### 11.1 color-scheme

전역 `html, body` + 폼 요소(`input`, `select`, `textarea`)에 `color-scheme: light` 선언.

```css
html, body { color-scheme: light; }
input, select, textarea { color-scheme: light; }
```

이중 선언 이유: 일부 OS·브라우저 조합에서 페이지 단위 선언이 폼 요소에 전파되지 않음.

### 11.2 prefers-color-scheme: dark (자동 보정)

CSS 변수 한 세트의 값을 미디어쿼리 안에서 재할당. **새 색 토큰을 추가하지 않음.**

대치 규칙:
- `surface-0` `#FFFFFF` → `#0B0F14` 계열
- `surface-1` `#F8F9FA` → `#111720` 계열
- `surface-2~3` 명도 반전, 콘트라스트 유지
- `text-primary` `#111111` → `#F1F5F9` 계열
- `text-secondary` `#444444` → `#CBD5E1` 계열
- `text-tertiary` `#666666` → `#94A3B8` 계열 (대비 4.5:1 유지)
- `brand-primary` 명도 +10~+15%로 어두운 배경에서 식별 가능하도록
- `status-*-soft` 배경은 명도 한 단계 어둡게, -bold 텍스트는 한 단계 밝게

정확한 매핑값은 M1 종료 시점 확정.

### 11.3 prefers-contrast: more

```css
@media (prefers-contrast: more) {
  --surface-2: var(--surface-3);  /* 옅은 두 단계 끌어올림 */
  --text-tertiary: var(--text-secondary);
  --border-width-default: 1.5px;  /* 굵기 한 단계 */
}
```

목표: 본문 대비 7:1 이상.

### 11.4 forced-colors: active

```css
@media (forced-colors: active) {
  /* 보더·아이콘에 시스템 키워드 fallback */
  .card, .input, .button { border-color: CanvasText; }
  .icon { color: CanvasText; }
  .button-primary { background: ButtonText; color: ButtonFace; }
  .focus-ring { outline-color: Highlight; }
}
```

원칙: 우리 색 고집하지 않음. 요소의 위치·경계만 사라지지 않게.

### 11.5 검수 게이트 3 체크리스트

| 환경 | 확인 항목 |
|---|---|
| iOS Safari (다크 모드 ON) | 모든 페이지 정상 표시 |
| iOS Smart Invert ON | 주문서 검색 박스·입력 필드 가시성 |
| Android Chrome (다크 모드 ON) | 동일 |
| Android Force Dark ON | 폼 요소 가시성 |
| Windows 고대비 모드 ON | 어드민 보더·아이콘 잔존 |
| iPad 글자 크기 큼/매우큼 | 주문서 끊김 없음 |
| 데스크탑 크롬 줌 150% | 어드민 한 화면 안 잘림 없음 |
| `prefers-contrast: more` | 본문 대비 7:1 통과 |

## 12. 트랜지션

| 토큰 | 값 | 용도 |
|---|---|---|
| `transition-fast` | 120ms cubic-bezier(0.4, 0, 0.2, 1) | hover·color 변화 |
| `transition-base` | 200ms cubic-bezier(0.4, 0, 0.2, 1) | 일반 |
| `transition-slow` | 320ms cubic-bezier(0.4, 0, 0.2, 1) | 드로어·모달 슬라이드 |

`prefers-reduced-motion: reduce` 시 모두 0ms 또는 매우 짧게 단축.

## 13. z-index

| 토큰 | 값 |
|---|---|
| `z-base` | 0 |
| `z-sticky` | 100 |
| `z-dropdown` | 1000 |
| `z-drawer` | 1100 |
| `z-modal` | 1200 |
| `z-toast` | 1300 |

## 14. Primitives — 컴포넌트 수치

### Button

| 크기 | height | padding-x | font | radius |
|---|---|---|---|---|
| `lg` (CTA·일괄변경) | 56px | 24px | `button-label` | `radius-button` |
| `md` (일반) | 44px | 16px | `button-label` | `radius-button` |

`sm` 사이즈는 만들지 않음 (터치 44 미달).

### Input

| 항목 | 값 |
|---|---|
| height | 48px |
| padding-x | 16px |
| font | `body` |
| border | 1px solid `surface-3` |
| border-focus | 2px solid `brand-primary` |
| radius | `radius-md` (10px) |
| `color-scheme` | `light` (강제) |

### Card

| 항목 | 값 |
|---|---|
| padding | 16px (`space-lg`) |
| gap (카드 사이) | 12px (`space-md`) |
| radius | `radius-md` (10px) |
| shadow | `shadow-card` |
| background | `surface-1` 또는 `surface-0` |

### Modal

| 항목 | 값 |
|---|---|
| max-width | 480px (모바일) / 560px (태블릿+) |
| padding | 24px (`space-xl`) |
| radius | `radius-lg` (14px) |
| shadow | `shadow-modal` |
| backdrop | `rgba(0,0,0,0.5)` |

### BottomSheet

| 항목 | 값 |
|---|---|
| 상단 radius | `radius-lg` (14px) |
| 하단 radius | 0 |
| padding | 24px |
| 슬라이드 | `transition-slow` |

### Toast

| 항목 | 값 |
|---|---|
| min-width | 280px |
| max-width | 480px |
| padding | 12px 16px |
| radius | `radius-md` |
| shadow | `shadow-pop` |
| 머무는 시간 | 5000ms (원칙 4 — "오래 머문다") |

## 15. 확정 일정

이 모든 후보값은 **M1 종료 시점 (2026-05-31 목표)**에 단일 값으로 확정된다. 확정 후 이 문서는 후보·범위 표기를 제거하고 최종값만 남긴다.

확정 책임: CPO 1차 검수 + 건우님 공동 검수(M1 게이트).
