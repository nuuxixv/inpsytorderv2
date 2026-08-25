// 상품 목록 다운로드 — 확정 양식 v2 서식 그대로 내보낸다.
// 선례(utils/depositResolution·paymentReceipt)와 동일하게 /templates/*.xlsx 를 ExcelJS로 열어
// 예시 행을 지우고 실 상품을 채운다. SheetJS json_to_sheet(맨 시트) 폐기 — 안내문·색상 헤더·검사 전용 열 색·틀고정 A3·자동필터 보존이 목적.
//
// 열 순서·값 포맷은 업로드 파서(utils/productExcel.parseProductSheet)와 라운드트립 정합:
// A~T 20열, 판매여부=Y/N, 공용=Y/공란, 온라인코드포함=포함/미포함/공란, 개별할인율=rateToPercentNullable.

import ExcelJS from 'exceljs';
import { rateToPercentNullable } from './pricing';

const TEMPLATE_URL = '/templates/product-upload-template.xlsx';
const HEADER_ROW = 2; // 양식 v2: 1행 안내문, 2행 헤더, 3행~ 데이터.
const FIRST_DATA_ROW = 3;
const COL_COUNT = 20; // A~T

/**
 * 상품 배열 → 양식 v2 20열 데이터 행 배열(AOA). 순수 로직(단위 테스트 대상).
 * 값 포맷은 현행 다운로드 규약·파서 규약과 일치. 정렬은 입력 순서 그대로(fetchAllProducts 반환 순서).
 * @param {Array} products - fetchAllProducts() 결과
 * @param {Array} groups   - fetchTestGroups() 결과(test_group_id → 검사군 룩업)
 * @returns {Array<Array>} 각 행이 20개 셀(A~T)인 2차원 배열. 빈 값은 '' (fill 단계에서 null 처리).
 */
export function buildProductRows(products, groups) {
  const groupById = new Map((groups || []).map((g) => [g.id, g]));
  return (products || []).map((product) => {
    const group = product.test_group_id != null ? groupById.get(product.test_group_id) : null;
    return [
      product.name,                                              // A 상품명
      product.product_code,                                      // B 상품코드
      product.category,                                          // C 카테고리
      product.sub_category || '',                                // D 하위카테고리
      product.list_price,                                        // E 가격(숫자)
      product.notes || '',                                       // F 비고
      product.is_discountable ? 'Y' : 'N',                       // G 할인여부
      product.is_active === false ? 'N' : 'Y',                   // H 판매여부
      rateToPercentNullable(product.discount_override),          // I 개별할인율(%/공란)
      product.is_popular ? 'Y' : 'N',                            // J 배지_인기
      product.is_new ? 'Y' : 'N',                                // K 배지_신규
      product.tags?.join(',') || '',                             // L 태그
      product.image_filename || '',                              // M 이미지
      group?.abbr || '',                                         // N 검사군약어
      group?.name || '',                                         // O 검사군명
      product.option_name || '',                                 // P 옵션명
      product.is_common ? 'Y' : '',                              // Q 공용(Y/공란)
      product.option_label || '',                                // R 말머리
      product.includes_online_code == null ? '' : product.includes_online_code ? '포함' : '미포함', // S 온라인코드포함(3상태)
      product.sort_order ?? '',                                  // T 옵션정렬
    ];
  });
}

// 예시 데이터 행(3행)의 20개 셀 서식을 캡처한다(서식 상속용 — 선례 paymentReceipt.captureRowStyle 패턴).
// E열 numFmt '#,##0', N~T열 검사 전용 옅은 채움(theme3/tint 0.85)이 여기서 그대로 딸려온다.
function captureDataRowStyle(ws) {
  const cells = [];
  for (let c = 1; c <= COL_COUNT; c++) {
    const cell = ws.getCell(FIRST_DATA_ROW, c);
    cells.push({
      font: cell.font,
      alignment: cell.alignment,
      border: cell.border,
      fill: cell.fill,
      numFmt: cell.numFmt,
    });
  }
  return cells;
}

/**
 * 양식 워크시트에 데이터 행을 채운다(순수 ExcelJS — DOM 미접촉, Node 테스트 재사용).
 * 예시 행을 전부 제거하고 3행부터 dataRows를 기입. 예시 행 서식을 각 행에 상속.
 * 자동필터를 A2:T{2+행수}로 갱신. 틀고정 A3는 템플릿 그대로 둔다.
 * @param {object} ws       - ExcelJS Worksheet(양식 시트)
 * @param {Array<Array>} dataRows - buildProductRows 결과
 */
export function fillProductListWorksheet(ws, dataRows) {
  const tpl = captureDataRowStyle(ws); // 예시 행 서식 캡처(삭제 전에).

  // 예시 데이터 행(3행~끝) 전부 제거 — 예시가 실데이터에 섞이면 안 된다(BLCT 예시는 DB와 값도 다름).
  // ExcelJS 4.4.0 spliceRows(start, count)는 시트 말단까지 걸치는 대량 삭제가 무동작하는 버그가 있어
  // (splice(3,9)→미삭제 확인), 아래에서부터 1행씩 삭제로 우회한다.
  for (let r = ws.rowCount; r >= FIRST_DATA_ROW; r--) ws.spliceRows(r, 1);

  dataRows.forEach((rowData, i) => {
    const r = FIRST_DATA_ROW + i;
    for (let c = 1; c <= COL_COUNT; c++) {
      const cell = ws.getCell(r, c);
      const v = rowData[c - 1];
      cell.value = v === '' || v === undefined ? null : v; // 빈 값은 null(검사 전용 열 채움만 보이게).
      const s = tpl[c - 1];
      if (s.font) cell.font = s.font;
      if (s.alignment) cell.alignment = s.alignment;
      if (s.border) cell.border = s.border;
      if (s.fill) cell.fill = s.fill;
      if (s.numFmt) cell.numFmt = s.numFmt;
    }
  });

  // 자동필터 = 헤더행 + 데이터 행수. 데이터 0건이면 헤더만(A2:T2).
  ws.autoFilter = `A2:T${HEADER_ROW + dataRows.length}`;
}

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * 상품 목록 엑셀(양식 v2 서식)을 생성·다운로드한다.
 * @param {object} args
 * @param {Array} args.products - fetchAllProducts() 결과
 * @param {Array} args.groups   - fetchTestGroups() 결과
 * @throws 양식 로드 실패 시.
 */
export async function exportProductList({ products, groups }) {
  const dataRows = buildProductRows(products, groups);

  const res = await fetch(TEMPLATE_URL);
  if (!res.ok) throw new Error(`양식 파일을 불러오지 못했습니다 (${res.status})`);
  const buf = await res.arrayBuffer();

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf);
  const ws = wb.worksheets[0];
  if (!ws) throw new Error('양식에 시트가 없습니다.');

  fillProductListWorksheet(ws, dataRows);

  const out = await wb.xlsx.writeBuffer();
  const blob = new Blob([out], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  triggerDownload(blob, '상품_목록.xlsx');
}
