# 사양 시트 — A6 상품 관리 (ProductManagementPage)

> 이 시트는 상품 관리 화면의 정보·기능·데이터 구조의 단일 진실 소스다.
> 시안과 실서비스 구현은 이 시트의 모든 항목을 1:1로 반영해야 한다.
> 마지막 갱신: 2026-06-29 소분류·배지 마스터 소비 **실 코드 구현** — 상품폼 소분류 Autocomplete(마스터 필터)·배지 멀티선택, 표 배지/소분류 색 칩, 엑셀 배지 열 추가.

## 참조 파일
- 실 컴포넌트: `inpsyt-order-frontend/src/components/ProductManagementPage.jsx` (1149줄)
- 관련 API: `inpsyt-order-frontend/src/api/products.js` 의 `fetchAllProducts`
- DB 스키마: `supabase/migrations/20251022045614_create_products_table.sql` + `20251022045615_add_is_popular_to_products.sql` + `20260313044014_add_product_flags.sql`
- **(계획) 카테고리·배지 동적화**: `DOCS/PRD_오티즘_카테고리배지_동적화.md` (P1 트랙). 신규 마스터 테이블 `subcategories`·`badges`, `products.badges text[]`. DRAFT 마이그레이션: `20260619000000_DRAFT_add_product_badges.sql` 외. **소분류 마스터 CRUD·배지 마스터 CRUD UI 자체는 A8 SettingsPage 시트 소관** — 본 화면은 그 마스터를 **선택해 쓰는 쪽**.
- Edge Function: `upload-products-excel` (엑셀 업로드 처리 — 컬럼만 있으면 upsert 통과, 무변경)

## 사용자 시나리오
인싸이트 직원(master 또는 editor)이 사무실에서 PC로 연다. 학회 전에 행사용 상품 카탈로그를 정리하거나, 새 상품을 등록하거나, 엑셀로 일괄 업로드한다. 인기·신상품 플래그를 켜서 고객 주문서의 노출 순서를 조정하고, 태그로 검색 편의를 만든다. 학회 중에는 거의 손대지 않는다(freeze 규칙).

## 표시 정보 (라벨 단위, 누락 금지)

### 상단 헤더 (PageHeader 합성 컴포넌트)
- [ ] 페이지 제목 아이콘: `Inventory2Icon` (PageHeader.icon prop. M3-2에서 CategoryIcon→Inventory2Icon으로 변경, 시안 정합)
- [ ] 페이지 제목 텍스트: "상품 관리" (PageHeader.title)
- [ ] 액션 버튼 그룹 (우측):
  - 엑셀 양식 다운로드 아이콘 (`DescriptionIcon`, info 톤 배경) — line 566-570
  - 상품 목록 다운로드 아이콘 (`DownloadIcon`, success 톤 배경) — line 571-575
  - **이하 `products:edit` 권한 있을 때만 표시** — line 576-599:
    - 엑셀 업로드 아이콘 (`UploadIcon`, warning 톤 배경, "엑셀 업로드 (product_code 기준 upsert)" 툴팁)
    - 전체 삭제 아이콘 (`DeleteForeverIcon`, error 톤 배경/색)
    - "상품 추가" 버튼 (contained, `AddIcon`)

### 통계 카드 6장 (line 603-687, 가로 한 줄에 펼쳐짐 — 클릭하면 필터 적용)
- [ ] 카드 1: "전체 상품" — primary 색 그라데이션, 활성 시 보더 강조, `InventoryIcon`
  - 본문 숫자: `totalProducts` (전체 상품 수)
  - 클릭 효과: `productQuickFilter` 해제 (null)
- [ ] 카드 2: "할인 가능" — success 색 그라데이션, `TagIcon`
  - 본문 숫자: `totalDiscountableCount` (`is_discountable=true` 개수)
  - 클릭 효과: `productQuickFilter='discountable'` 토글
- [ ] 카드 3: "인기 상품" — warning 색 그라데이션, `TrendingUpIcon`
  - 본문 숫자: `totalPopularCount` (`is_popular=true` 개수)
  - 클릭 효과: `productQuickFilter='popular'` 토글
- [ ] 카드 4: "도서" — info 색 그라데이션, `MenuBookIcon`
  - 본문 숫자: `categoryCounts['도서']`
  - 클릭 효과: `selectedCategory='도서'` 토글
- [ ] 카드 5: "검사" — secondary 색 그라데이션, `ScienceIcon`
  - 본문 숫자: `categoryCounts['검사']`
  - 클릭 효과: `selectedCategory='검사'` 토글
- [ ] 카드 6: "도구" — `CATEGORY_COLORS.tool`(#6B7684 회색 계열), `BuildIcon`
  - 본문 숫자: `categoryCounts['도구']`
  - 클릭 효과: `selectedCategory='도구'` 토글
  - **도구 카드 유지·독립.** 카테고리 동적화 PRD에서 도구-검사 합산 정책이 영구 폐지되어 도구는 항상 독립 매출/카운트 버킷(검사/도서/도구 3버킷). 이 화면의 통계 카드는 이미 도구를 독립 카드로 표시 중 — 변경 없음. (※ 매출 합산 폐지는 DashboardPage·revenueByCategory 소관, 본 화면은 카운트만)

> 디자인 결정 시 참고: 그라데이션 배경은 CLAUDE.md "AI 산출물 시그니처" 절에서 차단 대상.
> M3-2(2026-05-28)에서 ProductManagementPage 본문 6장 카드를 시안 QuickFilterCard 패턴(border 기반, 흰 배경 + alpha 색상 hover) 으로 교체 완료. theme 토큰 + `categoryColors.js` 만 사용, 인라인 hex 0.

### 검색·필터 카드 (line 690-736)
- [ ] 상품명 검색 입력: 라벨 "상품명 검색", `SearchIcon` 시작 아이콘
- [ ] 표시 건수 텍스트(조건부, 필터 있을 때): "{N}개 표시 중"
- [ ] 초기화 버튼(조건부, 필터 있을 때): outlined, `RestartAltIcon`, 라벨 "초기화"
- [ ] 태그 칩 목록(`availableTags`): 클릭하여 다중 선택, 선택 시 filled+primary, 비선택 시 outlined

### 선택 시 액션바 (line 738-768, `selectedCount > 0` 이고 `products:edit` 권한 있을 때)
- [ ] 선택 표시: `CheckBoxIcon` + "{selectedCount}개 선택됨" (primary 색, 굵게)
- [ ] "선택 항목 편집" 버튼: outlined, `TuneIcon`
- [ ] "선택 삭제" 버튼: outlined error, `DeleteIcon`
- [ ] "선택 해제" 버튼: text 버튼

### 상품 표 (line 770-898)
- [ ] 표 컬럼(권한별): 체크박스(`products:edit` 시) / 상품명 / 카테고리 / 하위 카테고리 / 가격(오른쪽 정렬) / 비고 / 상태 태그(중앙) / 태그 / 작업(`products:edit` 시)
- [ ] 행 표시 — 누락 금지:
  - 체크박스(개별)
  - 상품명 (`name`, fontWeight 500)
  - 카테고리 칩 (primary outlined, 라벨=`category`) — **대분류(검사/도서/도구 고정 3)**
  - 하위 카테고리 (`sub_category`, 없으면 "-") — **소분류. 동적 마스터(`subcategories`)와 이름 자연키로 연결.** **(2026-06-29 구현)** 마스터에 등록된 이름이면 마스터 색 소프트 틴트 칩(`BadgeChip`), 미등록이면 회색 "· 미등록" 칩 표시(FK 안 검·운영 마찰 방지 — PRD §엣지).
  - 가격 (`list_price`, 천 단위 콤마 + "원", 굵게)
  - 비고 (`notes`, maxWidth 220, 한 줄 잘림)
  - **상태 태그 컬럼 — 누락 금지** (line 844-858):
    - "인기" 칩 (warning, `is_popular=true`일 때)
    - "신상품" 칩 (primary, `is_new=true`일 때)
    - "할인" 칩 (success 톤, `is_discountable=true`일 때)
    - **동적 배지(`products.badges` text[], 마스터 `badges` 연동, P1 — 2026-06-29 구현)**: 마스터에 등록된 배지명마다 마스터 지정 색 소프트 틴트 칩 표시. 우선순위(`badges.priority`) ASC 정렬. **기존 인기/신상품/할인 boolean 칩과 공존**(boolean 삭제 안 함). 미등록 배지명은 회색 "· 미등록" 칩. 카드 표출 가드레일(최대 2개)은 고객 화면(C1) 한정 — 어드민 표에서는 전량 노출.
    - 셋 다 false이고 배지도 없으면 "-" (caption)
  - 태그 (앞 2개 칩 + "+N" 칩으로 나머지)
  - 작업: 편집 아이콘 (`EditIcon`)
- [ ] 페이지네이션: 페이지당 항목 수 셀렉트 (10/25/50/100) + Pagination 컴포넌트

### 정렬 규칙
- [ ] 정렬: 인기 상품 우선 → 이름 가나다순 (line 175-179)

## 액션·기능 (누락 금지)

- [ ] 검색어 입력 → 페이지 1 리셋 + 클라이언트 필터링
- [ ] 카테고리 카드 클릭 → `selectedCategory` 토글
- [ ] 빠른 필터 카드 클릭 → `productQuickFilter` 토글 (`discountable`/`popular`)
- [ ] 태그 칩 클릭 → 다중 선택 토글
- [ ] 초기화 → 검색·카테고리·빠른필터·태그 모두 리셋
- [ ] 체크박스 전체 선택/해제 (현재 페이지 기준)
- [ ] 체크박스 개별 토글
- [ ] 상품 추가 다이얼로그 (line 912-947): 상품명·상품코드·카테고리·하위카테고리·가격·비고·할인가능·인기·신상품·태그 (·배지 — P1 동적화 시 추가)
- [ ] 상품 수정 다이얼로그 (편집 아이콘 클릭, 같은 폼)
- [ ] 선택 삭제 다이얼로그 (line 937-949): "선택한 {N}개 상품을 삭제합니다" + "이 작업은 되돌릴 수 없습니다."
- [ ] 전체 삭제 다이얼로그 (line 951-975): **`"삭제합니다"` 텍스트 입력 받아쓰기 확인** (DELETE_ALL_CONFIRM_TEXT). Enter로 확정.
- [ ] 선택 항목 일괄 편집 다이얼로그 (line 977-1014):
  - 인기 상품: TriState 토글(변경 없음/ON/OFF)
  - 신상품: TriState 토글
  - 태그: 추가/덮어쓰기 모드 토글 + Autocomplete 입력
- [ ] 엑셀 양식 다운로드 (`handleDownloadTemplate`, line 499): 현재 **10컬럼** 한국어 헤더 — 상품명·상품코드·카테고리·하위카테고리·가격·비고·할인여부·인기상품·신상품여부·태그. **(P1 동적화) "배지" 열 1개 추가 → 11컬럼.** "배지" = 콤마 구분 다중값(예: `추천,한정`), `products.badges text[]`로 split 매핑. **"하위카테고리" 열은 기존 그대로 — 소분류 매핑에 신규 열 불필요**(이미 `sub_category` 매핑돼 있음).
- [ ] 상품 목록 다운로드 (`handleDownloadExcel`, line 520): 위와 동일 컬럼(배지 추가 시 11컬럼, `badges.join(',')`)
- [ ] 엑셀 업로드 (line 352-496): 청크 100건 단위, 진행률·로그·오류 표 + "오류 내역 복사" 액션

## 입력 폼 구조

### 상품 추가/수정 폼 (line 912-947)
- [ ] 상품명 (`name`, autoFocus, `products:edit` 없으면 disabled)
- [ ] 상품 코드 (`product_code`)
- [ ] 카테고리 (`category`) + 하위 카테고리 (`sub_category`) — **두 필드 별도, 가로 배치, 분리 입력 필수**
  - **현재(2026-06-24 구현)**: 카테고리 = **필수 `Select`**(검사/도서/도구 고정 3, `categories` 상수). 자유 입력·빈값 불가. 미선택 저장 시 `handleSave`에서 차단 + `FormControl error`(붉은 보더) + 경고 토스트("카테고리를 검사/도서/도구 중에서 선택해 주세요."). 하위 카테고리 = 자유 텍스트 `TextField` 유지(소분류는 동적).
  - **(P1 동적화 — 2026-06-29 구현) 하위 카테고리** = 소분류 마스터(`subcategories`, 선택된 대분류에 소속·`is_active` 것만 필터) **Autocomplete freeSolo**. 마스터 선택 우선·엑셀 호환 위해 직접 입력 허용(미등록은 회색 helperText 경고). 두 필드 **별도 유지**.
- [ ] 가격 (`list_price`, type="number")
- [ ] 비고 (`notes`, multiline rows=3)
- [ ] 플래그 체크박스 — 세 개 별도(절대 통합 금지):
  - "할인 가능" (`is_discountable`)
  - "인기 상품" (`is_popular`)
  - "신상품" (`is_new`)
- [ ] 태그 (`tags`, Autocomplete multiple freeSolo, `availableTags` 옵션)
- [ ] **(P1 동적화 — 2026-06-29 구현) 배지** (`badges` text[], `Autocomplete multiple freeSolo`, 옵션 = 배지 마스터 활성 이름) — 태그와 **별도 필드**(태그=검색 편의 / 배지=고객 노출 라벨). 마스터 선택 우선, 미등록 입력 시 회색 칩 "· 미등록" + helperText. boolean 플래그와 **공존**.

## 권한별 차이

- `products:view` 없음 → "상품 관리 페이지 접근 권한이 없습니다." 출력 (line 553-555)
- `products:view` 있음 (viewer): 표·카드·필터·검색·다운로드 가능. 체크박스 컬럼 안 보임, 추가/편집 버튼 안 보임, 액션바 안 뜸, 폼 모든 필드 disabled, 저장 버튼 안 보임.
- `products:edit` 있음 (master, editor): 모든 액션 가능
- 다이얼로그 폼은 권한 없으면 disabled로 열림(보기 전용)

## 데이터 모델

### `products` 테이블
- `id` (bigint, PK)
- `created_at` (timestamptz)
- `product_code` (text) — upsert 키
- `category` (text) — **대분류**, `'도서'` / `'검사'` / `'도구'` 중 하나 (코드 상수 `categories`, 고정 3). 매출·정산·대시보드 집계 키.
- `sub_category` (text, nullable) — **소분류**(동적). 마스터 `subcategories`와 **이름 자연키** 연결(FK 미설정 — 엑셀 호환). **노출·탐색 전용**(매출 집계 미참여 — 회계 안전). 기존 컬럼 활용(추가 0).
- `badges` (text[], nullable — **P1 신규**, DRAFT `20260619000000_DRAFT_add_product_badges.sql`) — 마스터 `badges`와 이름 자연키 연결. 기존 `is_popular`/`is_new`/`is_discountable` boolean과 **공존**(boolean 삭제 안 함).
- `name` (text)
- `list_price` (numeric)
- `notes` (text, nullable)
- `is_discountable` (boolean, default false)
- `is_popular` (boolean, default false)
- `is_new` (boolean, default false)
- `is_recommend` (boolean, default false) — **마이그레이션에는 있으나 ProductManagementPage UI에 노출 안 됨, 확인 필요**
- `tags` (text[] — 코드에서 배열 사용. 마이그레이션 SQL에는 명시 없음, 확인 필요)

### 엑셀 컬럼 매핑 (line 375-389)
- 상품명 → name
- 상품코드 → product_code
- 카테고리 → category (대분류) — **`String().trim()` 정규화 후 검사/도서/도구 중 하나여야 함. 빈값·오타·공백은 행 오류 처리(아래 §빈 상태 참조).**
- 하위카테고리 → sub_category (소분류 — **기존 매핑, 동적화에도 신규 열 불필요**)
- 가격/정가 → list_price
- 비고 → notes
- 할인여부 → is_discountable (TRUE/Y/YES/1 → true)
- 인기상품 → is_popular
- 신상품여부 → is_new
- 태그 → tags (콤마 split)
- **(P1) 배지 → badges** (콤마 split, text[]) — `handleFileUpload` 매핑부(line 375-389)·`handleDownloadTemplate`(line 499)·`handleDownloadExcel`(line 520) 세 곳에 동일 추가. Edge Fn `upload-products-excel`은 컬럼만 있으면 upsert 통과(무변경).

## 필터·뷰 모드

- 검색어 (상품명 부분 일치)
- 카테고리 단일 선택 (도서/검사/도구) — 카드 클릭으로 토글
- 빠른 필터: discountable | popular | null
- 태그 다중 선택 (OR 매칭)
- 정렬: 인기 우선 → 이름 가나다순(고정, 사용자 선택 없음)
- 페이지당 항목 수: 10/25/50/100 (기본 50)

## 빈 상태·로딩·오류 처리

- 로딩: `TableSkeleton rows=10 columns=9`
- 빈 상태(필터 결과 없음): `EmptyState` — "검색 결과가 없습니다" + "다른 검색어나 필터를 시도해 보세요" + "필터 초기화" 액션
- 빈 상태(상품 미등록): "등록된 상품이 없습니다" + "새 상품을 추가해 시작하세요" + "상품 추가" 액션 (`products:edit` 권한 있을 때만)
- 오류: 토스트(`addNotification`) 처리, 화면 안에 잔류 알림 없음
- 엑셀 업로드 오류: 진행 다이얼로그 내 오류 표(행/상품코드/상품명/사유) + "오류 내역 복사" 액션
  - 사전 검증 사유: "상품코드 필수" / "상품명 필수" / **"카테고리는 검사/도서/도구만 허용"**(2026-06-24 신설 게이트 — 빈값·오타·공백 행을 오류 처리, 정상 행만 upsert) / "엑셀 내 중복" + 서버 측 오류

## 핵심 발견 (시안 검수 시 반드시 확인)

1. **대분류 3종은 도서/검사/도구(고정).** "도구"가 빠지거나 통합되면 안 됨. **대분류는 필수**(2026-06-24): 폼은 Select로 미선택 저장 차단, 엑셀은 검사/도서/도구 외 행을 오류 처리. 미분류 매출(회계 누락)을 입력단에서 원천 차단. (서버 측 2중 방어: DRAFT `20260624010000_DRAFT_products_category_constraint.sql`의 NOT NULL+CHECK — backend 소관, 건우님 승인 후 적용.) **도구-검사 매출 합산 정책은 PRD에서 영구 폐지(3버킷)** — 단, 그 변경은 DashboardPage·revenueByCategory 소관이고 본 화면 통계 카드는 이미 도구를 독립 카운트로 표시 중. (FulfillmentPage의 "도구→검사" 정규화는 출고 화면 한정 규칙이며 본 PRD와 별개 — 혼동 주의.)
9. **(P1) 소분류는 노출 전용·매출 미참여.** `sub_category`를 마스터로 동적화해도 **매출 집계(revenueByCategory)는 `category`만 참조** — 소분류 변경이 합계에 영향 0이어야 함. 소분류를 카운트/집계 축으로 끌어들이지 말 것.
10. **(P1) 소분류·배지는 이름 자연키 연결(FK 없음).** 엑셀 호환을 위해 무결성을 DB FK가 아닌 UI 경고("미등록" 회색)로 처리. 시안/구현이 미등록 값을 막거나 업로드를 reject하면 안 됨(운영 마찰 방지 — PRD §엣지).
11. **(P1) 배지는 boolean 플래그와 공존.** `products.badges`(동적) 추가가 `is_popular`/`is_new`/`is_discountable`를 대체하지 않음. 상태 태그 컬럼·폼 모두 양쪽 다 표시·입력. 통합·치환 금지.
12. **(P1) 어드민 표는 배지 전량 노출.** 고객 카드의 "최대 2개" 가드레일(C1)은 운영자 화면에 적용 안 함 — 운영자는 모든 배지를 확인해야 함.
2. **상태 태그 3종(인기·신상품·할인)은 표 안에서 한 컬럼에 모인다.** 시안이 한 종만 보여주면 운영자는 다른 두 플래그를 못 본다.
3. **폼의 플래그 3종은 별도 체크박스.** 하나의 토글이나 셀렉트로 통합 금지.
4. **카테고리·하위 카테고리는 별도 필드.** 가로 배치이지만 입력은 두 칸으로 분리됨.
5. **태그·하위카테고리·notes는 nullable.** 시안에서 항상 값이 있는 것처럼 그리면 빈 상태 처리가 빠진다.
6. **전체 삭제는 받아쓰기 확인 ("삭제합니다") + 위험한 액션 색 처리.** 자주 하는 일과 다른 모양·색·위치 원칙(01 원칙 3).
7. **통계 카드 6장이 일렬로 배치.** 시안이 3장만 보여주면 카테고리 카드 3종이 사라진다.
8. **그라데이션 배경은 현재 코드에 있지만 신 디자인 시스템에서는 제거 대상(CLAUDE.md E항).** 시안에서 그라데이션을 유지하지 말 것.

## 변경 이력

- 2026-06-29 **소분류·배지 마스터 소비 실 코드 구현 (P1)**. (1) **상품 폼**: 하위 카테고리 자유 텍스트 → `Autocomplete freeSolo`(옵션=소분류 마스터 중 현재 폼 대분류에 소속·`is_active=true`인 이름만 필터). 미등록 입력 시 회색 helperText 경고. 배지 = `Autocomplete multiple freeSolo`(옵션=배지 마스터 활성 이름) 신규 필드(태그와 별도). 미등록 배지 입력 시 회색 칩 "· 미등록". boolean 플래그(인기/신상품/할인)와 공존. `createEmptyProduct`에 `badges: []` 추가. (2) **상품 표**: 하위 카테고리 = 소분류 마스터 색 소프트 틴트 칩(미등록 회색 "· 미등록"). 상태 태그 컬럼에 동적 배지 추가 — 우선순위(`badges.priority`) 정렬, 어드민 **전량 노출**(C1 최대 2개 가드 미적용, §발견 12), 미등록 회색. boolean 칩과 공존, 셋 다 false+배지 0이면 "-". (3) **엑셀**: 양식·목록 다운로드에 "배지" 열(`badges.join(',')`) 추가, 업로드 파싱에 배지 열(콤마 split, tags 패턴 복제). 소분류는 기존 "하위카테고리" 열 그대로. (4) **회귀 방어(graceful)**: products.badges 컬럼 미존재(마이그레이션 미적용) 시 — 폼 저장은 빈 badges 제외 + `PGRST204` 감지 시 badges 빼고 재시도, 엑셀 업로드는 빈 badges 제외, 마스터 fetch는 테이블 없으면 빈 배열 → 기존 자유입력 동작 보존. (5) 색·칩 토큰은 `MASTER_COLOR_FALLBACK`(A8 신설). 핵심 발견 9~12 충족. 마스터 CRUD UI 자체는 A8 소관(본 화면은 소비). **C1 고객 카드 배지 칩은 별도 트랙(미구현).**
- 2026-06-24 **대분류(category) 필수화 구현 (실 코드 변경)**. (1) **상품 폼**: 카테고리 자유 텍스트 `TextField` → 필수 `Select`(검사/도서/도구). `categoryInvalid` 상태 + `FormControl error`, `handleSave`에서 `categories.includes` 미충족 시 차단·경고 토스트. createEmptyProduct의 빈 category도 저장 차단. (2) **엑셀 업로드**: 매핑부 `category`를 `String().trim()` 정규화, 사전 검증 루프에 게이트 추가 — `categories.includes` false면 사유 "카테고리는 검사/도서/도구만 허용"으로 오류 표에 push·continue, 정상 행만 upsert. 기존 오류 표 구조 `{행,상품코드,상품명,사유}` 그대로. (3) `revenueByCategory.js` unclassified 콘솔 경고 유지(잔여 방어). (4) 동일 파일 사전 부채(`_rowNum` no-unused-vars) 정리. **하위카테고리·배지 동적화(P1)·다른 폼 필드 무변경.** 핵심 발견 1 갱신, 데이터 모델/엑셀 매핑/빈 상태 절에 게이트 명시.
- 2026-06-24 카테고리·배지 동적화 PRD 반영 (`DOCS/PRD_오티즘_카테고리배지_동적화.md`, P1 트랙·기획 단계) — **사양만 갱신, 실 코드 미변경.** (1) **대분류 고정 3(검사/도서/도구) + 소분류(`sub_category`) 동적 마스터(`subcategories`) 연동** 명시. 도구-검사 합산 폐지 정책 주석(매출 소관은 Dashboard). (2) **상태 태그 컬럼에 동적 배지(`products.badges` text[], 마스터 `badges`) 공존** — boolean 인기/신상품/할인과 병존, 미등록 회색, 어드민은 전량 노출. (3) **상품 폼**: 카테고리=대분류 Select·하위카테고리=소분류 마스터 Autocomplete 전환 검토, 배지 멀티선택 필드 신규(별도). (4) **엑셀**: "배지" 열 1개 추가(10→11컬럼), 소분류는 기존 "하위카테고리" 열 그대로(신규 열 불필요). 매핑·양식·목록 3곳 동일 추가. (5) 데이터 모델에 `products.badges`·소분류 자연키 추가. 핵심 발견 9~12(노출 전용·자연키·boolean 공존·전량 노출) 신설. 라인 번호 1137→1149 갱신. **소분류·배지 마스터 CRUD UI 자체는 A8 시트 소관.**
- 2026-05-13 신설.
- 2026-05-28 (M3-2): 실 페이지 시안 디자인 시스템 정합. 그라데이션 카드 6장 → border 기반 QuickFilterCard로 교체. PageHeader · SectionCard · ActionSlot · ui/EmptyState 합성 컴포넌트 적용. 모달 영역(line 903~1135) · 비즈니스 로직 · 권한 가드 · 받아쓰기 모달 · 엑셀 업·다운로드 전부 보존. 자동 검출 5종 본문 신규 위반 0.
