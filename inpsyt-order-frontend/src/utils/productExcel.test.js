import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import * as XLSX from 'xlsx';
import {
  normalizeHeaderKey,
  parseBool,
  parseTriState,
  detectHeaderRow,
  parseProductSheet,
  normalizeExcelPercent,
} from './productExcel';

// AOA(2차원 배열) → 워크시트. 파싱 로직만 격리 검증(네트워크·컴포넌트 상태 무관).
const sheetFrom = (aoa) => XLSX.utils.aoa_to_sheet(aoa);

// 양식 v2 헤더(A~T, 괄호 설명 포함) — 실제 템플릿 2행과 동일.
const V2_HEADER = [
  '상품명', '상품코드', '카테고리(검사/도서/도구)', '하위카테고리', '가격', '비고',
  '할인여부(Y/N)', '판매여부(Y/N)', '개별할인율(%/공란)', '배지_인기(Y/N)', '배지_신규(Y/N)',
  '태그', '이미지', '검사군약어', '검사군명', '옵션명', '공용(Y/공란)', '말머리',
  '온라인코드포함(포함/미포함/공란)', '옵션정렬',
];
const ANNOTATION_ROW = new Array(20).fill('안내문');

describe('normalizeHeaderKey — 괄호 설명 제거', () => {
  it('ASCII 괄호 이하를 잘라내고 trim', () => {
    expect(normalizeHeaderKey('카테고리(검사/도서/도구)')).toBe('카테고리');
    expect(normalizeHeaderKey('공용(Y/공란)')).toBe('공용');
    expect(normalizeHeaderKey('온라인코드포함(포함/미포함/공란)')).toBe('온라인코드포함');
    expect(normalizeHeaderKey(' 상품명 ')).toBe('상품명');
    expect(normalizeHeaderKey('노출(Y/N)')).toBe('노출');
  });
});

describe('parseBool / parseTriState', () => {
  it('parseBool: Y/TRUE/1 → true, 그 외 false', () => {
    expect(parseBool('Y')).toBe(true);
    expect(parseBool('N')).toBe(false);
    expect(parseBool('')).toBe(false);
    expect(parseBool(undefined)).toBe(false);
  });
  it('parseTriState: 포함/미포함/공란 3상태', () => {
    expect(parseTriState('포함')).toBe(true);
    expect(parseTriState('미포함')).toBe(false);
    expect(parseTriState('')).toBe(null);
    expect(parseTriState(undefined)).toBe(null);
  });
});

describe('detectHeaderRow — 헤더 행 탐지', () => {
  it('v2: 1행 안내문 + 2행 헤더 → index 1', () => {
    const ws = sheetFrom([ANNOTATION_ROW, V2_HEADER, ['상품', 'P1', '도서', '', 1000]]);
    expect(detectHeaderRow(ws)).toBe(1);
  });
  it('구양식: 1행 헤더 → index 0', () => {
    const ws = sheetFrom([['상품명', '상품코드', '카테고리'], ['상품', 'P1', '도서']]);
    expect(detectHeaderRow(ws)).toBe(0);
  });
});

describe('parseProductSheet — 양식 v2 (2행 헤더·괄호 헤더)', () => {
  const ws = sheetFrom([
    ANNOTATION_ROW,
    V2_HEADER,
    // 검사: 온라인코드 미포함, 공용 Y, 옵션정렬 1
    ['검사상품', 'T1', '검사', '학습', 10000, '', 'Y', 'Y', '', 'N', 'N', '', '', 'BLCT', '기초학습역량검사', '지침서', 'Y', '', '미포함', 1],
    // 검사: 온라인코드 포함
    ['검사상품2', 'T2', '검사', '학습', 90000, '', 'Y', 'Y', '', 'N', 'N', '', '', 'BLCT', '기초학습역량검사', 'SET', '', '초등용', '포함', 2],
    // 도서: 판매여부 Y
    ['도서상품', 'B1', '도서', '심리학', 79000, '', 'Y', 'Y', '', 'Y', 'N', '대한치매학회', 'a.jpeg'],
  ]);
  const { products, hasOnlineCodeColumn, hasIsActiveColumn } = parseProductSheet(ws);

  it('헤더 행 탐지 후 데이터 3건 파싱', () => {
    expect(products).toHaveLength(3);
  });
  it('괄호 헤더 정규화 — 카테고리 매칭', () => {
    expect(products[0].category).toBe('검사');
    expect(products[2].category).toBe('도서');
  });
  it('_rowNum = 실제 엑셀 행번호(헤더 2행 → 데이터 3행부터)', () => {
    expect(products[0]._rowNum).toBe(3);
    expect(products[2]._rowNum).toBe(5);
  });
  it('온라인코드 3상태 — 검사 미포함/포함', () => {
    expect(hasOnlineCodeColumn).toBe(true);
    expect(products[0].includes_online_code).toBe(false);
    expect(products[1].includes_online_code).toBe(true);
  });
  it('판매여부(H열) → is_active, 도서에도 적용', () => {
    expect(hasIsActiveColumn).toBe(true);
    expect(products[0].is_active).toBe(true);
    expect(products[2].is_active).toBe(true);
  });
  it('검사 위계 원시값 보관(_hier)', () => {
    expect(products[0]._hier.groupName).toBe('기초학습역량검사');
    expect(products[0]._hier.is_common).toBe('Y');
    expect(products[1]._hier.option_label).toBe('초등용');
  });
});

describe('parseProductSheet — 구양식 (1행 헤더·괄호 없음)', () => {
  const ws = sheetFrom([
    ['상품명', '상품코드', '카테고리', '가격', '할인여부', '인기상품', '신상품여부', '온라인코드포함'],
    ['검사상품', 'T1', '검사', 10000, 'TRUE', 'FALSE', 'TRUE', '포함'],
  ]);
  const { products } = parseProductSheet(ws);
  it('구양식도 회귀 없이 파싱', () => {
    expect(products).toHaveLength(1);
    expect(products[0].category).toBe('검사');
    expect(products[0]._rowNum).toBe(2);
    expect(products[0].is_discountable).toBe(true);
    expect(products[0].is_popular).toBe(false);
    expect(products[0].is_new).toBe(true);
    expect(products[0].includes_online_code).toBe(true);
  });
});

describe('별칭 — 배지_인기·배지_신규·판매여부', () => {
  const ws = sheetFrom([
    ANNOTATION_ROW, V2_HEADER,
    ['상품', 'P1', '도서', '', 1000, '', 'N', 'N', '', 'Y', 'Y'],
  ]);
  const { products } = parseProductSheet(ws);
  it('배지_인기 → is_popular, 배지_신규 → is_new', () => {
    expect(products[0].is_popular).toBe(true);
    expect(products[0].is_new).toBe(true);
  });
  it('판매여부 N → is_active false', () => {
    expect(products[0].is_active).toBe(false);
  });
});

describe('작업 2 — 검사 외 온라인코드 false 강제', () => {
  it('도서에 포함 입력해도 includes_online_code=false로 교정', () => {
    const ws = sheetFrom([
      ANNOTATION_ROW, V2_HEADER,
      ['도서상품', 'B1', '도서', '심리학', 1000, '', 'Y', 'Y', '', 'N', 'N', '', '', '', '', '', '', '', '포함'],
    ]);
    const { products } = parseProductSheet(ws);
    expect(products[0].includes_online_code).toBe(false);
  });
  it('도구에 포함 입력해도 false로 교정', () => {
    const ws = sheetFrom([
      ANNOTATION_ROW, V2_HEADER,
      ['도구상품', 'W1', '도구', '인지', 1000, '', 'N', 'Y', '', 'N', 'N', '', '', '', '', '', '', '', '포함'],
    ]);
    const { products } = parseProductSheet(ws);
    expect(products[0].includes_online_code).toBe(false);
  });
  it('검사는 공란=NULL(미확인) 유지', () => {
    const ws = sheetFrom([
      ANNOTATION_ROW, V2_HEADER,
      ['검사상품', 'T1', '검사', '학습', 1000, '', 'Y', 'Y', '', 'N', 'N', '', '', 'BLCT', '기초학습역량검사', 'SET', '', '', ''],
    ]);
    const { products } = parseProductSheet(ws);
    expect(products[0].includes_online_code).toBe(null);
  });
});

describe('열 존재 게이트 — 없으면 미변경(키 미포함)', () => {
  it('온라인코드포함 열 없음 → includes_online_code 키 자체가 없음', () => {
    const ws = sheetFrom([
      ['상품명', '상품코드', '카테고리', '가격'],
      ['검사상품', 'T1', '검사', 1000],
    ]);
    const { products, hasOnlineCodeColumn } = parseProductSheet(ws);
    expect(hasOnlineCodeColumn).toBe(false);
    expect('includes_online_code' in products[0]).toBe(false);
  });
  it('판매여부 열 없음 → is_active 키 자체가 없음', () => {
    const ws = sheetFrom([
      ['상품명', '상품코드', '카테고리', '가격'],
      ['검사상품', 'T1', '검사', 1000],
    ]);
    const { products, hasIsActiveColumn } = parseProductSheet(ws);
    expect(hasIsActiveColumn).toBe(false);
    expect('is_active' in products[0]).toBe(false);
  });
  it('판매여부 열 있으나 셀 공란 → is_active 키 미포함(N으로 뭉개지 않음)', () => {
    const ws = sheetFrom([
      ANNOTATION_ROW, V2_HEADER,
      ['상품', 'P1', '도서', '', 1000, '', 'Y', ''], // 판매여부 공란
    ]);
    const { products } = parseProductSheet(ws);
    expect('is_active' in products[0]).toBe(false);
  });
});

describe('실제 확정 템플릿 파일 — 라운드트립 스모크', () => {
  // vitest는 프론트엔드 루트(package.json 위치)를 cwd로 실행 → public/ 정적 양식을 그대로 읽는다.
  const buf = readFileSync(resolve(globalThis.process.cwd(), 'public/templates/product-upload-template.xlsx'));
  const wb = XLSX.read(buf);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const { products, hasOnlineCodeColumn, hasIsActiveColumn } = parseProductSheet(ws);

  it('예시 9행(도서2·도구2·검사5) 파싱', () => {
    expect(products).toHaveLength(9);
    expect(hasOnlineCodeColumn).toBe(true);
    expect(hasIsActiveColumn).toBe(true);
  });
  it('도서·도구는 온라인코드 자동 false, 검사는 포함/미포함', () => {
    const byCat = (c) => products.filter((p) => p.category === c);
    expect(byCat('도서')).toHaveLength(2);
    expect(byCat('도구')).toHaveLength(2);
    expect(byCat('검사')).toHaveLength(5);
    byCat('도서').forEach((p) => expect(p.includes_online_code).toBe(false));
    byCat('도구').forEach((p) => expect(p.includes_online_code).toBe(false));
    // 검사 5행: 미포함 1 + 포함 4
    const codes = byCat('검사').map((p) => p.includes_online_code);
    expect(codes.filter((v) => v === false)).toHaveLength(1);
    expect(codes.filter((v) => v === true)).toHaveLength(4);
  });
  it('전 행 판매여부 Y → is_active true', () => {
    products.forEach((p) => expect(p.is_active).toBe(true));
  });
});

describe('normalizeExcelPercent — 엑셀 퍼센트 형식(소수) 정규화', () => {
  it('엑셀 "50%" 셀의 raw 0.5 → 50', () => {
    expect(normalizeExcelPercent(0.5)).toBe(50);
    expect(normalizeExcelPercent(0.2)).toBe(20);
    expect(normalizeExcelPercent(0.0349999999)).toBeCloseTo(3.49999, 3);
  });
  it('평숫자·문자열·경계값은 그대로', () => {
    expect(normalizeExcelPercent(50)).toBe(50);
    expect(normalizeExcelPercent('50%')).toBe('50%'); // parseFloat('50%')=50 — 후단(percentToRateNullable)에서 처리
    expect(normalizeExcelPercent(1)).toBe(1);   // 1 이상은 퍼센트로 간주
    expect(normalizeExcelPercent(0)).toBe(0);   // 명시적 정가 의미 유지
    expect(normalizeExcelPercent('')).toBe(''); // 공란 = 해제 의미 유지
    expect(normalizeExcelPercent(null)).toBe(null);
  });
  it('파서 경유: 0.5(퍼센트형식)·50(평숫자)·"50%"(문자열) 전부 → 0.5(=50%)', () => {
    const ws = sheetFrom([
      ['상품명', '상품코드', '카테고리', '가격', '개별할인율(%/공란)'],
      ['A', 'C1', '도구', 1000, 0.5],
      ['B', 'C2', '도구', 1000, 50],
      ['C', 'C3', '도구', 1000, '50%'],
    ]);
    const { products } = parseProductSheet(ws);
    expect(products[0].discount_override).toBe(0.5);
    expect(products[1].discount_override).toBe(0.5);
    expect(products[2].discount_override).toBe(0.5);
  });
});
