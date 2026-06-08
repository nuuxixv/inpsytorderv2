// 지불증 export 유틸 Node 점검 스크립트(jsdom 미검증 보완 — depositResolution 선례).
// 양식을 읽어 fillReceiptWorksheet로 채운 뒤, 결과 시트의 핵심 셀을 덤프하고 파일도 저장한다.
//
// 실행: node scripts/check-receipt-export.mjs
// 산출: scripts/_out/지불증_점검.xlsx + 콘솔 셀 덤프
//
// 시나리오: 주말출근비 블록(종일 slot 09:00~17:00, 2일, 멤버 3명) + 출장비 블록(04/16 목~04/17 금 = 평일 2일, 멤버 2명).
//   기대: 총합 = 70000×2×3 + 20000×2×2 = 420000 + 80000 = 500000.
//   확인: B4="오십만원정" · D4=500000 · A8="...09:00 ~ 17:00 주말 근무"(B8 비움)
//         · A14="04/16(목)~04/17(금) 출장비"(B14 비움) · C15·C16 = 40000.

import ExcelJS from 'exceljs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
import { fillReceiptWorksheet } from '../src/utils/paymentReceipt.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATE = path.join(__dirname, '..', 'public', 'templates', 'payment-receipt-template.xlsx');
const TARGET_SHEET = '03.지불증 (템플릿)';
const OUT_DIR = path.join(__dirname, '_out');

const blocks = [
  {
    id: 'w1', type: 'weekend', slotId: 'full0917',
    dates: ['2026-10-18', '2026-10-19'],
    members: [
      { id: 'u1', name: '정마스터', position: '과장' },
      { id: 'u2', name: '김현장', position: '대리' },
      { id: 'u3', name: '이부스', position: '사원' },
    ],
  },
  {
    id: 't1', type: 'trip', start: '2026-04-16', end: '2026-04-17', // 목~금 = 평일 2일
    members: [
      { id: 'u1', name: '정마스터', position: '과장' },
      { id: 'u2', name: '김현장', position: '대리' },
    ],
  },
];
const receiver = { name: '김현장', position: '대리' };

const wb = new ExcelJS.Workbook();
await wb.xlsx.readFile(TEMPLATE);
const ws = wb.getWorksheet(TARGET_SHEET);
if (!ws) {
  console.error('양식에', TARGET_SHEET, '시트 없음. 시트 목록:');
  wb.eachSheet((s) => console.error(' -', JSON.stringify(s.name)));
  process.exit(1);
}

const { total } = fillReceiptWorksheet(ws, { blocks, receiver, todayISO: '2026-10-20' });

const val = (addr) => {
  const v = ws.getCell(addr).value;
  if (v && typeof v === 'object') return v.richText ? v.richText.map((t) => t.text).join('') : (v.result ?? v.text ?? JSON.stringify(v));
  return v;
};

console.log('=== 지불증 export 점검 (멤버3+멤버2 / 블록2) ===');
console.log('총합(JS 계산):', total, '/ 기대 500000');
console.log('B4(한글+원정):', val('B4'), '/ 기대 오십만원정');
console.log('D4(숫자):', val('D4'), '/ 기대 500000');
console.log('--- 주말 블록 (A8에 날짜+시간대 병합, B8 비움) ---');
console.log('A8(날짜+시간대):', val('A8'), '/ 기대 ...09:00 ~ 17:00 주말 근무');
console.log('B8(비움):', val('B8'), '/ 기대 null');
console.log('B9 C9:', val('B9'), '|', val('C9'));
console.log('B10 C10:', val('B10'), '|', val('C10'));
console.log('B11 C11:', val('B11'), '|', val('C11'));
console.log('--- 출장 블록 (A14에 날짜+출장비 병합, B14 비움) ---');
console.log('A14(날짜+출장비):', val('A14'), '/ 기대 04/16(목)~04/17(금) 출장비');
console.log('B14(비움):', val('B14'), '/ 기대 null');
console.log('B15 C15:', val('B15'), '|', val('C15'), '/ C15 기대 40000');
console.log('B16 C16:', val('B16'), '|', val('C16'), '/ C16 기대 40000');
console.log('B17 C17:', val('B17'), '|', val('C17'));
console.log('--- 작성일·영수인 ---');
console.log('C20/D20/E20:', val('C20'), '/', val('D20'), '/', val('E20'));
console.log('D21(영수인):', val('D21'));

fs.mkdirSync(OUT_DIR, { recursive: true });
const outPath = path.join(OUT_DIR, '지불증_점검.xlsx');
await wb.xlsx.writeFile(outPath);
console.log('\n저장:', outPath);
