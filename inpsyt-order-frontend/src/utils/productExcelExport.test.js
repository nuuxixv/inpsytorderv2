import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import ExcelJS from 'exceljs';
import * as XLSX from 'xlsx';
import { buildProductRows, fillProductListWorksheet } from './productExcelExport';
import { parseProductSheet } from './productExcel';

// 검사군 룩업(N·O열).
const GROUPS = [{ id: 10, abbr: 'BLCT', name: '기초학습역량검사' }];

// 라운드트립·포맷 검증용 상품 표본(각 카테고리·3상태·개별할인율 커버).
const PRODUCTS = [
  {
    name: '검사상품', product_code: 'T1', category: '검사', sub_category: '학습',
    list_price: 10000, notes: '', is_discountable: true, is_active: true,
    discount_override: 0.1, is_popular: false, is_new: false, tags: ['태그A', '태그B'],
    image_filename: '', test_group_id: 10, option_name: '지침서', is_common: true,
    option_label: '', includes_online_code: false, sort_order: 1,
  },
  {
    name: '검사상품2', product_code: 'T2', category: '검사', sub_category: '학습',
    list_price: 90000, notes: '', is_discountable: true, is_active: true,
    discount_override: null, is_popular: false, is_new: false, tags: [],
    image_filename: '', test_group_id: 10, option_name: 'SET', is_common: false,
    option_label: '초등용', includes_online_code: true, sort_order: 2,
  },
  {
    name: '도서상품', product_code: 'B1', category: '도서', sub_category: '심리학',
    list_price: 79000, notes: '비고메모', is_discountable: true, is_active: false,
    discount_override: null, is_popular: true, is_new: false, tags: ['대한치매학회'],
    image_filename: 'a.jpeg', test_group_id: null, option_name: null, is_common: false,
    option_label: null, includes_online_code: null, sort_order: null,
  },
];

describe('buildProductRows — 상품 → 양식 v2 20열 AOA', () => {
  const rows = buildProductRows(PRODUCTS, GROUPS);

  it('행마다 20열(A~T)', () => {
    expect(rows).toHaveLength(3);
    rows.forEach((r) => expect(r).toHaveLength(20));
  });
  it('공통 열 포맷 — 판매여부/할인여부/배지/가격', () => {
    // A상품명 B코드 C카테고리 D하위 E가격 F비고 G할인여부 H판매여부
    expect(rows[0].slice(0, 8)).toEqual(['검사상품', 'T1', '검사', '학습', 10000, '', 'Y', 'Y']);
    expect(rows[2][7]).toBe('N'); // 도서: is_active=false → 판매여부 N
    expect(rows[2][9]).toBe('Y'); // 도서: is_popular → 배지_인기 Y
  });
  it('개별할인율 — 값=정수%·null=공란', () => {
    expect(rows[0][8]).toBe(10); // 0.1 → 10
    expect(rows[1][8]).toBe('');  // null → ''
  });
  it('태그 쉼표 join·이미지', () => {
    expect(rows[0][11]).toBe('태그A,태그B');
    expect(rows[2][11]).toBe('대한치매학회');
    expect(rows[2][12]).toBe('a.jpeg');
  });
  it('검사군 조인(N·O)·옵션명·공용·말머리', () => {
    expect(rows[0][13]).toBe('BLCT');
    expect(rows[0][14]).toBe('기초학습역량검사');
    expect(rows[0][15]).toBe('지침서');
    expect(rows[0][16]).toBe('Y');   // is_common → 공용 Y
    expect(rows[1][16]).toBe('');    // 비공용 → 공란
    expect(rows[1][17]).toBe('초등용');
    expect(rows[2][13]).toBe('');    // 도서: 그룹 없음
  });
  it('온라인코드포함 3상태 라운드트립', () => {
    expect(rows[0][18]).toBe('미포함'); // false
    expect(rows[1][18]).toBe('포함');   // true
    expect(rows[2][18]).toBe('');       // null(미확인)
  });
  it('옵션정렬 — 값·null=공란', () => {
    expect(rows[0][19]).toBe(1);
    expect(rows[2][19]).toBe('');
  });
});

describe('fillProductListWorksheet + 라운드트립 (실 확정 템플릿)', () => {
  // vitest cwd = 프론트엔드 루트 → public/ 정적 양식을 그대로 읽는다(productExcel.test 동일 패턴).
  async function buildFilledBuffer(products, groups) {
    const buf = readFileSync(resolve(globalThis.process.cwd(), 'public/templates/product-upload-template.xlsx'));
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf);
    const ws = wb.worksheets[0];
    fillProductListWorksheet(ws, buildProductRows(products, groups));
    return { out: await wb.xlsx.writeBuffer(), ws };
  }

  it('예시 행 제거·데이터만 채움·자동필터 갱신·틀고정 유지', async () => {
    const { ws } = await buildFilledBuffer(PRODUCTS, GROUPS);
    // 헤더(2) + 데이터 3 = 5행. 예시 9행 흔적 없음.
    expect(ws.rowCount).toBe(5);
    expect(ws.getCell('A2').value).toBe('상품명'); // 헤더 보존
    expect(ws.getCell('A3').value).toBe('검사상품'); // 3행부터 실데이터(예시 BLCT 아님)
    expect(ws.autoFilter).toBe('A2:T5');
    expect(ws.views?.[0]?.ySplit).toBe(2); // 틀고정 A3 유지
  });

  it('E열 가격 numFmt·N~T 검사 전용 채움 상속', async () => {
    const { ws } = await buildFilledBuffer(PRODUCTS, GROUPS);
    expect(ws.getCell('E3').numFmt).toBe('#,##0');
    // N~T 옅은 채움(theme3/tint 0.85) 상속 확인.
    const fill = ws.getCell('N3').fill;
    expect(fill?.type).toBe('pattern');
    expect(fill?.fgColor?.theme).toBe(3);
  });

  it('내려받은 파일을 업로드 파서로 재파싱 — 안내문 1행 → 헤더 2행 탐지·20열·값 복원', async () => {
    const { out } = await buildFilledBuffer(PRODUCTS, GROUPS);
    const wb = XLSX.read(out);
    const ws = wb.Sheets[wb.SheetNames[0]];
    const { products, hasOnlineCodeColumn, hasIsActiveColumn } = parseProductSheet(ws);

    expect(products).toHaveLength(3);
    expect(hasOnlineCodeColumn).toBe(true);
    expect(hasIsActiveColumn).toBe(true);
    // 헤더 2행 탐지 → 첫 데이터 _rowNum=3.
    expect(products[0]._rowNum).toBe(3);
    // 평면 값 복원.
    expect(products[0].name).toBe('검사상품');
    expect(products[0].category).toBe('검사');
    expect(products[0].list_price).toBe(10000);
    expect(products[0].discount_override).toBe(0.1); // 10% → 0.1
    expect(products[2].is_active).toBe(false);       // 판매여부 N 복원
    expect(products[2].is_popular).toBe(true);
    expect(products[2].tags).toEqual(['대한치매학회']);
    // 온라인코드 3상태 복원(검사만).
    expect(products[0].includes_online_code).toBe(false);
    expect(products[1].includes_online_code).toBe(true);
    // 검사 위계 원시값 복원.
    expect(products[0]._hier.abbr).toBe('BLCT');
    expect(products[0]._hier.groupName).toBe('기초학습역량검사');
    expect(products[0]._hier.is_common).toBe('Y');
    expect(products[1]._hier.option_label).toBe('초등용');
  });

  it('데이터 0건 — 자동필터 A2:T2·헤더만', async () => {
    const { ws } = await buildFilledBuffer([], GROUPS);
    expect(ws.rowCount).toBe(2);
    expect(ws.autoFilter).toBe('A2:T2');
  });
});
