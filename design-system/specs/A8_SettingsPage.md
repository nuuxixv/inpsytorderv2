# 사양 시트 — A8 설정 (SettingsPage)

> 이 시트는 설정 화면의 정보·기능·데이터 구조의 단일 진실 소스다.
> 시안과 실서비스 구현은 이 시트의 모든 항목을 1:1로 반영해야 한다.
> 마지막 갱신: 2026-05-28 신설.

## 참조 파일
- 실 컴포넌트: `inpsyt-order-frontend/src/components/SettingsPage.jsx` (274줄)
- 관련 API: `inpsyt-order-frontend/src/api/settings.js` (`getSettings`/`updateSettings`) — 단, 실제 페이지는 supabase 클라이언트로 직접 호출하므로 이 모듈을 거치지 않음
- 연계 화면: `inpsyt-order-frontend/src/components/GoRedirect.jsx` (`/go` 진입 시 `active_event_slug` 사용)
- 외부 라이브러리: `qrcode` (QR 생성)
- DB 스키마: `supabase/migrations/20260401000000_patch_rls_and_create_site_settings.sql` (`site_settings`)

## 사용자 시나리오
master 권한자가 학회 직전 한 번 들어와 (1) 이번 학회의 `/go` 단축 링크 대상 학회를 지정하고 (2) 배송비 정책을 점검한다. 인쇄물용 QR 코드는 학회 직전에 한 번 다운로드해 인싸이트 부스 안내물에 인쇄한다. 학회 중에는 거의 손대지 않는다. 변경 시 즉시 적용된다는 점이 명시되어 있다(하단 안내 Alert).

## 표시 정보 (라벨 단위, 누락 금지)

### 상단 헤더 (line 113-116)
- [ ] 아이콘: `SettingsIcon` (primary 색, 1.4rem)
- [ ] 타이틀: "설정" (h6, 700)

### 본문 컨테이너
- [ ] `Paper` p 4, radius 16 (인라인 — 시안에서는 radius 토큰으로 흡수)
- [ ] `Stack spacing={4}` 3블록 + 액션

### 블록 1 — 리다이렉트 학회 관리 (line 120-203)
- [ ] 섹션 제목: "리다이렉트 학회 관리" (h6, 700)
- [ ] 부제: "/go 경로로 접속 시 자동으로 이동할 학회를 설정합니다. QR 코드를 인쇄물에 활용할 수 있습니다."
- [ ] 필드: "활성 학회 선택" (`Select`)
  - 첫 옵션: "없음 (비활성)" (italic em 태그로 강조)
  - 그 외 옵션: `events` 테이블에서 `created_at` desc 조회한 학회들 — "{event.name} ({event.order_url_slug})" 표시
- [ ] URL 안내 카드(grey.50 배경, radius 10, grey.200 보더):
  - 라벨: "리다이렉트 URL"
  - 값: `https://inpsytorder.vercel.app/go` (monospace, body1, fontWeight 500) — **하드코딩된 절대 URL. 다른 환경(개발/스테이징)에서도 prod URL이 표시됨 — 확인 필요.**
  - 버튼: "URL 복사" outlined + `CopyIcon` (클릭 시 클립보드 복사 + 토스트)
  - 버튼: "QR 다운로드" outlined + `DownloadIcon` (클릭 시 SVG QR 생성 다운로드)

### 블록 2 — 배송비 정책 (line 207-240)
- [ ] 섹션 제목: "배송비 정책" (h6, 700)
- [ ] 부제: "주문 금액에 따른 배송비 및 무료 배송 기준을 설정합니다. 현장 판매는 배송비가 적용되지 않습니다."
- [ ] 필드: "무료 배송 기준 금액" (`TextField` type=number, 끝 어드먼트 "원")
  - helperText: "이 금액 이상 구매 시 배송비가 0원이 됩니다."
  - 기본값: 30000 (코드 line 33, DB default 30000)
- [ ] 필드: "배송비" (`TextField` type=number, 끝 어드먼트 "원")
  - helperText: "기준 금액 미만 구매 시 부과되는 배송비입니다."
  - 기본값: 3000 (DB default)

### 블록 3 — 액션 (line 244-261)
- [ ] 우측 정렬, gap 2
- [ ] "취소" outlined (radius 10, px 3) — 클릭 시 `fetchSettings` 재호출 (입력값 폐기 + DB 값으로 복원)
- [ ] "저장하기" contained (radius 10, px 4, fontWeight 700) — 저장 중 `CircularProgress` 24

### 하단 안내 Alert (line 265-268)
- [ ] severity info, radius 12
- [ ] 본문: "설정 변경 사항은 즉시 적용됩니다. (이미 생성된 주문에는 영향을 주지 않으며, 신규 주문부터 적용됩니다.)"

## 액션·기능 (누락 금지)

- [ ] 진입 시 `fetchSettings` + `fetchEvents` 병렬 호출 (line 38-41)
  - `fetchSettings` — `site_settings`에서 `*` 단일 행 select. `free_shipping_threshold`/`shipping_cost`/`active_event_slug` 3종 추출.
  - `fetchEvents` — `events`에서 `id, name, order_url_slug` select, `created_at` desc 정렬
- [ ] 활성 학회 선택 → `settings.active_event_slug` state 변경 (저장 누르기 전까지는 DB 미반영)
- [ ] URL 복사 → `navigator.clipboard.writeText('https://inpsytorder.vercel.app/go')` + 토스트 "URL이 클립보드에 복사되었습니다."
- [ ] QR 다운로드 (line 172-194):
  - `QRCode.toString(url, { type: 'svg', color: {dark:'#252525', light:'#FFFFFF'}, margin:1, width:300 })`
  - Blob 생성 → 임시 a 태그로 `qr-inpsytorder-go.svg` 다운로드
  - 성공 시 토스트, 실패 시 에러 토스트
- [ ] 배송비 필드 변경 → state만 업데이트 (저장 누르기 전까지 DB 미반영)
- [ ] 저장 (`handleSave`, line 80-101):
  - `site_settings` 테이블 update `WHERE id=1` (하드코딩, 코드 주석에 "ID 1 for now, or we can use a more robust way if needed")
  - 페이로드: `free_shipping_threshold`(parseInt), `shipping_cost`(parseInt), `active_event_slug`(빈 문자열은 null로 변환), `updated_at`
  - 성공 시 토스트, 실패 시 에러 토스트
- [ ] 취소 → `fetchSettings`로 DB 값 다시 가져와 폼 리셋

## 입력 폼 구조 (분리/통합 절대 금지)

- [ ] `active_event_slug` (단일 select — events 테이블의 slug 또는 빈 문자열)
- [ ] `free_shipping_threshold` (단일 number, 정수, 원 단위)
- [ ] `shipping_cost` (단일 number, 정수, 원 단위)

## 권한별 차이

- master: 진입 / 변경 / 저장 가능. RLS도 master만 UPDATE 허용 (`Admins can update site_settings`).
- 일반 사용자(authenticated): SELECT 가능 (`Public can view site_settings`). 변경은 RLS에서 차단되므로 저장 시도 시 실패.
- 비로그인: SELECT 가능(공개 정책). 단, 페이지 자체는 인증된 어드민 라우트.
- 코드 측에 `hasPermission` 호출 없음 — 라우팅 가드 의존. 시안에서 비-master가 들어왔을 때 입력 필드를 disabled로 만들지 별도로 결정해야 함.

## 데이터 모델

### `site_settings` 테이블 (`20260401000000_patch_rls_and_create_site_settings.sql`)
- `id` (integer PK, default 1, **단일 행 강제**: `CHECK (id = 1)`)
- `free_shipping_threshold` (integer, NOT NULL, default 30000)
- `shipping_cost` (integer, NOT NULL, default 3000)
- `email_domains` (jsonb, NOT NULL, default `["naver.com", "gmail.com", "daum.net", "hanmail.net"]`)
- `updated_at` (timestamptz)

### `active_event_slug` 컬럼 — **마이그레이션 누락 (확인 필요)**
- SettingsPage.jsx와 GoRedirect.jsx 모두 `site_settings.active_event_slug`를 select/update하지만, `supabase/migrations/` 디렉터리에 해당 컬럼을 추가하는 SQL이 없다.
- 즉 운영 DB에는 컬럼이 추가돼 있지만 코드 베이스의 마이그레이션 이력으로는 추적되지 않는다.
- 신규 환경 부트스트랩(예: 로컬 supabase reset) 시 `active_event_slug` 컬럼이 없어 페이지 진입이 실패할 수 있다.

### `email_domains` 컬럼 — 본 페이지에서 사용 안 함
- DB에는 존재하지만 SettingsPage는 select하지 않는다. 다른 사용처가 있을 수 있음 — 본 시트 범위 밖.

## 빈 상태·로딩·오류 처리

- [ ] 로딩(`loading=true`): 가운데 `CircularProgress` py 8 (line 103-109)
- [ ] 학회 없음: Select 옵션이 "없음 (비활성)" 하나만 표시됨 — 별도 빈 상태 메시지 없음
- [ ] 저장 중(`saving=true`): 저장 버튼이 `CircularProgress` 24로 교체, 취소 버튼 비활성
- [ ] 설정 조회 실패: 토스트 "설정 정보를 불러오는 데 실패했습니다."
- [ ] 학회 조회 실패: console.error만, UI에 표시 안 함 (line 51)
- [ ] 저장 실패: 토스트 "설정 저장 실패: {error.message}"
- [ ] QR 생성 실패: 토스트 "QR 코드 생성에 실패했습니다."

## 핵심 발견 (시안 검수 시 반드시 확인)

1. `site_settings.active_event_slug` 컬럼의 CREATE/ALTER 마이그레이션이 리포지토리에 없다. SettingsPage·GoRedirect 두 곳에서 이 컬럼을 사용하지만 마이그레이션 이력은 없다. 운영 DB에는 수동 추가됐을 것으로 추정. 신규 환경 부트스트랩이 깨지는 잠재 부채 — A7 사양 시트의 `user_profiles` 누락과 같은 카테고리.
2. 리다이렉트 URL이 prod URL로 하드코딩되어 있다(`https://inpsytorder.vercel.app/go`). 개발/스테이징 환경에서도 그대로 표시되고, QR 코드도 prod URL로 생성된다. 멀티 환경 운영을 의도한다면 환경변수화 필요. 시안 결정과는 무관하지만 본 시트에 기록.
3. 사이드바·라우트 가드 외에 페이지 자체에 권한 체크가 없다. 비-master가 어떻게든 페이지에 들어오면 저장 버튼을 누를 수 있고, RLS가 막을 뿐 UI는 "저장 가능한 것처럼" 보인다. 시안에서 비-master 분기를 그릴지(필드 disabled), 라우팅에서 완전 차단할지 결정 필요.
4. `email_domains` 컬럼은 DB에 정의됐지만 본 페이지에서 노출하지 않는다. 다른 사용처(고객 폼 이메일 도메인 화이트리스트 추정)가 있는지 확인 필요. 시안에서 이를 추가 노출할지 미노출할지 결정 항목.
5. 저장 직후 신규 주문에는 적용되지만 기존 주문에는 영향 없다는 안내 Alert가 명시되어 있다. 이 동작은 `create-order` Edge function이 매번 `site_settings`를 다시 읽기 때문(C1 시트의 서버측 금액 재계산 절 참조). 시안에서 이 안내를 보존할지·다른 위치로 옮길지 결정.
6. 인쇄용 QR이 SVG로만 다운로드된다. PNG 옵션 없음. 인쇄 업체가 PNG를 요구하는 경우도 있다 — 시안에서 추가 결정 필요.
7. Select의 "없음 (비활성)" 옵션이 italic + em 태그로 표시된다(line 138-140). MUI Select 내부에서 italic이 잘 안 보이는 경우가 있어, 시안에서 명시적 disabled 색 또는 "선택 안 함" 명확화 검토.

## 변경 이력
- 2026-05-28 신설 — design/m2-admin-rest 브랜치 5종 일괄 사전 정독. `active_event_slug` 컬럼 마이그레이션 누락 및 하드코딩 prod URL 등 잠재 부채 발견.
- 2026-05-29 M3-8 시안 정합 (PR #10~16 답습) — SettingsPage.jsx (274→약 360, MUI Paper/Divider 제거 → ui 컴포넌트 답습).
  - PageHeader 도입 (subtitle: "리다이렉트 학회 · 배송비 · 시스템 정보")
  - 블록 1·2·3 SectionCard (EventIcon · ShippingIcon · InfoIcon, padding=24)
  - 활성 학회 선택 Select 옵션: 이름 + slug 2줄, "선택 안 함 (비활성)" italic 명확화 (사양 §발견 7 반영)
  - URL 안내 카드: gray.50 박스 + 활성 학회명 컨텍스트 라인 + ActionSlot(URL 복사 · QR 다운로드)
  - 사양 §발견 1 (active_event_slug 마이그레이션 누락) → fetchSettings 응답에 컬럼 없으면 warning Alert 표시 (시안 답습)
  - 시스템 정보 SectionCard 신규 (시안 답습, readonly): 버전 / 환경(`import.meta.env.MODE` 기반) / DB 리전 — InfoRow 사용
  - 배송비 정책 요약 카드 (입력값 즉시 반영 미리보기)
  - 하단 안내 Alert 보존 (info, borderRadius radii.md)
  - 저장·취소 액션 → ActionSlot (minHeight 44, 취소: fetchSettings 재호출 / 저장: handleSave)
  - 보존: supabase 직접 호출 2종(fetchSettings/fetchEvents/handleSave), QR SVG 다운로드 로직, REDIRECT_URL 하드코딩 (사양 §발견 2 — 환경변수화는 별도 부채)
  - 자동 검출 5종 통과 (raw hex 0 / 인라인 fontSize rem-px 0 / weight 800 0 / 4배수 외 0 / touch 44 미만은 카드 내부 보조 버튼 36, 시안 답습)
