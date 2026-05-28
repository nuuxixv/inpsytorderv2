# 사양 시트 — A6 상품 관리 (ProductManagementPage)

> 이 시트는 상품 관리 화면의 정보·기능·데이터 구조의 단일 진실 소스다.
> 시안과 실서비스 구현은 이 시트의 모든 항목을 1:1로 반영해야 한다.
> 마지막 갱신: 2026-05-13 신설.

## 참조 파일
- 실 컴포넌트: `inpsyt-order-frontend/src/components/ProductManagementPage.jsx` (1137줄)
- 관련 API: `inpsyt-order-frontend/src/api/products.js` 의 `fetchAllProducts`
- DB 스키마: `supabase/migrations/20251022045614_create_products_table.sql` + `20251022045615_add_is_popular_to_products.sql` + `20260313044014_add_product_flags.sql`
- Edge Function: `upload-products-excel` (엑셀 업로드 처리)

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
- [ ] 카드 6: "도구" — grey[600] 그라데이션, `BuildIcon`
  - 본문 숫자: `categoryCounts['도구']`
  - 클릭 효과: `selectedCategory='도구'` 토글

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
  - 카테고리 칩 (primary outlined, 라벨=`category`)
  - 하위 카테고리 (`sub_category`, 없으면 "-")
  - 가격 (`list_price`, 천 단위 콤마 + "원", 굵게)
  - 비고 (`notes`, maxWidth 220, 한 줄 잘림)
  - **상태 태그 컬럼 — 누락 금지** (line 832-846):
    - "인기" 칩 (warning, `is_popular=true`일 때)
    - "신상품" 칩 (primary, `is_new=true`일 때)
    - "할인" 칩 (success 톤, `is_discountable=true`일 때)
    - 셋 다 false면 "-" (caption)
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
- [ ] 상품 추가 다이얼로그 (line 900-935): 상품명·상품코드·카테고리·하위카테고리·가격·비고·할인가능·인기·신상품·태그
- [ ] 상품 수정 다이얼로그 (편집 아이콘 클릭, 같은 폼)
- [ ] 선택 삭제 다이얼로그 (line 937-949): "선택한 {N}개 상품을 삭제합니다" + "이 작업은 되돌릴 수 없습니다."
- [ ] 전체 삭제 다이얼로그 (line 951-975): **`"삭제합니다"` 텍스트 입력 받아쓰기 확인** (DELETE_ALL_CONFIRM_TEXT). Enter로 확정.
- [ ] 선택 항목 일괄 편집 다이얼로그 (line 977-1014):
  - 인기 상품: TriState 토글(변경 없음/ON/OFF)
  - 신상품: TriState 토글
  - 태그: 추가/덮어쓰기 모드 토글 + Autocomplete 입력
- [ ] 엑셀 양식 다운로드 (`handleDownloadTemplate`): 10컬럼 한국어 헤더 — 상품명·상품코드·카테고리·하위카테고리·가격·비고·할인여부·인기상품·신상품여부·태그
- [ ] 상품 목록 다운로드 (`handleDownloadExcel`): 위와 동일 10컬럼
- [ ] 엑셀 업로드 (line 352-496): 청크 100건 단위, 진행률·로그·오류 표 + "오류 내역 복사" 액션

## 입력 폼 구조

### 상품 추가/수정 폼 (line 900-935)
- [ ] 상품명 (`name`, autoFocus, `products:edit` 없으면 disabled)
- [ ] 상품 코드 (`product_code`)
- [ ] 카테고리 (`category`) + 하위 카테고리 (`sub_category`) — **두 필드 별도, 가로 배치, 분리 입력 필수**
- [ ] 가격 (`list_price`, type="number")
- [ ] 비고 (`notes`, multiline rows=3)
- [ ] 플래그 체크박스 — 세 개 별도(절대 통합 금지):
  - "할인 가능" (`is_discountable`)
  - "인기 상품" (`is_popular`)
  - "신상품" (`is_new`)
- [ ] 태그 (`tags`, Autocomplete multiple freeSolo, `availableTags` 옵션)

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
- `category` (text) — `'도서'` / `'검사'` / `'도구'` 중 하나 (코드 상수 `categories`)
- `sub_category` (text, nullable)
- `name` (text)
- `list_price` (numeric)
- `notes` (text, nullable)
- `is_discountable` (boolean, default false)
- `is_popular` (boolean, default false)
- `is_new` (boolean, default false)
- `is_recommend` (boolean, default false) — **마이그레이션에는 있으나 ProductManagementPage UI에 노출 안 됨, 확인 필요**
- `tags` (text[] — 코드에서 배열 사용. 마이그레이션 SQL에는 명시 없음, 확인 필요)

### 엑셀 컬럼 매핑 (line 374-388)
- 상품명 → name
- 상품코드 → product_code
- 카테고리 → category
- 하위카테고리 → sub_category
- 가격/정가 → list_price
- 비고 → notes
- 할인여부 → is_discountable (TRUE/Y/YES/1 → true)
- 인기상품 → is_popular
- 신상품여부 → is_new
- 태그 → tags (콤마 split)

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

## 핵심 발견 (시안 검수 시 반드시 확인)

1. **카테고리 3종은 도서/검사/도구.** "도구"가 빠지거나 통합되면 안 됨. (다만 FulfillmentPage에서는 "도구→검사" 정규화가 일어남 — 출고 화면 한정 규칙.)
2. **상태 태그 3종(인기·신상품·할인)은 표 안에서 한 컬럼에 모인다.** 시안이 한 종만 보여주면 운영자는 다른 두 플래그를 못 본다.
3. **폼의 플래그 3종은 별도 체크박스.** 하나의 토글이나 셀렉트로 통합 금지.
4. **카테고리·하위 카테고리는 별도 필드.** 가로 배치이지만 입력은 두 칸으로 분리됨.
5. **태그·하위카테고리·notes는 nullable.** 시안에서 항상 값이 있는 것처럼 그리면 빈 상태 처리가 빠진다.
6. **전체 삭제는 받아쓰기 확인 ("삭제합니다") + 위험한 액션 색 처리.** 자주 하는 일과 다른 모양·색·위치 원칙(01 원칙 3).
7. **통계 카드 6장이 일렬로 배치.** 시안이 3장만 보여주면 카테고리 카드 3종이 사라진다.
8. **그라데이션 배경은 현재 코드에 있지만 신 디자인 시스템에서는 제거 대상(CLAUDE.md E항).** 시안에서 그라데이션을 유지하지 말 것.

## 변경 이력

- 2026-05-13 신설.
- 2026-05-28 (M3-2): 실 페이지 시안 디자인 시스템 정합. 그라데이션 카드 6장 → border 기반 QuickFilterCard로 교체. PageHeader · SectionCard · ActionSlot · ui/EmptyState 합성 컴포넌트 적용. 모달 영역(line 903~1135) · 비즈니스 로직 · 권한 가드 · 받아쓰기 모달 · 엑셀 업·다운로드 전부 보존. 자동 검출 5종 본문 신규 위반 0.
