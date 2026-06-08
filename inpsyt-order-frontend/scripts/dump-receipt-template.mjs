// 양식(payment-receipt-template.xlsx)의 시트·셀·병합 구조를 덤프해 셀맵을 검증한다.
// 실행: node scripts/dump-receipt-template.mjs
import ExcelJS from 'exceljs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATE = path.join(__dirname, '..', 'public', 'templates', 'payment-receipt-template.xlsx');

const wb = new ExcelJS.Workbook();
await wb.xlsx.readFile(TEMPLATE);

wb.eachSheet((ws) => {
  console.log('\n=== SHEET:', JSON.stringify(ws.name), 'rows=', ws.rowCount, 'cols=', ws.columnCount, '===');
  // 병합 셀
  const merges = ws.model.merges || [];
  console.log('MERGES:', JSON.stringify(merges));
  for (let r = 1; r <= Math.min(ws.rowCount, 30); r++) {
    const row = ws.getRow(r);
    const cells = [];
    row.eachCell({ includeEmpty: false }, (cell, col) => {
      const v = cell.value;
      if (v !== null && v !== undefined && v !== '') {
        cells.push(`${cell.address}=${JSON.stringify(typeof v === 'object' ? (v.richText ? v.richText.map(t => t.text).join('') : v.result ?? v.text ?? v) : v)}`);
      }
    });
    if (cells.length) console.log(`R${r}:`, cells.join(' | '));
  }
});
