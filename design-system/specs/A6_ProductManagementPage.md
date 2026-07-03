# 사양 시트 — A6 상품 관리 (ProductManagementPage)

> 이 시트는 상품 관리 화면의 정보·기능·데이터 구조의 단일 진실 소스다.
> 시안과 실서비스 구현은 이 시트의 모든 항목을 1:1로 반영해야 한다.
> 마지막 갱신: 2026-07-02 **검사 위계 통합 개편 3건 실 구현**(frontend-engineer, 건우님 최종 지시). **[지시 1] "검사군 묶어보기" 토글(`groupView` state·`Switch`) 제거 — `selectedCategory==='검사'`이면 무조건 그룹 뷰(디폴트이자 유일 뷰).** 도서·도구·전체는 평면. '전체'에서 검사 상품이 평면에 섞이는 현행 유지(전체 조망). 검사 그룹 뷰는 기본 접힘·페이지네이션 숨김. **[지시 2] 별도 "검사군 관리" 토글 패널(`tgPanelOpen`)·헤더 버튼 폐지 — 기능을 '검사' 그룹 뷰에 인라인 흡수.** 그룹 헤더 행에 검사군 단위 관리(노출 Switch·검사명/약어 편집·⋮ 메뉴[옵션 편집·분리·병합·삭제]), 옵션 하위 행의 편집 버튼으로 상품 필드 편집(말머리·옵션명·순서는 옵션 편집 다이얼로그 재사용). 병합은 헤더에서 이 검사군을 대표로 지정→흡수할 다른 검사군 선택. 위험 액션(분리/병합/삭제)은 기존 확인 다이얼로그 재사용. **검사 = '검사' 카테고리 화면 하나에서 조회·수정 전부.** "검사군 추가"는 검사 뷰 필터 바에 노출. **[지시 3] 엑셀 다운로드/업로드에 검사 위계 열 추가**: `검사군약어`·`검사군명`·`옵션명`·`말머리`·`공용(Y/공란)`·`옵션정렬`·`노출(Y/N)`. 다운로드=현 DB값(test_groups 조인) 채워 내보냄. 업로드=열 채워진 것만 반영(빈 열=미변경, 기존 값 보존→구양식 회귀 0). 검사군 매칭=(약어,검사명) 조합으로 조회, 없으면 신규 생성(`makeTestGroupResolver`, seed_hierarchy.py dedup 동일). Edge Fn 무변경(컬럼 있으면 통과, 없으면 프론트에서 위계 열 빼고 1회 재시도 graceful). 기존 열·`product_code` upsert 무변경. theme.js 무수정·MUI만·AI 시그니처 금지·권한 가드 보존. lint 신규 0·build·vitest 113 passed.
> 이전 갱신: 2026-07-02 **검사 위계 실 구현 — is_active 토글 + 검사군 관리 화면**(frontend-engineer). (1) is_active: 상품 표 행 dim(`is_active===false`, `opacity 0.55`) + 상태 태그 컬럼 맨 앞 "숨김" 칩(`gray[200]` 소프트 틴트, 노출 중은 무표시) + 상품 폼 별도 행 "고객 주문서 노출" `Switch`(기본 노출, off 시 "숨김" 칩·보조문구) + `handleSave` PGRST204 재시도에 `is_active` 포함(컬럼 미적용 graceful). 숨김 상품이 표에서 잔류. (2) 검사군 관리: 헤더 "검사군 관리" 토글 → Collapse `SectionCard`(`products:edit`). 목록(체크박스·약어·검사명·옵션N·is_active Switch·편집·삭제) + 검사명·약어·정렬 편집 다이얼로그(미리보기 카드) + 옵션 상세(말머리·형태명 TextField·공용 Checkbox·개별 is_active Switch·▲▼ 순서) + 분리(1→N)·병합(N→1)·삭제 위험 액션 확인 다이얼로그. API `src/api/testGroups.js` 신설. 편집=즉시, 위험 액션=확인 스텝. graceful(테이블 미적용 시 빈 목록). ⚠️ 검사군 단위 is_active = 검사군 카드 노출만 토글(옵션 일괄 전파 미구현, TODO 주석 + "확인 필요" 유지 — backend·건우님 검수). 노출 필터(P1) 미구현. theme.js 무수정·MUI 유지·AI 시그니처 없음. lint·build 통과.
> 이전 갱신: 2026-07-02 **검사 위계 시안 — is_active 토글 + 검사군 관리 화면**(product-designer, PRD_검사위계.md). (1) **is_active(노출여부) = 상품 전역 필드**(검사 위계 전용 아님): 상품 표에 "노출" 상태칩(노출 중/숨김) + 상품 폼에 Switch. **숨김 상품도 표에서 사라지지 않고** 회색 dim + "숨김" 칩으로 구분. 단어 = **"노출 중" / "숨김"**(권고안, "판매중지"보다 중립·데이터 보존 뉘앙스 정합). (2) **검사군 관리 화면**(A6 내 신규 탭/토글 패널): 검사군 목록 + 분리/병합/검사명·약어 편집/옵션 순서/삭제. 진열 깨는 위험 액션(병합·삭제)은 확인 스텝. §검사군 관리·상태 태그·상품 폼 절 신설. theme.js 무수정·MUI 유지.
> 이전 갱신: 2026-06-29 **동적 배지 기능 폐기 — 인기/신상품·소분류는 유지**(건우님 결정). 배지 마스터 CRUD 패널·다이얼로그, 상품 폼 배지 칩 토글, 표 동적 배지 칩, 엑셀 "배지" 열, `products.badges` 코드 참조를 전부 제거. `is_popular`/`is_new` boolean(카드 칩·폼 체크박스·표 상태태그·엑셀 인기/신상품 열)·소분류 마스터·상품 이미지·태그는 그대로 유지. `fetchBadges`·배지 CRUD API 삭제, `fetchMasterUsageCounts`는 `subCounts`만 반환. 헤더 토글 "소분류·배지 관리"→"소분류 관리". §관련 절·핵심 발견 갱신.
> 이전 갱신: 2026-06-29 **상품 표 썸네일 플레이스홀더 폐기 — 이미지 없으면 셀 비움**(건우님 결정). `ProductThumb`가 `getProductImageUrl(filename)` null이거나 onError면 `return null`(썸네일·플레이스홀더 미표시, 셀 빈 칸). "이미지" 컬럼 자체는 유지(있는 상품만 썸네일). 기존 회색 박스+ImageIcon 플레이스홀더 제거, `ImageIcon` import 삭제. C1 카드와 동일 정책(혼재 처리 로직 없음 — 오버엔지니어링 방어). §표 썸네일·핵심 발견 14 갱신.
> 이전 갱신: 2026-06-29 **상품 이미지 기능 추가**(PRD `DOCS/PRD_상품이미지.md`, P1) — 헤더 액션부 **이미지 일괄 업로드 버튼**(`PhotoLibraryIcon`, `products:edit`, 다중 파일→`product-images` 공개 버킷, 파일명 그대로 upsert, 진행/결과 다이얼로그), **상품 표 "이미지" 썸네일 컬럼**(상품명 앞, 1:1 40px), **엑셀 "이미지" 열**(양식·목록·업로드 파싱 3곳, `image_filename` 매핑). graceful(버킷·컬럼 미적용 환경 회귀 0). API `src/api/productImages.js`. (※ 플레이스홀더는 위 결정으로 폐기.)
> 이전 갱신: 2026-06-29 **소분류·배지 마스터 CRUD를 SettingsPage→ProductManagementPage로 이동**(헤더 액션부 "소분류·배지 관리" 토글 → 펼침/접이 패널), **상품 폼 배지 입력을 칩 체크박스 토글 그룹으로 교체**(무제한 선택·3개째부터 회색 안내·직접추가 보존), **엑셀 배지 2개 초과는 경고 로그만**(행 오류 아님). 핵심 원칙: "최대 2개"는 입력 제약이 아니라 **표출 정책**(고객 카드 한정, C1). 건우님 결정.
> 이전 갱신: 2026-06-29 태그 검색 옵션 = **상품태그(products.tags) ∪ 학회목록(societies.name)** 합집합으로 확장(건우님 피드백 #3).

## 참조 파일
- 실 컴포넌트: `inpsyt-order-frontend/src/components/ProductManagementPage.jsx`
- **검사군 API: `inpsyt-order-frontend/src/api/testGroups.js`**(`fetchTestGroups`·`createTestGroup`·`updateTestGroup`·`deleteTestGroup`·`fetchTestGroupOptionCounts`·`fetchTestGroupOptions`·`updateProductOption`·`splitTestGroup`·`mergeTestGroups` — 2026-07-02 신규). 마이그레이션 미적용 시 빈 목록/무동작 graceful. 분리=새 검사군 INSERT+옵션 test_group_id UPDATE, 병합=흡수 검사군 옵션 이관+빈 검사군 DELETE, 삭제=검사군만 제거(FK ON DELETE SET NULL로 상품 보존).
- DRAFT 마이그레이션(검사 위계): `supabase/migrations/20260630000000_DRAFT_create_test_groups_master.sql`(`test_groups`), `20260630010000_DRAFT_add_products_test_group_columns.sql`(`test_group_id`·`option_name`·`option_label`·`is_common`·`sort_order`), `20260630020000_DRAFT_add_products_is_active.sql`(`is_active`) — 건우님 적용 후 실동작. 미적용 시 UI graceful(빈 목록·노출 취급).
- 관련 API: `inpsyt-order-frontend/src/api/products.js` 의 `fetchAllProducts`, **`inpsyt-order-frontend/src/api/productImages.js`**(`getProductImageUrl`·`uploadProductImage`·`PRODUCT_IMAGE_BUCKET` — 2026-06-29 신규)
- DRAFT 마이그레이션(상품 이미지): `supabase/migrations/20260619020000_DRAFT_create_product_images_bucket.sql`(공개 버킷), `20260619030000_DRAFT_add_products_image_filename.sql`(`image_filename` 컬럼) — 건우님 적용 후 실동작.
- DB 스키마: `supabase/migrations/20251022045614_create_products_table.sql` + `20251022045615_add_is_popular_to_products.sql` + `20260313044014_add_product_flags.sql`
- **(계획) 카테고리 동적화**: `DOCS/PRD_오티즘_카테고리배지_동적화.md` (P1 트랙). 마스터 테이블 `subcategories`. **(2026-06-29) 소분류 마스터 CRUD UI는 본 화면(ProductManagementPage)으로 이동 완료** — 헤더 액션부 "소분류 관리" 토글 패널. 본 화면이 마스터의 단일 진실 소스 UI이자 소비처. API `src/api/masters.js`. **(2026-06-29) 동적 배지 기능 폐기** — `badges` 마스터·`products.badges`는 DB drop 예정, 코드 참조 0.
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
  - **이하 `products:edit` 권한 있을 때만 표시**:
    - 엑셀 업로드 아이콘 (`UploadIcon`, warning 톤 배경, "엑셀 업로드 (product_code 기준 upsert)" 툴팁)
    - **이미지 일괄 업로드 아이콘** (`PhotoLibraryIcon`, secondary 톤 배경, "상품 이미지 일괄 업로드 (파일명 그대로 — 엑셀 '이미지' 열과 일치)" 툴팁) — **(2026-06-29 신규)** `<input type=file multiple accept="image/*">`. 선택 파일을 각각 `product-images` 공개 버킷에 **파일명 그대로**(`upsert:true`) 업로드. 진행률·실패 목록 다이얼로그(§아래). 권한 `products:edit`.
    - **"소분류 관리" 토글 버튼** (`CategoryIcon` outlined, `ExpandMore`/`ExpandLess` 끝아이콘) 클릭 시 헤더 아래 마스터 관리 패널 펼침/접이(`masterPanelOpen` Collapse). A8 SettingsPage에서 이동. 권한 가드 `products:edit`.
    - 전체 삭제 아이콘 (`DeleteForeverIcon`, error 톤 배경/색)
    - "상품 추가" 버튼 (contained, `AddIcon`)

### 소분류 마스터 관리 패널 (헤더 아래 Collapse, `products:edit` 한정 — 2026-06-29, A8에서 이동)
> **배치:** 엑셀 다운/업로드 액션부 옆 "소분류 관리" 토글로 펼침/접이. 통계 카드 위, 헤더 직하. SectionCard가 가로 flexWrap(`flex 1 1 360px`). **즉시 저장** — 다이얼로그 저장/삭제/Switch 모두 즉시 DB 반영(상품 폼 저장과 무관, 별도 흐름). 마이그레이션 미적용 시 빈 목록 graceful.
- [ ] **소분류 관리 카드** (`AccountTreeIcon`): 부제 "대분류(검사/도서/도구) 하위의 분류입니다. 고객 주문서에서 칩으로 노출되며 탐색에 쓰입니다. (매출 집계에는 영향 없음 · 추가·수정·삭제 즉시 적용)". action="소분류 추가"(contained `AddIcon`). 행: 소프트 틴트 칩(이름·색, `ColorChip`) + 소속 대분류 칩 + "순서 N" + "· 상품 N개" + is_active Switch + 편집/삭제 아이콘. 빈 상태 "등록된 소분류가 없습니다 · 추가해 시작하세요". 삭제 가드: 사용 상품>0이면 disabled + 경고.
- [ ] **소분류 추가/수정 다이얼로그**: 이름·소속 대분류 Select·색 프리셋(`MASTER_COLOR_PRESETS` 9색, 자유 hex 금지)·정렬 순서 + 미리보기. 같은 대분류 내 이름 중복 검증.
- ~~배지 관리 카드 / 배지 다이얼로그~~ — **(2026-06-29 폐기)** 동적 배지 기능 제거. 인기/신상품은 상품 폼 체크박스로 별도 관리(유지).

### 검사군 관리 = '검사' 그룹 뷰 인라인 (2026-07-02 개편 — 별도 패널 폐지)
> **배치(현행):** 별도 "검사군 관리" 토글 패널(`tgPanelOpen`)은 **폐지**. 검사군 CRUD·명명·분리·병합·옵션 편집을 전부 **'검사' 카테고리 그룹 뷰 안에 인라인 흡수**했다(건우님 최종 지시 2). `selectedCategory==='검사'`이면 무조건 그룹 뷰가 뜨고, 각 검사군 그룹 헤더 행에서 관리한다. "검사군 추가"는 그룹 뷰 진입 시 필터 바에 노출. 아래 목록/편집/분리/병합/삭제 다이얼로그는 **기존 컴포넌트를 그대로 재사용**하고 진입점만 그룹 헤더로 옮겼다. 검사군은 **검사 대분류 상품에만 해당**. 편집(검사명·약어·노출)=즉시, 위험 액션(분리/병합/삭제)=확인 스텝.

#### 검사군 목록 = 그룹 뷰 헤더 행 (2026-07-02 개편 — 별도 목록 폐지, 그룹 뷰 헤더에 인라인)
- [ ] "검사군 추가"(outlined `AccountTreeIcon`)는 '검사' 뷰 필터 바에 노출(`products:edit`). 검색은 기존 상품명 검색이 대체(별도 검사군 검색 폐지).
- [ ] 각 검사군 = **그룹 뷰의 헤더 `TableRow`**. 좌측 셀에 ▸/▾ + 약어(`abbr` `caption`/600) + 검사명(`name` `body1`/600 주인공) + "옵션 N개"(`tgOptionCounts`). `is_active=false` 검사군은 행 dim(`opacity 0.55`) + "숨김" 칩.
- [ ] 헤더 행 우측 관리 셀(`products:edit`, `colSpan={2}`, 클릭 stopPropagation):
  - **is_active Switch**(검사군 카드 노출 토글 — R4 확정: 카드 노출만 제어, 옵션 일괄 전파 안 함)
  - 편집 아이콘(`EditIcon`) → 검사명·약어 편집 다이얼로그
  - **⋮ 메뉴(`MoreVertIcon`)** → 옵션 편집(말머리·형태명·순서) / 분리 / 병합 / 삭제. 위험 액션은 기존 확인 다이얼로그.
- [ ] 미분류(`test_group_id` NULL 검사 상품) 그룹은 뷰 하단에 "미분류" 헤더로 묶이되 **관리 액션 없음**(마스터가 없으므로).
- [ ] 검사군 미적재(테이블 없음/시드 전) 시 그룹 뷰가 사실상 "미분류" 한 덩어리로 graceful 폴백(회귀 0).

#### 검사명·약어 편집 다이얼로그 (자주 하는 일 — 확인 스텝 없음)
- [ ] 필드: **검사명**(`name`, required, 예 "한국판 정서-행동 평가시스템") + **약어**(`abbr`, 예 "K·BASC-3", nullable) + **정렬 순서**(`sort_order`).
- [ ] 미리보기: 편집 중인 값으로 고객 카드 접힘 상태(약어 좌상단·검사명 주인공·"옵션 N개") 실시간 렌더 — 잘림 여부 즉시 확인(PRD 목표: 검사명 잘림 0). LCP 잘림 케이스(예: KPRC "한국 아동") 여기서 직접 교정.
- [ ] 저장 = `test_groups` UPDATE. 진열 즉시 반영.

#### 옵션 순서·말머리 편집 (검사군 상세 — 자주 하는 일)
- [ ] 검사군 행 펼침 or 상세 진입 → 소속 옵션(`products`) 리스트를 `sort_order`로 표시.
- [ ] 각 옵션 행: 말머리(`option_label`)·형태명(`option_name`) 인라인 편집(TextField) + `is_common` 체크박스(공용 옵션) + 개별 `is_active` Switch(옵션 숨김) + 순서 드래그 핸들(또는 ▲▼ 버튼 — 학회 현장 아닌 사무실 작업이라 드래그 허용).
- [ ] 저장 = 각 `products` UPDATE(`option_label`·`option_name`·`is_common`·`sort_order`·`is_active`).

#### 분리 (1 검사군 → N — 위험 액션, 확인 스텝)
- [ ] 트리거: 검사군 상세에서 "분리" → 옵션 다중 선택 → "선택 N개를 새 검사군으로 분리".
- [ ] 다이얼로그: 새 검사군 검사명·약어 입력 + **"옵션 N개가 새 검사군 '{이름}'으로 이동합니다. 진열이 즉시 바뀝니다. 계속할까요?"** 확인(원칙 3 — 진열 깨는 위험 액션은 한 박자 늦게).
- [ ] 실행 = 새 `test_groups` INSERT + 선택 옵션의 `test_group_id` UPDATE. 기준 = 지침서 공용 여부(PRD §검사군 경계). 예: K-CDI 3분리, Holland 2분리, SCT 3분리, STROOP 2분리.

#### 병합 (N 검사군 → 1 — 위험 액션, 확인 스텝)
- [ ] 트리거(2026-07-02 개편): 그룹 헤더 ⋮ 메뉴 → "병합". 그 검사군이 **대표(keep)** 로 지정되고, 다이얼로그에서 **흡수할 다른 검사군을 체크박스로 다중 선택**한다(기존 "목록에서 2개 이상 체크" 방식 대체).
- [ ] 다이얼로그: 대표 검사군 표기 + 흡수 대상 목록(체크박스·검사명·약어·옵션 N) + "되돌리려면 다시 분리해야 합니다" 경고. 확정 버튼 "N개를 대표로 병합".
- [ ] 실행 = 흡수되는 검사군들의 옵션 `test_group_id`를 대표로 UPDATE + 빈 검사군 삭제(`mergeTestGroups`). 예: SCT 성인·청소년·아동을 지침서 공용 판단으로 병합.

#### 검사군 삭제 (위험 액션, 확인 스텝)
- [ ] "삭제"는 검사군 마스터만 제거. **소속 상품은 삭제하지 않고** `test_group_id`를 NULL로(평면 진열로 복귀) — 상품 데이터 보존.
- [ ] 확인: **"검사군 '{이름}'을 삭제합니다. 소속 옵션 N개는 검사군에서 풀려 낱개로 진열됩니다(상품 자체는 삭제되지 않음). 계속할까요?"**. 절판 상품은 삭제가 아니라 `is_active=false`(숨김)로 처리하도록 다이얼로그에 안내 1줄.
- [ ] ⚠️ 상품 자체 삭제는 기존 상품 표의 선택 삭제·전체 삭제(받아쓰기)로. 검사군 관리에서 상품을 지우지 않는다(혼동 방지).

> **AI 시그니처 금지 재확인:** 검사군 관리 화면에 컬러 인디케이터바·그라데이션·가짜 통계 배치 금지. 리스트+칩+다이얼로그(기존 소분류 관리·상품 표 패턴 재사용)만. theme.js 무수정·MUI 컴포넌트(Table/List·Switch·Dialog·Chip)만.

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
  - **태그 옵션 소스 = 상품태그 ∪ 학회목록(societies) 학회명** (2026-06-29). `availableTags = Set(products.tags ∪ societies.name)` 정렬. 학회 관리 탭 "학회 목록 관리" 모달(`societies` 테이블)에 등록된 학회명을 검색 편의로 항상 옵션에 노출. 어떤 상품에도 아직 태그로 안 붙은 학회명도 옵션에 뜸. societies는 `getSocieties()`(`api/events.js`)로 fetch — SocietyManagementDialog/EventManagementPage와 동일 소스. 필터·검색 동작은 기존대로(옵션 목록만 확장).

### 선택 시 액션바 (line 738-768, `selectedCount > 0` 이고 `products:edit` 권한 있을 때)
- [ ] 선택 표시: `CheckBoxIcon` + "{selectedCount}개 선택됨" (primary 색, 굵게)
- [ ] "선택 항목 편집" 버튼: outlined, `TuneIcon`
- [ ] "선택 삭제" 버튼: outlined error, `DeleteIcon`
- [ ] "선택 해제" 버튼: text 버튼

### 상품 표 (line 770-898)
- [ ] 표 컬럼(권한별): 체크박스(`products:edit` 시) / **이미지(중앙)** / 상품명 / 카테고리 / 하위 카테고리 / 가격(오른쪽 정렬) / 비고 / 상태 태그(중앙) / 태그 / 작업(`products:edit` 시)
- [ ] 행 표시 — 누락 금지:
  - 체크박스(개별)
  - **이미지 썸네일 — (2026-06-29 신규; 2026-06-29 플레이스홀더 폐기)**: 상품명 앞 컬럼. 1:1 40px(`borderRadius 1`, `objectFit cover`, `loading lazy`). `image_filename` 있으면 `getProductImageUrl`로 썸네일. **없으면/onError면 `ProductThumb`이 `return null` — 셀 비움(썸네일·플레이스홀더 미표시).** 기존 회색 박스+ImageIcon 플레이스홀더 폐기(건우님 2026-06-29). "이미지" 컬럼 자체는 유지(있는 상품만 썸네일). **대부분 미등록(NULL)이 정상.** C1 카드와 동일 정책.
  - 상품명 (`name`, fontWeight 500)
  - 카테고리 칩 (primary outlined, 라벨=`category`) — **대분류(검사/도서/도구 고정 3)**
  - 하위 카테고리 (`sub_category`, 없으면 "-") — **소분류. 동적 마스터(`subcategories`)와 이름 자연키로 연결.** **(2026-06-29 구현)** 마스터에 등록된 이름이면 마스터 색 소프트 틴트 칩(`ColorChip`), 미등록이면 회색 "· 미등록" 칩 표시(FK 안 검·운영 마찰 방지 — PRD §엣지).
  - 가격 (`list_price`, 천 단위 콤마 + "원", 굵게)
  - 비고 (`notes`, maxWidth 220, 한 줄 잘림)
  - **상태 태그 컬럼 — 누락 금지** (line 844-858):
    - "인기" 칩 (warning, `is_popular=true`일 때)
    - "신상품" 칩 (primary, `is_new=true`일 때)
    - "할인" 칩 (success 톤, `is_discountable=true`일 때)
    - ~~동적 배지~~ — **(2026-06-29 폐기)** 동적 배지 칩 제거.
    - 셋 다 false이면 "-" (caption)
  - **노출 상태 표시 — (2026-07-02 신규, is_active)**: `is_active=false`(숨김) 상품은 **행 전체를 회색 dim**(`opacity 0.55` 또는 `text.disabled` 톤)하고 상품명 옆(또는 상태 태그 컬럼 맨 앞)에 "숨김" 칩(`gray[200]` 배경 + `text.secondary`, 소프트 틴트). **`is_active=true`(노출 중)는 칩 없음**(기본 상태라 무표시 — 노이즈 방지). **숨김 상품이 표에서 사라지지 않는다**(재판매·이관 대비, PRD §절판 처리). 필터로 숨김만/노출만 보기는 별도 빠른 필터(아래 §필터 참조, 1차 선택). is_active는 검사·도서·도구 공통 전역 필드 — 검사 위계 UI에 종속되지 않는다.
  - 태그 (앞 2개 칩 + "+N" 칩으로 나머지)
  - 작업: 편집 아이콘 (`EditIcon`)
- [ ] 페이지네이션: 페이지당 항목 수 셀렉트 (10/25/50/100) + Pagination 컴포넌트

### 검사군 그룹 뷰 (검사 카테고리 = 디폴트이자 유일 뷰 · 조회+수정 — 2026-07-02 개편, 건우님 지시 1·2)
> **목적:** 인싸이트 직원이 사무실 PC에서 검사 상품 1,134행을 볼 때, C1 고객 화면과 동일한 검사군(약 214개)→옵션 2뎁스로 접어서 확인·수정. 평면 1,134행을 검사군 단위로 요약해 "이 검사에 옵션이 몇 개인지·어떻게 묶였는지"를 고객이 보는 그대로 검수하고, 같은 화면에서 검사군·옵션을 편집한다.
> **탭 분리 금지(CPO 기각).** 카드 클릭 필터(`selectedCategory`)가 카테고리 전환을 담당한다.

#### 뷰 전환 (토글 폐지 — 2026-07-02 개편)
- [ ] **`selectedCategory === '검사'`이면 무조건 그룹 뷰**(`groupViewActive = selectedCategory === '검사'`). 별도 "검사군 묶어보기" `Switch`(`groupView` state)는 **폐지**(건우님 지시 1). 검사 = 그룹 뷰, 다른 값은 평면.
- [ ] **도서·도구·전체(빈 카테고리)는 평면 표.** '전체'에서 검사 상품이 평면에 섞여 나오는 현행 유지(전체 조망용). '검사' 선택 시에만 그룹 뷰.
- [ ] **기본 접힘.** 검사군 헤더만 214행 진열, 옵션은 헤더 클릭 시 펼침. 페이지네이션은 그룹 뷰에서 숨김(헤더 전량 렌더).
- [ ] 시각: 그라데이션·컬러 인디케이터 금지(MUI `Table`/`Chip`/`Switch`만).

#### Before / After 구조 요약
- **평면 뷰(도서·도구·전체):** 상품이 평면 `Table` 행으로 나열. 검사 상품 상품명 = 원본 풀네임.
- **검사 그룹 뷰:** **검사군 그룹 헤더 행**(약 214행) + 펼침 시 그 아래 **옵션 하위 행**. C1 `TestGroupCard`와 동일한 2뎁스 위계(검사명 주인공·약어 보조·옵션 N). 평면 대비 스캔 대상 1,134→214 축소. **컬럼·표 골격 그대로**. 헤더 행 우측에 검사군 관리 액션 인라인(노출/편집/⋮).

#### 검사군 그룹 헤더 행 표기 (C1 카드와 정합)
- [ ] 헤더 행은 상품 표의 **한 `TableRow`** 로, 소속 옵션을 접었다 폈다 하는 아코디언 트리거.
  - **좌측 셀(상품명 컬럼 위치)**: ▸/▾ 펼침 아이콘 + **약어**(`test_groups.abbr`, `caption`/600/`text.secondary` — 좌측 보조 위계, 없으면 생략) + **검사명**(`test_groups.name`, `body1`/600 — 주인공, wrap) → **C1 카드 접힘 상태의 약어·검사명 위계와 동일**.
  - **"옵션 N개"**: `tgOptionCounts[group.id]` 재사용(`body2`/`text.secondary`). C1 카드의 "옵션 N개"와 동일 문구. **가격은 헤더에 미표기**(C1 검사군 카드 가격 은닉 규칙과 정합 — 헤더는 묶음 요약, 가격은 옵션 행에서만).
  - **`test_groups.is_active === false` 검사군**: 행 dim(`opacity 0.55`) + "숨김" 칩(상품 표 기존 숨김 칩과 동일 패턴 재사용).
  - 그룹 헤더 행의 좌측 요약 셀은 `colSpan`으로 중간 컬럼을 병합하고, **우측 관리 셀(`colSpan={2}`)에 검사군 단위 인라인 액션**(노출 Switch·편집·⋮ 메뉴)을 둔다(2026-07-02 개편 — 읽기 전용에서 "조회+수정"으로). 미분류(`group===null`)는 관리 셀 없음.
- [ ] 정렬: `test_groups.sort_order` → 검사명(마스터 조회 정렬 그대로). `test_group_id`가 없는(미분류) 검사 상품은 **뷰 하단에 "미분류" 그룹**으로 묶어 노출(누락 금지 — graceful).

#### 옵션 하위 행 (기존 표 컬럼 재사용)
- [ ] 그룹 헤더를 펼치면 소속 옵션(`fetchTestGroupOptions(group.id)` — **기존 API 재사용, 신규 API 금지**)이 **상품 표의 기존 컬럼 구조 그대로** 하위 행으로 나열. 즉 옵션 하위 행 = **평면 표 행과 동일한 셀 구성**(이미지·상품명·카테고리·하위카테고리·가격·비고·상태태그·태그·작업). 들여쓰기(상품명 셀 좌측 pad)로 하위 위계 표현.
  - 상품명 셀은 원본 `name` 대신 **말머리(`option_label`) + 형태명(`option_name`)** 조합 표시 권장(C1 옵션 행 정합) — 단 마스터 미정제 상품은 원본 `name` 폴백. 나머지 셀은 평면 표와 100% 동일 렌더(가격·상태칩·태그·`is_active` dim 그대로 재사용 — 별도 렌더 로직 안 만듦).
  - **작업(편집) 아이콘은 옵션 하위 행에 유지** — 개별 상품 수정(상품명·가격·태그·노출 등)은 기존 상품 편집 다이얼로그로. **말머리(`option_label`)·옵션명(`option_name`)·순서(`sort_order`)는 검사군 헤더 ⋮ 메뉴 → "옵션 편집" 다이얼로그**(기존 `tgDetail` 재사용)에서 편집.
- [ ] 페이지네이션: 그룹 뷰에서는 숨김(헤더 214개 전량 렌더). 옵션 펼침은 현재 페이지 내 아코디언.

#### 역할 분담 (2026-07-02 개편 — 별도 패널 폐지)
- [ ] **검사군 단위 편집(검사명·약어·노출·분리·병합·삭제) = 그룹 헤더 행 인라인 액션(노출 Switch·편집·⋮ 메뉴).** **옵션(상품) 단위 편집** = 헤더 ⋮ "옵션 편집"(말머리·옵션명·순서·공용·개별 노출) + 옵션 하위 행의 상품 편집 버튼(그 외 상품 필드). 검사군 조회·수정이 **'검사' 화면 하나**에 통합됨("검사군 관리"라는 별도 개념 소멸).

#### 제약 (엄수 — frontend 구현 시)
- [ ] **엑셀 흐름 = 지시 3으로 위계 열 추가**(§엑셀 컬럼 매핑 참조). 단, 단일 양식·`product_code` upsert·기존 열은 무변경.
- [ ] **신규 API 최소화.** 기존 `testGroups` 함수 재사용, 엑셀 왕복 검사군 매칭용 `makeTestGroupResolver`만 추가(내부에서 기존 `createTestGroup` 재사용). graceful: `test_group_id`/`test_groups` 미적용이면 검사군 0개 → "미분류" 한 덩어리 폴백(회귀 0).
- [ ] **theme.js 무수정 · MUI만 · AI 시그니처(그라데이션·컬러바·가짜 통계) 금지.** 기존 `Table`·`Chip`·`Switch`·`Menu` 패턴 재사용.
- [ ] 상품 표 기존 컬럼·상태칩·`is_active` dim·권한 가드(`products:view`/`products:edit`) 전부 보존.

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
- [ ] 상품 추가 다이얼로그 (line 912-947): 상품명·상품코드·카테고리·하위카테고리·가격·비고·할인가능·인기·신상품·태그
- [ ] 상품 수정 다이얼로그 (편집 아이콘 클릭, 같은 폼)
- [ ] 선택 삭제 다이얼로그 (line 937-949): "선택한 {N}개 상품을 삭제합니다" + "이 작업은 되돌릴 수 없습니다."
- [ ] 전체 삭제 다이얼로그 (line 951-975): **`"삭제합니다"` 텍스트 입력 받아쓰기 확인** (DELETE_ALL_CONFIRM_TEXT). Enter로 확정.
- [ ] 선택 항목 일괄 편집 다이얼로그 (line 977-1014):
  - 인기 상품: TriState 토글(변경 없음/ON/OFF)
  - 신상품: TriState 토글
  - 태그: 추가/덮어쓰기 모드 토글 + Autocomplete 입력
- [ ] 엑셀 양식 다운로드 (`handleDownloadTemplate`): 한국어 헤더 — 상품명·상품코드·카테고리·하위카테고리·가격·비고·할인여부·인기상품·신상품여부·태그·**이미지**. **(2026-06-29) "배지" 열 폐기.** **"이미지" 열 = `image_filename` 단일 파일명(예: `abc.webp`)** — 와박팀이 상품 엑셀에 직접 기입, `product-images` 버킷 객체 경로와 일치 전제. **"하위카테고리" 열은 기존 그대로**(이미 `sub_category` 매핑).
- [ ] 상품 목록 다운로드 (`handleDownloadExcel`): 위와 동일 컬럼(`image_filename` 그대로, 배지 열 없음)
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
- [ ] **노출 여부 Switch — (2026-07-02 신규, `is_active`)**: 플래그 체크박스 3종과 **별도 행**에 `Switch` 컴포넌트로 배치(체크박스 아님 — on/off 상태가 진열에 즉시 영향인 "전역 스위치"라 체크박스와 시각 구분). 라벨 "고객 주문서 노출" + 보조문구 `caption`/`text.secondary` "끄면 주문서에서 숨겨집니다 (데이터는 보존 — 삭제 아님)". 기본값 `true`(신규 상품은 노출). off 시 Switch 회색·라벨 옆 "숨김" 칩. **검사 위계 전용 아님** — 모든 상품(검사/도서/도구) 폼에 공통 노출.
- [ ] 태그 (`tags`, Autocomplete multiple freeSolo, `availableTags` 옵션)
- ~~배지 (`badges`)~~ — **(2026-06-29 폐기)** 동적 배지 입력 필드 제거. 고객 노출 강조는 인기/신상품 boolean 체크박스(위)로만.

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
- ~~`badges` (text[])~~ — **(2026-06-29 폐기)** 동적 배지 컬럼은 DB drop 예정. 코드 참조 0(읽기·쓰기 모두 제거).
- `image_filename` (text, nullable — **P1 신규**, DRAFT `20260619030000_DRAFT_add_products_image_filename.sql`) — `product-images` 공개 버킷 내 객체 경로(예: `abc.webp`). NULL=이미지 없음. 엑셀 "이미지" 열·일괄 업로드로 채움. **파일명 = 영문/숫자·`.`·`-`·`_`만 허용(한글·공백·특수문자 불가) — 상품코드 권장.** Storage 키 안전성 때문. graceful(컬럼 미적용 환경 회귀 0 — 빈값 payload 제외 + `PGRST204` 시 `image_filename` 빼고 재시도).
- `name` (text)
- `list_price` (numeric)
- `notes` (text, nullable)
- `is_discountable` (boolean, default false)
- `is_popular` (boolean, default false)
- `is_new` (boolean, default false)
- `is_recommend` (boolean, default false) — **마이그레이션에는 있으나 ProductManagementPage UI에 노출 안 됨, 확인 필요**
- `is_active` (boolean, default true) — **노출여부(전역 필드). (2026-07-02 UI+API 구현)** false=고객 주문서에서 숨김(절판·판매중지). **삭제 아님** — 재판매·이관 대비 데이터 보존(PRD_검사위계.md §절판 처리, K-BASC-2·K-Bayley-Ⅲ·K-WAIS-IV 등). 검사 위계 전용이 아닌 **검사/도서/도구 공통**. 상품 표 상태칩·폼 Switch로 관리. graceful: 컬럼 미적용 환경(`is_active===undefined`)은 노출로 취급 + `handleSave` PGRST204 재시도로 키 제외(회귀 0). **DRAFT 마이그레이션 `20260630020000_DRAFT_add_products_is_active.sql` 존재**(가법 컬럼, `ADD COLUMN IF NOT EXISTS`) — 건우님 적용 전이면 코드가 graceful 처리.
- `test_group_id`·`option_name`·`option_label`·`is_common`·`sort_order` (검사 위계 신규 가법 컬럼, PRD_검사위계.md) — **'검사' 그룹 뷰의 인라인 액션·옵션 편집 다이얼로그·엑셀 위계 열이 편집**. 도서·도구는 대부분 NULL. 엑셀 왕복 시 검사군 매칭(약어,검사명)→`test_group_id` 연결(`makeTestGroupResolver`).
- `tags` (text[] — 코드에서 배열 사용. 마이그레이션 SQL에는 명시 없음, 확인 필요)

### 엑셀 컬럼 매핑 (line 375-389)
- 상품명 → name
- 상품코드 → product_code
- 카테고리 → category (대분류) — **`String().trim()` 정규화 후 검사/도서/도구 중 하나여야 함. 빈값·오타·공백은 행 오류 처리(아래 §빈 상태 참조).**
- 하위카테고리 → sub_category (소분류 — **기존 매핑, 동적화에도 신규 열 불필요**)
- **이미지 → image_filename** (2026-06-29 신규, 단일 파일명 그대로). 빈값이면 payload에서 제외(미적용 환경 회귀 방지). 버킷에 실제 파일 존재 여부는 **검증 안 함** — 불일치 시 카드에서 onError 플레이스홀더(PRD §엣지, 1차 onError-only 단순화).
- 가격/정가 → list_price
- 비고 → notes
- 할인여부 → is_discountable (TRUE/Y/YES/1 → true)
- 인기상품 → is_popular
- 신상품여부 → is_new
- 태그 → tags (콤마 split)
- ~~배지 → badges~~ — **(2026-06-29 폐기)** 엑셀 "배지" 열 제거(양식·목록·파싱 3곳). category 게이트는 종전대로 행 오류 유지.
- **검사 위계 열 (2026-07-02 신규, 지시 3)** — 양식·목록·파싱 3곳 모두 추가. 검사 상품만 채움(도서·도구는 공란):
  - `검사군약어` → `test_groups.abbr` (nullable), `검사군명` → `test_groups.name`. **매칭 키 = (약어, 검사명) 조합**(`makeTestGroupResolver`, seed_hierarchy.py dedup 규칙 동일: abbr 빈값→null, name trim, 대소문자·공백 정규화). 기존 검사군 조회 후 `test_group_id` 연결, 없으면 신규 검사군 생성. **검사군명이 채워진 행만** 연결 시도.
  - `옵션명` → `option_name`, `말머리` → `option_label`, `공용(Y/공란)` → `is_common`(Y=true), `옵션정렬` → `sort_order`(정수), `노출(Y/N)` → `is_active`(N=false).
  - **빈 열 = 미변경**: 채워진 열만 payload에 포함(빈 열은 제외→기존 DB 값 보존). **구양식(위계 열 없음) 업로드해도 회귀 0.**
  - **다운로드**: 현 DB값을 채워 내보냄 — `test_group_id`를 test_groups(약어·검사명)로 조인, 옵션 필드 그대로. 운영자가 이 파일로 대량 수정 후 재업로드(왕복).
  - **graceful**: 신규 컬럼 미적용(마이그레이션 전) 환경이면 Edge Fn upsert가 컬럼 오류 → 프론트가 위계 열 빼고 1회 재시도(기존 열만 반영, 회귀 0). 컬럼 적용 시 Edge Fn이 그대로 통과(Fn 무변경).

## 필터·뷰 모드

- 검색어 (상품명 부분 일치)
- 카테고리 단일 선택 (도서/검사/도구) — 카드 클릭으로 토글
- **검사군 그룹 뷰 (2026-07-02 개편)**: `selectedCategory==='검사'`이면 **무조건 그룹 뷰**(토글 폐지, `groupViewActive = selectedCategory==='검사'`). 도서·도구·전체는 평면. 그룹 뷰 = 조회+수정(검사군·옵션 인라인 관리), 페이지네이션 숨김. §검사군 그룹 뷰 절 참조.
- 빠른 필터: discountable | popular | null
- **노출 필터 — (2026-07-02 신규, 1차 선택)**: `productQuickFilter`에 `hidden`(숨김만) 추가 검토, 또는 검색·필터 카드에 "숨김 포함 N개" 표시 + 별도 토글. **기본은 전체 노출**(숨김 상품도 표에 보임 — dim+칩으로 구분). 운영자가 "숨김 상품만 모아보기"를 원할 때만 필터. **구현 우선순위 낮음** — is_active 상태칩·폼 Switch가 P0, 필터는 P1.
- 태그 다중 선택 (OR 매칭)
- 정렬: 인기 우선 → 이름 가나다순(고정, 사용자 선택 없음)
- 페이지당 항목 수: 10/25/50/100 (기본 50)

## 빈 상태·로딩·오류 처리

- 로딩: `TableSkeleton rows=10 columns={products:edit ? 10 : 9}` (이미지 컬럼 추가로 +1)
- 빈 상태(필터 결과 없음): `EmptyState` — "검색 결과가 없습니다" + "다른 검색어나 필터를 시도해 보세요" + "필터 초기화" 액션
- 빈 상태(상품 미등록): "등록된 상품이 없습니다" + "새 상품을 추가해 시작하세요" + "상품 추가" 액션 (`products:edit` 권한 있을 때만)
- 오류: 토스트(`addNotification`) 처리, 화면 안에 잔류 알림 없음
- 엑셀 업로드 오류: 진행 다이얼로그 내 오류 표(행/상품코드/상품명/사유) + "오류 내역 복사" 액션
- **이미지 일괄 업로드 진행/결과 다이얼로그(2026-06-29 신규):** `LinearProgress`(현재/전체) + 실패 파일 목록(파일명: 사유, error 색) + 하단 안내 1줄("권장: 파일명을 상품코드로(영문/숫자). 한글·공백·특수문자 파일명은 업로드되지 않습니다."). 업로드 중 닫기 차단(`disableEscapeKeyDown`). 완료 후 "닫기". 토스트로 성공/실패 건수 요약. **파일명 형식 위반(한글·공백·특수문자)은 업로드 시도 없이 실패목록에 사유 기록** — 운영자 즉시 인지(2026-06-29 보강).
  - 사전 검증 사유: "상품코드 필수" / "상품명 필수" / **"카테고리는 검사/도서/도구만 허용"**(2026-06-24 신설 게이트 — 빈값·오타·공백 행을 오류 처리, 정상 행만 upsert) / "엑셀 내 중복" + 서버 측 오류

## 핵심 발견 (시안 검수 시 반드시 확인)

1. **대분류 3종은 도서/검사/도구(고정).** "도구"가 빠지거나 통합되면 안 됨. **대분류는 필수**(2026-06-24): 폼은 Select로 미선택 저장 차단, 엑셀은 검사/도서/도구 외 행을 오류 처리. 미분류 매출(회계 누락)을 입력단에서 원천 차단. (서버 측 2중 방어: DRAFT `20260624010000_DRAFT_products_category_constraint.sql`의 NOT NULL+CHECK — backend 소관, 건우님 승인 후 적용.) **도구-검사 매출 합산 정책은 PRD에서 영구 폐지(3버킷)** — 단, 그 변경은 DashboardPage·revenueByCategory 소관이고 본 화면 통계 카드는 이미 도구를 독립 카운트로 표시 중. (FulfillmentPage의 "도구→검사" 정규화는 출고 화면 한정 규칙이며 본 PRD와 별개 — 혼동 주의.)
9. **(P1) 소분류는 노출 전용·매출 미참여.** `sub_category`를 마스터로 동적화해도 **매출 집계(revenueByCategory)는 `category`만 참조** — 소분류 변경이 합계에 영향 0이어야 함. 소분류를 카운트/집계 축으로 끌어들이지 말 것.
10. **(P1) 소분류는 이름 자연키 연결(FK 없음).** 엑셀 호환을 위해 무결성을 DB FK가 아닌 UI 경고("미등록" 회색)로 처리. 시안/구현이 미등록 값을 막거나 업로드를 reject하면 안 됨(운영 마찰 방지 — PRD §엣지).
11. ~~배지는 boolean 플래그와 공존~~ — **(2026-06-29 폐기)** 동적 배지 제거. 인기/신상품 boolean은 그대로 유지.
12. ~~어드민 표는 배지 전량 노출~~ — **(2026-06-29 폐기)** 동적 배지 제거.
15. **(2026-06-29) 동적 배지 기능 폐기 — 인기/신상품·소분류는 유지.** 배지 마스터 CRUD·폼 칩 토글·표 동적 배지·엑셀 "배지" 열·`products.badges` 코드 참조 전부 제거(grep 0). `is_popular`/`is_new` boolean(카드 칩·폼 체크박스·표 상태태그·엑셀 인기/신상품 열)·소분류 마스터·상품 이미지·태그는 그대로. `products.badges` 컬럼은 DB drop 예정이며 drop 후에도 코드 에러 0.
14. **(2026-06-29) 상품 이미지는 파일명 자연 매칭·버킷 실존 검증 없음.** `image_filename`(엑셀 "이미지" 열)과 `product-images` 버킷 파일명이 일치해야 카드에 뜸. 업로드 시 버킷 실존 검증 안 함 — 불일치/누락은 카드·표에서 **슬롯/썸네일 미렌더**로 graceful 처리(1차 onError-only). 와박팀이 엑셀과 파일명을 맞추는 운영 약속이 전제. 시안·구현이 미일치 값을 reject하면 안 됨(운영 마찰 방지). **대부분 미등록(NULL)이 정상** — 이미지 없으면 슬롯/썸네일 자체를 미표시(플레이스홀더 폐기, 2026-06-29 건우님). **단, 일괄 업로드 시 파일명 형식만은 검증함**(2026-06-29 보강): 영문/숫자·`.`·`-`·`_` 외(한글·공백·특수문자) 파일은 Storage 키가 깨지므로 업로드 시도 없이 실패목록에 기록("파일명에 한글·공백·특수문자 불가 — 영문/숫자 파일명 권장"). 정상 파일만 업로드. 버킷 실존 검증과는 별개(전자는 형식, 후자는 매칭).
13. ~~"최대 2개"는 표출 정책~~ — **(2026-06-29 폐기)** 동적 배지 제거. ProductCard는 인기/신상품 boolean 칩만 표시.
2. **상태 태그 3종(인기·신상품·할인)은 표 안에서 한 컬럼에 모인다.** 시안이 한 종만 보여주면 운영자는 다른 두 플래그를 못 본다.
3. **폼의 플래그 3종은 별도 체크박스.** 하나의 토글이나 셀렉트로 통합 금지.
4. **카테고리·하위 카테고리는 별도 필드.** 가로 배치이지만 입력은 두 칸으로 분리됨.
5. **태그·하위카테고리·notes는 nullable.** 시안에서 항상 값이 있는 것처럼 그리면 빈 상태 처리가 빠진다.
6. **전체 삭제는 받아쓰기 확인 ("삭제합니다") + 위험한 액션 색 처리.** 자주 하는 일과 다른 모양·색·위치 원칙(01 원칙 3).
7. **통계 카드 6장이 일렬로 배치.** 시안이 3장만 보여주면 카테고리 카드 3종이 사라진다.
8. **그라데이션 배경은 현재 코드에 있지만 신 디자인 시스템에서는 제거 대상(CLAUDE.md E항).** 시안에서 그라데이션을 유지하지 말 것.

## 변경 이력

- 2026-07-03 **페이지 렌더 성능 최적화 (실 코드 변경 — frontend-engineer, 건우님 실동작 피드백 2건 동일 근본원인)**. 증상: (1) 검색 debounce 250ms 딜레이 답답(오타 수정 시 결과 지연), (2) 모든 탭(전체/할인/인기/검사/도서/도구) 전환마다 렉. 원인: 2,300줄 단일 컴포넌트라 state 변경마다 상품 표 전량 재렌더 + 상품 행이 memo 안 돼 안 바뀐 행까지 다시 그림. **수정(정보 구조·기능·필드 전부 불변, memo/useCallback 외과 도입):** (1) 상품 행을 `ProductRow` `React.memo` 컴포넌트로 추출(컴포넌트 밖 top-level) — 평면 행과 검사군 옵션 하위 행이 공유(props `isOption`으로 상품명 셀만 분기: 평면=`product.name`, 옵션=말머리+형태명+`pl:4` 들여쓰기). `renderProductCells`도 top-level 순수 함수로 이동해 `ProductRow` 내부 흡수 — memo 대상이 셀 전체(카테고리·소분류칩·가격·비고·상태칩·태그·편집버튼) 포함해야 skip이 온전. props(`product`·`selected`·`canEdit`·`isOption`·`subColorByName`·`theme`·`onToggle`·`onEdit`) 동일 시 재렌더 skip. (2) `ProductThumb`를 `React.memo`로 — `filename`·`name` 같으면 이미지 셀 재렌더 skip. (3) 핸들러 `useCallback` 안정화(`handleOpen`·`handleToggleOne`·`handleToggleGroupExpand`) — 참조 고정으로 memo 효과 유지. `subColorByName`(useMemo)·`theme`(useTheme)는 이미 안정. **skip 근거:** `filteredProducts`가 `[...list].sort()`로 새 배열을 만들어도 개별 상품 객체는 `allProducts` 원본 참조 유지 → 탭 전환·검색 시 표시되는 행 중 동일 객체는 얕은 비교 통과로 재렌더 skip. (4) A6 `ProductSearchBar delay={60}`(250→60ms) — 렌더가 가벼워져 오타 수정 타이핑 매끄럽고 결과 즉시 반영. **C1(`ProductSelectionStep.jsx`)의 `ProductSearchBar`는 무변경(`delay` 미지정=기본 250ms 유지) — C1은 렉 없어 현행 유지.** 통계 카드·필터바는 이미 useMemo(`totalDiscountableCount`·`totalPopularCount`·`categoryCounts`·`availableTags`)라 추가 조치 불요(과잉 최적화 방어). **기능 전부 불변(개별 수정·엑셀 다운로드/업로드·검사군 인라인 관리·is_active·페이지네이션·권한 가드·검사군 묶어보기 뷰)·order_items 불변·theme.js 무수정·MUI만·AI 시그니처 없음.** 검증: `npm run lint`(변경 파일 신규 위반 0, 기존 send-alimtalk 9에러 무관)·`npm run build` 통과·`vitest` 113 passed 유지.
- 2026-07-02 **검사 위계 통합 개편 3건 (실 코드 변경 — frontend-engineer, 건우님 최종 지시)**. **[지시 1]** "검사군 묶어보기" 토글(`groupView` state·`Switch`·조건부 렌더) 제거 — `groupViewActive = selectedCategory==='검사'`로 단순화(검사=무조건 그룹 뷰, 디폴트이자 유일 뷰). 도서·도구·전체 평면 유지, 전체에서 검사 평면 혼재 유지, 그룹 뷰 페이지네이션 숨김. **[지시 2]** 헤더 "검사군 관리" 토글 버튼·`tgPanelOpen` state·Collapse 패널(목록 Table·툴바·검색) 전량 제거. 기능을 그룹 헤더 행에 인라인 흡수 — 헤더 우측 관리 셀(`colSpan={2}`, `products:edit`, stopPropagation): is_active `Switch`(`handleToggleTgActive`)·편집 `IconButton`(→ 기존 `tgDialog`)·⋮ `Menu`(`MoreVertIcon`) 4항목[옵션 편집(→`handleOpenTgDetail`)·분리(→detail 후 `handleOpenSplit`)·병합·삭제]. 병합 재설계: 헤더에서 대표(keep) 지정→다이얼로그에서 흡수 대상 다중 선택(`tgMergeKeep`·`tgMergeAbsorb`, 기존 `mergeTestGroups(keepId,[keep,...absorb])`). "검사군 추가"는 검사 뷰 필터 바에 outlined 버튼으로 이동. 삭제·분리·옵션 편집 다이얼로그는 **기존 컴포넌트 그대로 재사용**(진입점만 이동, 대규모 재작성 없음). 미분류 그룹은 관리 액션 없음. **[지시 3]** 엑셀 다운로드/양식/파싱 3곳에 위계 7열(`검사군약어`·`검사군명`·`옵션명`·`말머리`·`공용(Y/공란)`·`옵션정렬`·`노출(Y/N)`) 추가. 다운로드=`fetchTestGroups` 조인으로 현 DB값 채움. 업로드=Phase 2.5에서 `makeTestGroupResolver`(신규, `api/testGroups.js` — 기존 `createTestGroup` 재사용·세션 캐시·(약어,검사명) dedup, seed_hierarchy.py 규칙 동일)로 `test_group_id` 해결(없으면 생성), 채워진 열만 `option_name`·`option_label`·`is_common`·`sort_order`·`is_active`에 반영(빈 열=미변경→구양식 회귀 0). Edge Fn 무변경(컬럼 있으면 통과) + 컬럼 미적용 환경 graceful(위계 열 빼고 1회 재시도, `data.errors`의 컬럼 오류도 감지). 기존 열·`product_code` upsert·category 게이트 무변경. **theme.js 무수정·MUI만·AI 시그니처 없음·권한 가드 보존·order_items 불변.** 검증: `npm run lint`(변경 파일 신규 위반 0, 기존 send-alimtalk 9에러 무관)·`npm run build`·`vitest` 113 passed 유지. 상단 요약·§검사군 관리=그룹 뷰 인라인·§검사군 그룹 뷰·§엑셀 컬럼 매핑·§필터·뷰 모드·데이터 모델 갱신.
- 2026-07-02 **검사군 묶어보기 뷰 사양 추가 (사양만 갱신, 실 코드 미변경 — product-designer)**. A6 §상품 표에 "검사군 묶어보기 뷰(검사 카테고리 한정·토글·읽기 진열)" 절 신설 + §필터·뷰 모드에 뷰 항목 추가. (1) **토글**: `selectedCategory==='검사'`일 때만 뜨는 MUI `Switch` "검사군 묶어보기"(신규 state `groupView` bool, 기본 off). 도서·도구 선택 시 숨김. off=현행 평면 표(회귀 0). (2) **그룹 헤더 행**: 약어(`test_groups.abbr` 보조)+검사명(`name` 주인공)+"옵션 N개"(`tgOptionCounts` 재사용)로 C1 `TestGroupCard` 접힘 상태와 정합, 가격 은닉, `is_active=false` 검사군 dim+숨김 칩. (3) **옵션 하위 행**: 펼치면 `fetchTestGroupOptions`(기존 API) 소속 옵션을 상품 표 기존 컬럼 구조 그대로 하위 행 진열(말머리+형태명 상품명 셀, 나머지 셀·가격·상태칩·is_active dim 재사용). 개별 상품 편집 버튼 유지(검사군 구조 편집 아님). (4) **역할 분담**: 뷰=읽기 진열, 검사군 관리 패널(`tgPanelOpen`)=편집(분리·병합·명명·옵션순서·삭제) 유일 소스. (5) **제약**: 탭 분리 금지(CPO 기각), 엑셀 흐름 무변경(단일 양식·product_code upsert), 신규 API 금지, theme.js 무수정·MUI만·AI 시그니처 금지, 기존 컬럼/상태칩/페이지네이션/권한 가드 보존, graceful(검사군 미적용 시 평면 폴백). 미반영(frontend 결정 필요): 그룹 헤더 행 colSpan 병합 방식·미분류 검사 상품 배치·페이지네이션 단위(헤더 214 기준)·펼침 아코디언 구현(Collapse vs 행 삽입).
- 2026-07-02 **검사 위계 실 구현 — is_active 토글 + 검사군 관리 화면 (실 코드 변경 — frontend-engineer)**. (1) **is_active(노출여부)**: 상품 표 `TableRow` `opacity: is_active===false ? 0.55 : 1`(dim), 상태 태그 컬럼 맨 앞 "숨김" 칩(`theme.gray[200]` 배경 + `text.secondary`, `is_active===false`만 표시 — 노출 중은 무표시, `-` 폴백 조건도 `is_active!==false` 게이트). 상품 폼 플래그 체크박스 3종 뒤 별도 행에 "고객 주문서 노출" `Switch`(`checked={is_active!==false}`, 기본 노출, off 시 "숨김" 칩·보조문구 "끄면 주문서에서 숨겨집니다 (데이터는 보존 — 삭제 아님)"). `createEmptyProduct`에 `is_active: true`. `handleSave` mutate의 PGRST204 재시도 게이트에 `is_active` 포함(image_filename과 함께 delete 후 재시도) — 컬럼 미적용 환경 graceful. 숨김 상품 표 잔류. 검사/도서/도구 공통(검사 위계 UI 비종속). (2) **검사군 관리**: 헤더 액션부 "검사군 관리" 토글(`AccountTreeIcon`, `products:edit`) → Collapse `SectionCard`(padding 0). 툴바(검사군 추가 contained·병합 outlined error·검색 TextField) + 목록 `Table`(체크박스·약어 caption·검사명 body1/600·옵션N·is_active Switch·편집·삭제, `is_active=false` 행 dim+"· 숨김"). 빈 상태 메시지. 검사명·약어 편집 다이얼로그(검사명·약어·정렬 + 미리보기 고객 카드 접힘). 옵션 상세 다이얼로그(말머리·형태명 TextField·공용 Checkbox·개별 is_active Switch·▲▼ 순서 이동, 상단 분리 버튼, 저장 시 각 상품 `updateProductOption`으로 sort_order=index 재기입). 분리 다이얼로그(새 검사군 검사명·약어 + 옵션 다중선택, 확인 문구). 병합 다이얼로그(대표 검사군 선택 Checkbox·옵션 합계·되돌림 경고). 삭제 확인(소속 옵션 낱개 복귀·절판은 숨김 권고 안내). 편집=즉시, 분리/병합/삭제=확인 스텝. `loadTestGroups`로 마운트·CRUD 후 로드. API `src/api/testGroups.js` 신설(모두 api 계층 경유, 직접 supabase 호출은 api 파일 내부만). (3) **graceful**: 테이블·컬럼 미적용(42P01·PGRST204·PGRST205) 시 빈 목록/무동작 → 화면 회귀 0. (4) **미확정 처리**: 검사군 단위 is_active 토글은 **검사군 카드 노출(test_groups.is_active)만** 토글하고 소속 옵션 일괄 전파는 안 함 — `handleToggleTgActive`에 TODO 주석 + 사양 §검사군 목록 "확인 필요" 유지(backend·건우님 검수). 노출 필터(P1)는 미구현(사양 P1 우선순위 낮음 그대로). **theme.js 무수정·MUI만·AI 시그니처 없음.** 검증: `npx eslint`(변경 파일 위반 0)·`vite build` 통과.
- 2026-07-02 **검사 위계 시안 — is_active 토글 + 검사군 관리 화면 (사양만 갱신, 실 코드 미변경 — product-designer)**. PRD_검사위계.md 흐름 B(보정 UI 전체 구현) + is_active(노출여부) 전역 필드 UI. (1) **상품 표**: 상태 태그 컬럼에 "숨김" 칩(`is_active=false`, `gray[200]` 소프트 틴트) + 행 dim, 노출 중은 무표시. 숨김 상품이 표에서 사라지지 않음(재판매·이관 대비). (2) **상품 폼**: 플래그 체크박스 3종과 별도 행에 "고객 주문서 노출" `Switch`(체크박스 아님 — 진열 즉영향 전역 스위치) + 보조문구. 기본 true. (3) **검사군 관리 화면**(헤더 "검사군 관리" 토글 패널 or 서브탭, `products:edit`): 검사군 목록(약어·검사명·옵션N·is_active Switch·편집·삭제) + 검사명/약어 편집 다이얼로그(미리보기로 잘림 확인) + 옵션 순서·말머리·is_common·개별 is_active 편집 + 분리(1→N)·병합(N→1)·삭제 위험 액션 확인 스텝. 즉시저장 아님(위험도 높아 저장+확인). 삭제는 검사군 마스터만 제거(상품은 test_group_id NULL로 보존). (4) 데이터 모델에 `is_active`·검사 위계 5컬럼 명시(⚠️ 실 마이그레이션 존재 여부 backend 확인 필요). (5) 노출 필터는 P1(1차 선택). **단어 권고**: "노출 중"/"숨김"(중립·데이터 보존 뉘앙스, "판매중지"보다 정합). **AI 시그니처 금지·theme.js 무수정·MUI 유지.** 미반영: is_active 실 마이그레이션·검사군 단위 is_active 토글 범위·노출 필터 구현 우선순위(전부 backend·건우님 검수 대상으로 명시). C1 시트 동시 갱신.
- 2026-06-29 **동적 배지 기능 폐기 — 인기/신상품·소분류는 유지 (실 코드 변경, 건우님 결정)**. (제거) 배지 마스터 CRUD 패널(SectionCard)·다이얼로그·`handleSaveBadge`/`handleDeleteBadge`/`handleToggleBadgeActive`·`badgeDialog`/`badgeMaster`/`customBadgeInput` state·`badgeOptions`/`badgeColorByName`/`badgePriorityByName` memo·`handleToggleBadge`/`handleAddCustomBadge`, 상품 폼 배지 칩 토글 블록, 표 동적 배지 칩 map, 엑셀 "배지" 열(양식·목록·파싱 3곳)·`badgeWarnings`·`CARD_BADGE_LIMIT`, `createEmptyProduct.badges`, `handleSave`/엑셀 payload의 `badges` 처리, `api/masters.js`의 `fetchBadges`/`createBadge`/`updateBadge`/`deleteBadge`·`fetchMasterUsageCounts`의 badgeCounts. `BadgeChip`→`ColorChip` 리네임(소분류 표시 재사용처만 잔존). 헤더 토글 "소분류·배지 관리"→"소분류 관리". 미사용 import(`SellIcon`·`Alert`) 정리. (유지) `is_popular`/`is_new` boolean — 카드 칩·폼 체크박스·표 상태태그·엑셀 인기/신상품 열 전부 그대로. 소분류 마스터·상품 이미지·태그·카테고리 그대로. `products.badges` 코드 참조 0(grep 확인, drop 후 에러 0). C1/A8 시트 동시 갱신. **검증**: lint(변경 파일 신규 위반 0, 기존 send-alimtalk 9에러 무관)·vite build 통과. theme.js 무수정.
- 2026-06-29 **상품 표 썸네일 플레이스홀더 폐기 (실 코드 변경, 건우님 결정)**. `ProductManagementPage.jsx` `ProductThumb` — `getProductImageUrl(filename)`이 null이거나 `onError`면 `return null`(셀 비움). 기존 회색 박스(`grey.100`) + `ImageIcon`(18px) 플레이스홀더 코드·`show` 분기 제거, `ImageIcon` import 삭제. "이미지" 컬럼 헤더·colSpan/columns 카운트는 유지(있는 상품만 썸네일). C1 `ProductCard` 슬롯과 동형 정책(이미지 없으면 미렌더). **혼재 처리 로직 추가 안 함(오버엔지니어링 방어), theme.js 무수정, AI 시그니처 없음.** **검증**: lint(변경 파일 신규 위반 0, 기존 send-alimtalk 9에러 무관)·vite build 통과. §표 썸네일·마지막 갱신·핵심 발견 14 갱신.
- 2026-06-29 **상품 이미지 블로커 보강 (실 코드 변경, CTO 검수 후속)**. (A graceful) `handleSave`가 `badges`만 `PGRST204` 재시도하고 `image_filename`은 미대응이던 결함 보강 — payload에서 빈 `image_filename`(''·null·undefined) delete + `PGRST204` 재시도 대상에 `image_filename` 포함(`'badges' in data || 'image_filename' in data` 게이트, 두 키 동시 delete 후 재시도). 컬럼 미적용 환경에서 image_filename 키가 섞여도 전건 실패 안 하고 해당 키만 빠진 채 통과. (B 파일명 검증) `handleImageUpload`가 `upload(file.name)` 그대로라 한글·공백·특수문자 파일명이면 Storage 키가 깨지던 결함 보강 — 모듈 상수 `SAFE_IMAGE_FILENAME = /^[A-Za-z0-9._-]+$/`로 업로드 전 검증, 위반 파일은 업로드 시도 없이 실패목록에 `{ ok:false, error:'파일명에 한글·공백·특수문자 불가 — 영문/숫자 파일명 권장' }` 기록(운영자 즉시 인지), 정상 파일만 `uploadProductImage` 호출. (C 안내) 업로드 버튼 툴팁 + 결과 다이얼로그 하단에 "권장: 파일명을 상품코드로(영문/숫자)" 1줄. `productImages.js` api 경유 유지, 기존 graceful 패턴(빈값 delete + PGRST204 재시도) 답습, MUI 토큰, 다른 로직 무변경. 데이터 모델 image_filename·핵심 발견 14·일괄 업로드 다이얼로그 절 갱신.
- 2026-06-29 **상품 이미지 기능 구현 (실 코드 변경, PRD `DOCS/PRD_상품이미지.md`)**. (1) **이미지 일괄 업로드 UI**: 헤더 액션부 `PhotoLibraryIcon` 버튼(`products:edit`) → `<input multiple accept=image/*>` → 각 파일 `uploadProductImage`(`product-images` 공개 버킷, 파일명 그대로·`upsert:true`). 순차 업로드·`LinearProgress`·실패목록 다이얼로그·토스트 요약. (2) **상품 표 "이미지" 썸네일 컬럼**: 상품명 앞, `ProductThumb`(40px 1:1, 미등록/onError `ImageIcon` 플레이스홀더). colSpan/columns 9→10(edit)·8→9(view). (3) **엑셀 "이미지" 열**: `handleDownloadTemplate`·`handleDownloadExcel`·`handleFileUpload` 파싱 3곳 `image_filename` 매핑(tags/badges 패턴 복제), 빈값 payload 제외(미적용 회귀 방지). category 게이트·기존 검증 무변경. (4) **API**: `src/api/productImages.js` 신설(`getProductImageUrl`=`getPublicUrl`·`uploadProductImage`·`PRODUCT_IMAGE_BUCKET`). (5) **graceful**: 버킷·`image_filename` 컬럼 미적용 환경 회귀 0(URL null→플레이스홀더, payload에서 빈 image_filename 제외). theme.js 무수정·AI 시그니처 없음. C1 카드 이미지 슬롯과 동일 정책. 핵심 발견 14 신설.
- 2026-06-29 **마스터 CRUD를 SettingsPage→상품관리로 이동 + 배지 입력 칩 체크박스 + 엑셀 배지 경고 (실 코드 변경, 건우님 확정 #1·#2)**. (A 이동) SettingsPage의 소분류·배지 마스터 블록 2개·다이얼로그 2개·관련 state/핸들러(`handleSaveSub`/`handleDeleteSub`/`handleToggleSubActive`/배지 동형)·import(masters API·`ColorPresetPicker`·`MASTER_COLOR_PRESETS`)를 ProductManagementPage로 이동. 헤더 액션부 "소분류·배지 관리" 토글 버튼 → 헤더 아래 Collapse 패널(SectionCard 2개 가로 flexWrap). 즉시저장·삭제가드(사용중 disabled+경고)·is_active Switch 보존. 마스터 fetch는 `loadMasters`로 통합(subcategories·badges·usage 동시, CRUD 후 재호출). 권한 가드 `products:edit`. SettingsPage엔 "소분류·배지는 상품 관리 화면에서 관리합니다" 안내 Alert 1줄 + 마스터 관련 코드 전량 제거. (B 칩 체크박스) 상품 폼 배지 = `Autocomplete multiple freeSolo` → 마스터 활성 배지 Chip 토글 그룹(flexWrap, 선택=소프트틴트 채움/미선택=outlined). **무제한 선택**, 3개째부터 회색 helperText "고객 카드엔 우선순위 상위 2개만 노출됩니다". 미등록 기존 배지도 토글 노출(손실 방지), "직접 추가" TextField+버튼(Enter)으로 freeSolo 보존. (C 엑셀) `handleFileUpload` 검증 루프에 배지>2 경고(`badgeWarnings` → `uploadLog` push), **행 오류 아님·upsert 통과**. category 게이트 유지. (원칙) "최대 2개"=표출 정책(고객 카드 한정), 입력단 무제한. ProductCard 상한2 미변경. theme.js 무수정. §발견 13 신설.
- 2026-06-29 **태그 검색 옵션에 학회 목록(societies) 학회명 포함 (실 코드 변경, 건우님 피드백 #3)**. (1) `availableTags`를 기존 `products.tags` 추출분 + `societies.name` **합집합**(중복 제거·정렬)으로 확장 — 학회 관리 탭 "학회 목록 관리" 모달에 등록된 학회명이 태그 옵션에 전부 노출. 기존엔 상품 태그에 실제로 붙은 값만 떠서 신규 등록 학회명이 안 보이던 문제 해결. (2) societies fetch는 **신규 API 안 만들고** `api/events.js`에 `getSocieties()` 추가(SocietyManagementDialog·EventManagementPage가 직접 `supabase.from('societies')` 호출하던 패턴을 api 계층으로 정리 — CLAUDE.md "api 계층 경유" 준수). `ProductManagementPage`에 `societies` state + 마운트 시 fetch(graceful `.catch(() => {})`). (3) 태그 칩 필터·검색 동작·다른 로직 무변경(옵션 소스만 확장). 검색·필터 카드 절에 옵션 소스 명시.
- 2026-06-29 **소분류·배지 마스터 소비 실 코드 구현 (P1)**. (1) **상품 폼**: 하위 카테고리 자유 텍스트 → `Autocomplete freeSolo`(옵션=소분류 마스터 중 현재 폼 대분류에 소속·`is_active=true`인 이름만 필터). 미등록 입력 시 회색 helperText 경고. 배지 = `Autocomplete multiple freeSolo`(옵션=배지 마스터 활성 이름) 신규 필드(태그와 별도). 미등록 배지 입력 시 회색 칩 "· 미등록". boolean 플래그(인기/신상품/할인)와 공존. `createEmptyProduct`에 `badges: []` 추가. (2) **상품 표**: 하위 카테고리 = 소분류 마스터 색 소프트 틴트 칩(미등록 회색 "· 미등록"). 상태 태그 컬럼에 동적 배지 추가 — 우선순위(`badges.priority`) 정렬, 어드민 **전량 노출**(C1 최대 2개 가드 미적용, §발견 12), 미등록 회색. boolean 칩과 공존, 셋 다 false+배지 0이면 "-". (3) **엑셀**: 양식·목록 다운로드에 "배지" 열(`badges.join(',')`) 추가, 업로드 파싱에 배지 열(콤마 split, tags 패턴 복제). 소분류는 기존 "하위카테고리" 열 그대로. (4) **회귀 방어(graceful)**: products.badges 컬럼 미존재(마이그레이션 미적용) 시 — 폼 저장은 빈 badges 제외 + `PGRST204` 감지 시 badges 빼고 재시도, 엑셀 업로드는 빈 badges 제외, 마스터 fetch는 테이블 없으면 빈 배열 → 기존 자유입력 동작 보존. (5) 색·칩 토큰은 `MASTER_COLOR_FALLBACK`(A8 신설). 핵심 발견 9~12 충족. 마스터 CRUD UI 자체는 A8 소관(본 화면은 소비). **C1 고객 카드 배지 칩은 별도 트랙(미구현).**
- 2026-06-24 **대분류(category) 필수화 구현 (실 코드 변경)**. (1) **상품 폼**: 카테고리 자유 텍스트 `TextField` → 필수 `Select`(검사/도서/도구). `categoryInvalid` 상태 + `FormControl error`, `handleSave`에서 `categories.includes` 미충족 시 차단·경고 토스트. createEmptyProduct의 빈 category도 저장 차단. (2) **엑셀 업로드**: 매핑부 `category`를 `String().trim()` 정규화, 사전 검증 루프에 게이트 추가 — `categories.includes` false면 사유 "카테고리는 검사/도서/도구만 허용"으로 오류 표에 push·continue, 정상 행만 upsert. 기존 오류 표 구조 `{행,상품코드,상품명,사유}` 그대로. (3) `revenueByCategory.js` unclassified 콘솔 경고 유지(잔여 방어). (4) 동일 파일 사전 부채(`_rowNum` no-unused-vars) 정리. **하위카테고리·배지 동적화(P1)·다른 폼 필드 무변경.** 핵심 발견 1 갱신, 데이터 모델/엑셀 매핑/빈 상태 절에 게이트 명시.
- 2026-06-24 카테고리·배지 동적화 PRD 반영 (`DOCS/PRD_오티즘_카테고리배지_동적화.md`, P1 트랙·기획 단계) — **사양만 갱신, 실 코드 미변경.** (1) **대분류 고정 3(검사/도서/도구) + 소분류(`sub_category`) 동적 마스터(`subcategories`) 연동** 명시. 도구-검사 합산 폐지 정책 주석(매출 소관은 Dashboard). (2) **상태 태그 컬럼에 동적 배지(`products.badges` text[], 마스터 `badges`) 공존** — boolean 인기/신상품/할인과 병존, 미등록 회색, 어드민은 전량 노출. (3) **상품 폼**: 카테고리=대분류 Select·하위카테고리=소분류 마스터 Autocomplete 전환 검토, 배지 멀티선택 필드 신규(별도). (4) **엑셀**: "배지" 열 1개 추가(10→11컬럼), 소분류는 기존 "하위카테고리" 열 그대로(신규 열 불필요). 매핑·양식·목록 3곳 동일 추가. (5) 데이터 모델에 `products.badges`·소분류 자연키 추가. 핵심 발견 9~12(노출 전용·자연키·boolean 공존·전량 노출) 신설. 라인 번호 1137→1149 갱신. **소분류·배지 마스터 CRUD UI 자체는 A8 시트 소관.**
- 2026-05-13 신설.
- 2026-05-28 (M3-2): 실 페이지 시안 디자인 시스템 정합. 그라데이션 카드 6장 → border 기반 QuickFilterCard로 교체. PageHeader · SectionCard · ActionSlot · ui/EmptyState 합성 컴포넌트 적용. 모달 영역(line 903~1135) · 비즈니스 로직 · 권한 가드 · 받아쓰기 모달 · 엑셀 업·다운로드 전부 보존. 자동 검출 5종 본문 신규 위반 0.
