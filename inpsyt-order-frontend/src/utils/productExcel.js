import * as XLSX from 'xlsx';
import { percentToRateNullable } from './pricing';

// 엑셀 '개별할인율' 셀 → 0~100 퍼센트 숫자로 정규화.
// 엑셀에서 "50%"라고 치면 셀이 퍼센트 형식이 되고 raw 값은 0.5(소수)로 온다 —
// 이를 0~100 기대값으로 그대로 읽으면 0.5%가 되어 의도(50%)의 1/100로 저장되는 사고가 났다
// (2026-08-25 실제 발생: 도구 93개 상품, 복구 완료).
//  - 문자열 "50%" → parseFloat가 50으로 읽음(% 무시) → 그대로
//  - 숫자 0 < n < 1  → 엑셀 퍼센트 형식의 소수 → ×100 (0.5 → 50)
//  - 숫자 n ≥ 1     → 이미 퍼센트 → 그대로 (50 → 50)
//  - 0·공란         → 기존 의미 유지(0=명시적 정가, 공란=해제)
// 한계(문서화): 0.5%처럼 1% 미만 할인은 이 규칙상 표현 불가 — 이 사업에서 실존하지 않는 값이다.
//   엑셀 퍼센트 형식 "100%"는 raw 1이라 1%로 읽힌다 — 100% 할인(무료)도 실존하지 않아 수용.
export const normalizeExcelPercent = (value) => {
  if (value === '' || value == null) return value;
  if (typeof value === 'number' && value > 0 && value < 1) return value * 100;
  return value;
};

// 상품 엑셀 업로드 파서(양식 v2 대응). ProductManagementPage 에서 분리해 단위 테스트 가능하게 함.
// v2 양식: 1행=안내문, 2행=헤더(괄호 설명 포함), 3행~=상품. 판매여부가 H열(공통 구역)로 이동.
// 구양식(1행 헤더·괄호 없는 헤더)도 동일 로직으로 회귀 없이 통과해야 한다.

// 괄호 이하 설명을 잘라낸 정규화 키. `카테고리(검사/도서/도구)`→`카테고리`, `공용(Y/공란)`→`공용`.
// ASCII·전각 괄호 모두 처리. 개행 없는 단일행 헤더 전제(안내문 행은 헤더가 아니라 무관).
export const normalizeHeaderKey = (h) =>
  String(h ?? '').replace(/[（(].*$/, '').trim();

export const parseBool = (value) => {
  if (value === true || value === false) return value;
  if (typeof value === 'number') return value === 1;
  if (typeof value === 'string') {
    const normalized = value.trim().toUpperCase();
    return ['TRUE', 'Y', 'YES', '1'].includes(normalized);
  }
  return false;
};

// 온라인코드 3상태 파싱 — 공란=NULL(미확인) 유지가 핵심.
// discount_override(공란=해제)와 의도가 다르다: 여기선 공란이 "아직 확인 안 함"이라 null 보존해야 한다
// (false로 뭉개면 재업로드 때 미확인 추적이 전부 미포함으로 소실됨).
// 다운로드가 '포함'/'미포함'/'' 를 쓰므로 라운드트립 정합. TRUE/Y/1·FALSE/N/0 별칭도 허용.
export const parseTriState = (value) => {
  if (value === undefined || value === null || value === '') return null;
  const s = String(value).trim().toUpperCase();
  if (['포함', 'TRUE', 'Y', 'YES', '1', 'O'].includes(s)) return true;
  if (['미포함', 'FALSE', 'N', 'NO', '0', 'X'].includes(s)) return false;
  return null; // 알 수 없는 값 = 미확인(안전)
};

export const parsePrice = (value) => {
  if (typeof value === 'number') return Math.round(value);
  if (typeof value === 'string') {
    const normalized = value.replace(/[^\d.-]/g, '');
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? Math.round(parsed) : 0;
  }
  return 0;
};

// row 객체에서 후보 키(원본·정규화·영문 별칭) 중 첫 유효값. 빈문자열·null·undefined는 미존재 취급.
export const getRowValue = (row, keys) => {
  for (const key of keys) {
    if (row[key] !== undefined && row[key] !== null && row[key] !== '') {
      return row[key];
    }
  }
  return undefined;
};

// 원본 키 + 정규화 키를 모두 갖는 row 사본. 괄호 설명 헤더(`카테고리(검사/도서/도구)`)와
// 짧은 키(`카테고리`) 양쪽으로 매칭되게 한다. 이미 존재하는 짧은 키는 덮어쓰지 않음.
const withNormalizedKeys = (row) => {
  const out = { ...row };
  for (const [k, v] of Object.entries(row)) {
    const nk = normalizeHeaderKey(k);
    if (nk && !(nk in out)) out[nk] = v;
  }
  return out;
};

// 1~10행 중 '상품명'(괄호·공백 무시) 텍스트가 있는 첫 행의 0-based 인덱스. 없으면 0.
// v2(2행 헤더)·구양식(1행 헤더)·목록 다운로드(1행 헤더) 모두 흡수한다.
export const detectHeaderRow = (worksheet) => {
  const grid = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
  const limit = Math.min(grid.length, 10);
  for (let i = 0; i < limit; i++) {
    const cells = (grid[i] || []).map(normalizeHeaderKey);
    if (cells.includes('상품명') || cells.includes('name')) return i;
  }
  return 0;
};

// 워크시트 → 파싱된 상품 원시 배열 + 헤더 메타.
// 반환 product: 최상위 필드(name·category·is_active 등) + _rowNum + _hier(검사 위계 원시값).
// 열-존재 게이트: includes_online_code·is_active 는 헤더에 해당 열이 있을 때만 키를 채운다
// (열 없음 → 키 자체를 넣지 않아 upsert 시 기존 값 보존).
export const parseProductSheet = (worksheet) => {
  const headerRow = detectHeaderRow(worksheet);
  const rawRows = XLSX.utils.sheet_to_json(worksheet, { range: headerRow });
  const headerNames = (XLSX.utils.sheet_to_json(worksheet, { header: 1, range: headerRow })[0] || [])
    .map((h) => String(h ?? '').trim());
  const normalizedHeaders = headerNames.map(normalizeHeaderKey);
  const hasOnlineCodeColumn =
    normalizedHeaders.includes('온라인코드포함') || normalizedHeaders.includes('includes_online_code');
  const hasIsActiveColumn =
    normalizedHeaders.includes('판매여부') || normalizedHeaders.includes('노출') || normalizedHeaders.includes('is_active');

  const products = rawRows.map((raw, idx) => {
    const row = withNormalizedKeys(raw);
    const category = String(getRowValue(row, ['카테고리', 'category']) || '').trim();
    // 개별 할인율 — 공란=NULL(해제), 값=clamp(0..100)/100. (현행 '할인여부' 공란=FALSE 규칙과 정합)
    const discountOverride = percentToRateNullable(normalizeExcelPercent(getRowValue(row, ['개별할인율', 'discount_override'])));
    // auto-T 보정 — 개별할인율(>0)이면 '할인여부'를 자동 TRUE로.
    let isDiscountable = parseBool(getRowValue(row, ['할인여부', 'is_discountable']));
    if (discountOverride != null && discountOverride > 0) isDiscountable = true;
    // 판매여부(H열, 공통 구역) — 열 있고 셀 비지 않을 때만 반영(빈 셀=미변경, N으로 뭉개 숨김 방지).
    const isActiveRaw = hasIsActiveColumn ? getRowValue(row, ['판매여부', '노출', 'is_active']) : undefined;
    return {
      _rowNum: headerRow + idx + 2, // 헤더 다음 행부터 1-indexed 엑셀 행번호
      name: getRowValue(row, ['상품명', 'name']),
      product_code: getRowValue(row, ['상품코드', 'product_code']),
      category,
      sub_category: getRowValue(row, ['하위카테고리', 'sub_category']) || null,
      image_filename: getRowValue(row, ['이미지', 'image_filename']) || null,
      list_price: parsePrice(getRowValue(row, ['가격', '정가', 'list_price'])),
      notes: getRowValue(row, ['비고', 'notes']) || null,
      is_discountable: isDiscountable,
      discount_override: discountOverride,
      is_popular: parseBool(getRowValue(row, ['배지_인기', '인기상품', 'is_popular'])),
      is_new: parseBool(getRowValue(row, ['배지_신규', '신상품여부', 'is_new'])),
      // 온라인코드 3상태 — 열 있을 때만. 검사 외(도서·도구)는 무조건 false 강제(입력 무시, 조용히 교정).
      // 검사는 포함/미포함/공란(NULL) 3상태 유지.
      ...(hasOnlineCodeColumn
        ? { includes_online_code: category !== '검사' ? false : parseTriState(getRowValue(row, ['온라인코드포함', 'includes_online_code'])) }
        : {}),
      ...(hasIsActiveColumn && isActiveRaw != null && String(isActiveRaw).trim() !== ''
        ? { is_active: parseBool(isActiveRaw) }
        : {}),
      tags: getRowValue(row, ['태그', 'tags'])
        ? String(getRowValue(row, ['태그', 'tags'])).split(',').map((tag) => tag.trim()).filter(Boolean)
        : [],
      // 검사 위계 열(구양식엔 없음 — undefined면 미변경). 원시값만 보관, test_group_id는 검증 후 매칭.
      _hier: {
        abbr: getRowValue(row, ['검사군약어', 'test_group_abbr']),
        groupName: getRowValue(row, ['검사군명', 'test_group_name']),
        option_name: getRowValue(row, ['옵션명', 'option_name']),
        option_label: getRowValue(row, ['말머리', 'option_label']),
        is_common: getRowValue(row, ['공용', 'is_common']),
        sort_order: getRowValue(row, ['옵션정렬', 'sort_order']),
      },
    };
  });

  return { products, headerNames, hasOnlineCodeColumn, hasIsActiveColumn };
};
