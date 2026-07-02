# 검사 위계 빌드 툴

상품 목록 엑셀 → **검사군 / 옵션명 / 말머리**를 규칙 기반으로 자동 생성해 `상품매핑.xlsx`·`검사군마스터.xlsx`를 만든다. (검사 위계 2뎁스 진열의 DB 시드 원본)

관련 기획: `DOCS/PRD_검사위계.md`

## build_hierarchy.py

### 사용법
1. 스크립트 상단 경로 상수(`SRC`, `OUT_MASTER`, `OUT_MAP`)를 본인 환경에 맞게 수정.
2. `pip install openpyxl` 후 `python scripts/build_hierarchy.py` 실행.
3. 산출 `상품매핑.xlsx`를 검토·수기 완성 → DB 적재.

### 규칙 체계
- **검사군 키** = 상품명 첫 단어. **검사명** = 같은 검사군 상품명들의 공통접두(LCP)에서 약어 제거.
- **옵션명** = 형태만(SET·검사지·온라인코드·지침서·카드 등). **연령·월령·대상·보고형은 말머리**(`AT_PAT`)로 분리.
- **괄호 정제**: `(약어: 형태)`→형태 / `(...공용...)`은 지침서 적용범위라 보존.
- **특이건 오버라이드**(코드와 분리된 config, 신규 상품 생기면 여기만 수정):
  - `OVERRIDES`: 분리(split)/병합(merge)/검사명(name)/약어(abbr)/삭제(delete)
  - `SHARED_OPTIONS`: 공용 옵션 복제 노출 (현재 미사용 — 각 검사군이 자체 지침서 보유)
  - `EXCLUDE_CODES`: 위계 제외(중복 도서 등)
  - `OPTION_OVERRIDE`: 옵션명 개별 예외(BGT-Ⅱ 등)

### ⚠️ 중요 — 단일 소스는 상품매핑.xlsx
운영자 수기 완성분(**Holland 2분리 · CATA 표기통일 · KPRC** 등)은 규칙에 없어, **build를 재실행하면 덮어써진다.** 확정된 `상품매핑.xlsx`가 최종 소스이며, build 재생성은 신규 상품 초벌 생성 용도로만 쓴다. 재생성이 필요하면 수기 수정을 `OVERRIDES`로 먼저 흡수할 것.

## check_anomaly.py
`상품매핑.xlsx`에서 **옵션명에 형태가 아닌 값(연령·대상·보고형)이 남아있는 변칙**을 검출한다. 규칙 적용 후 변칙 0을 확인하는 용도. `(...공용...)`·도서명은 정상으로 간주해 제외한다.

## seed_hierarchy.py — 검사 위계 DB 시드 (멱등)

`상품매핑.xlsx`(단일 진실 소스)를 읽어 Supabase 에 검사 위계를 적재한다.
- `test_groups` : **(약어, 검사명) 조합으로 dedup** → upsert (214개 예상)
- `products`    : `product_code` 매칭 → `test_group_id` / `option_name` / `option_label` / `is_common` / `sort_order` / (판매중지만) `is_active` **UPDATE**

### ⚠️ category 미변경 원칙 (엄수)
- **`products.category` 는 절대 UPDATE 대상이 아니다.** 시트의 category 빈칸 26행(판매중지 3종: K-BASC-2·K-Bayley-Ⅲ·K-WAIS-IV)을 DB에 그대로 밀면 `products_category_check`(검사/도서/도구) CHECK 제약 위반. 스크립트는 category 를 읽어 **판매중지 판정에만** 쓰고, DB엔 절대 쓰지 않는다.
- 시트 category 가 빈 행 = 판매중지 → 그 상품만 `is_active=false`. 나머지 행은 `is_active` 를 페이로드에 넣지 않아 DB DEFAULT(`true`) 유지.

### 실행 순서 (반드시 이 순서)
1. **마이그레이션 3개를 SQL Editor 로 먼저 적용** (CTO 검수·건우님 승인 후):
   1) `supabase/migrations/20260630000000_DRAFT_create_test_groups_master.sql`
   2) `supabase/migrations/20260630010000_DRAFT_add_products_test_group_columns.sql`
   3) `supabase/migrations/20260630020000_DRAFT_add_products_is_active.sql`
   (test_groups → products FK 컬럼 → is_active 순. FK가 test_groups(id) 참조하므로 순서 중요.)
2. **dry-run 으로 요약 검증** (DB 미변경):
   ```bash
   pip install openpyxl supabase
   export SUPABASE_URL="https://xxxx.supabase.co"
   export SUPABASE_SERVICE_KEY="sb_secret_..."   # 서비스 롤 키 (RLS 우회 필요)
   python scripts/seed_hierarchy.py
   ```
   기대 출력: 검사군 214 / product_code 빈값·중복 0 / is_active=false 대상 26 / 한 약어→복수 검사명 5건.
   (Windows PowerShell 은 `$env:SUPABASE_URL="..."` 로 설정.)
3. **실적재**:
   ```bash
   python scripts/seed_hierarchy.py --apply
   ```
   출력의 "미매칭 0" 확인. 미매칭 product_code 가 뜨면 DB products 에 없는 코드이므로 원인 조사 후 진행.

### 멱등성
- `test_groups`: abbr/name 에 UNIQUE 제약이 없으므로(1약어→N검사명 실측) 스크립트가 (abbr,name) 키로 조회→없으면 INSERT, 있으면 sort_order만 재동기화. **재실행해도 검사군 중복 생성 0.**
- `products`: `product_code`(유일) 로 개별 UPDATE. **재실행해도 동일 결과.**

### 주의
- **서비스 롤 키 필요** (`sb_secret_...`). test_groups/products 의 INSERT·UPDATE RLS 는 `has_permission('edit')` 를 요구하므로 anon/publishable 키로는 시드 불가. 서비스 키는 RLS 우회.
- 실 DB 적재는 **건우님이 직접** 수행 (키 소유). 에이전트/CI 자동 적재 금지.

## 작업 원칙 (2026-07-01 확립)
대량 데이터 규칙화는 **① 전수 정독 → ② 규칙 설계 → ③ 변칙 검출기로 전수 수집·논의 → ④ 일괄 적용** 순으로. 변칙을 초반에 모아 한 번에 검토한다(반응형 금지).
