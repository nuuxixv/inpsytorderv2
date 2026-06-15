// 지불증 export 유틸 Node 점검 스크립트(jsdom 미검증 보완 — depositResolution 선례).
// 양식을 읽어 fillReceiptWorksheet로 채운 뒤, 결과 시트의 핵심 셀을 덤프하고 파일도 저장한다.
//
// 실행: node scripts/check-receipt-export.mjs
// 산출: scripts/_out/지불증_점검.xlsx + 콘솔 섹션별 셀 덤프
//
// 시나리오(2026-06-15 정책 — 입력 블록 1개 = 섹션 1개, 같은 type도 합치지 않음):
//   주말 블록 3개(같은 06/13이라도 입력 블록이 다르면 각각 섹션):
//     ① 06/13(토) 09~17 종일 70,000 × 5명
//     ② 06/13(토) 09~13 반일 40,000 × 1명
//     ③ 06/14(일) 09~17 종일 70,000 × 2명
//   출장 블록 1개: 04/16(목)~04/17(금) = 평일 2일 × 20,000 = 40,000 × 2명.
//   기대 총합 = (70000×5) + (40000×1) + (70000×2) + (40000×2)
//             = 350000 + 40000 + 140000 + 80000 = 610000.
//   확인: 각 섹션이 [헤더행 + 인원행 N]으로 분리되고, 섹션 사이 spacer 1행, A=날짜+항목·B=null,
//         인원행 B="이름 직급"·C=1인 수당, 작성일·영수인은 라벨 추종으로 정확.

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
    id: 'w1', type: 'weekend', slotId: 'full0917', // 09:00~17:00 종일 70,000
    dates: ['2026-06-13'],
    members: [
      { id: 'u1', name: '정마스터', position: '차장' },
      { id: 'u2', name: '김현장', position: '과장' },
      { id: 'u3', name: '이부스', position: '대리' },
      { id: 'u4', name: '박접수', position: '사원' },
      { id: 'u5', name: '최진행', position: '사원' },
    ],
  },
  {
    id: 'w2', type: 'weekend', slotId: 'am0913', // 09:00~13:00 반일 40,000
    dates: ['2026-06-13'],
    members: [
      { id: 'u6', name: '한반일', position: '사원' },
    ],
  },
  {
    id: 'w3', type: 'weekend', slotId: 'full0917', // 09:00~17:00 종일 70,000
    dates: ['2026-06-14'],
    members: [
      { id: 'u1', name: '정마스터', position: '차장' },
      { id: 'u3', name: '이부스', position: '대리' },
    ],
  },
  {
    id: 't1', type: 'trip', start: '2026-04-16', end: '2026-04-17', // 목~금 = 평일 2일 = 40,000
    members: [
      { id: 'u7', name: '윤출장', position: '과장' },
      { id: 'u8', name: '강지방', position: '사원' },
    ],
  },
];
const receiver = { name: '김현장', position: '과장' };

const EXPECTED_TOTAL = 70000 * 5 + 40000 * 1 + 70000 * 2 + 40000 * 2; // 610000

const wb = new ExcelJS.Workbook();
await wb.xlsx.readFile(TEMPLATE);
const ws = wb.getWorksheet(TARGET_SHEET);
if (!ws) {
  console.error('양식에', TARGET_SHEET, '시트 없음. 시트 목록:');
  wb.eachSheet((s) => console.error(' -', JSON.stringify(s.name)));
  process.exit(1);
}

const { total } = fillReceiptWorksheet(ws, { blocks, receiver, todayISO: '2026-06-20' });

const val = (addr) => {
  const v = ws.getCell(addr).value;
  if (v && typeof v === 'object') return v.richText ? v.richText.map((t) => t.text).join('') : (v.result ?? v.text ?? JSON.stringify(v));
  return v;
};

console.log('=== 지불증 export 점검 (주말 3블록 + 출장 1블록 = 4섹션) ===');
console.log('총합(JS 계산):', total, '/ 기대', EXPECTED_TOTAL);
console.log('B4(한글+원정):', val('B4'));
console.log('D4(숫자):', val('D4'), '/ 기대', EXPECTED_TOTAL);

// 내역 영역(R8~)을 행별로 덤프 — 섹션 분리·spacer·헤더/인원 구조 입증.
console.log('\n--- 내역 영역 행별 덤프 (A | B | C) ---');
const recRow = (() => {
  for (let r = 1; r <= ws.rowCount + 5; r++) {
    const row = ws.getRow(r);
    let hit = false;
    row.eachCell({ includeEmpty: false }, (cell) => {
      const v = cell.value;
      const t = typeof v === 'string' ? v : (v && v.richText ? v.richText.map((x) => x.text).join('') : '');
      if (t && t.includes('영수인')) hit = true;
    });
    if (hit) return r;
  }
  return null;
})();
for (let r = 8; r <= (recRow || 30); r++) {
  const a = val(`A${r}`);
  const b = val(`B${r}`);
  const c = val(`C${r}`);
  const empty = (a == null || a === '') && (b == null || b === '') && (c == null || c === '');
  console.log(`R${r}: A=${a ?? ''} | B=${b ?? ''} | C=${c ?? ''}${empty ? '   <spacer/빈행>' : ''}`);
}

console.log('\n--- 작성일·영수인 (라벨 추종) ---');
console.log('영수인 행:', recRow);
if (recRow) {
  console.log(`작성일 C${recRow - 1}/D${recRow - 1}/E${recRow - 1}:`, val(`C${recRow - 1}`), '/', val(`D${recRow - 1}`), '/', val(`E${recRow - 1}`), '/ 기대 2026년 / 6월 / 20일');
  console.log(`영수인 D${recRow}:`, val(`D${recRow}`), '/ 기대 김현장 과장');
}

console.log('\n--- 검증 요약 ---');
console.log('총합 일치:', total === EXPECTED_TOTAL ? 'OK' : `FAIL (${total} != ${EXPECTED_TOTAL})`);

fs.mkdirSync(OUT_DIR, { recursive: true });
const outPath = path.join(OUT_DIR, '지불증_점검.xlsx');
await wb.xlsx.writeFile(outPath);
console.log('\n저장:', outPath);

// ─────────────────────────────────────────────────────────────────────
// placeholder 잔존·날짜 정렬 점검 — rowCount 끝까지 전체 행 덤프 + 토큰 0 단언.
// 토큰: MM/DD(DDD)·{member·출장비·[object Object](양식 placeholder/객체값 잔재).
// ─────────────────────────────────────────────────────────────────────
const PLACEHOLDER_TOKENS = ['MM/DD(DDD)', 'MM/DD', '{member', '출장비', '[object Object]'];

async function fillCase(blocks) {
  const w = new ExcelJS.Workbook();
  await w.xlsx.readFile(TEMPLATE);
  const s = w.getWorksheet(TARGET_SHEET);
  fillReceiptWorksheet(s, { blocks, receiver: { name: '관리자', position: '차장' }, todayISO: '2026-06-20' });
  return s;
}

function cellText(s, addr) {
  const v = s.getCell(addr).value;
  if (v && typeof v === 'object') return v.richText ? v.richText.map((t) => t.text).join('') : (v.result ?? v.text ?? JSON.stringify(v));
  return v;
}

// 전체 행(A~E)을 덤프하고, 출장비 헤더가 의도된 케이스인지(allowTrip)에 따라 토큰 잔존을 검사.
function dumpAndAssert(label, s, { allowTrip }) {
  const lastRow = s.rowCount; // 루프 중 getCell이 행을 materialize해 rowCount가 늘지 않도록 상한 고정.
  console.log(`\n=== ${label} — 전체 행 덤프 (rowCount=${lastRow}) ===`);
  const hits = [];
  for (let r = 1; r <= lastRow + 3; r++) {
    const cs = [];
    ['A', 'B', 'C', 'D', 'E'].forEach((c) => {
      const v = cellText(s, `${c}${r}`);
      if (v != null && v !== '') cs.push(`${c}${r}=${JSON.stringify(v)}`);
    });
    if (cs.length) console.log(`R${r}: ${cs.join(' | ')}`);
    // 토큰 검사: 의도된 '출장비' 헤더(allowTrip)는 정상이므로 제외.
    ['A', 'B', 'C', 'D', 'E'].forEach((c) => {
      const v = cellText(s, `${c}${r}`);
      const t = typeof v === 'string' ? v : '';
      PLACEHOLDER_TOKENS.forEach((tok) => {
        if (!t.includes(tok)) return;
        if (tok === '출장비' && allowTrip) return; // 출장 섹션 헤더는 정상.
        hits.push(`R${r}/${c}: "${t}" (토큰 "${tok}")`);
      });
    });
  }
  if (hits.length) {
    console.error(`[FAIL] ${label}: placeholder/잔재 토큰 ${hits.length}건 잔존`);
    hits.forEach((h) => console.error('   -', h));
    process.exitCode = 1;
  } else {
    console.log(`[OK] ${label}: placeholder/잔재 토큰 0건`);
  }
}

// ① 주말만(출장 0개) — 하단에 출장 placeholder 0 잔존이어야 함.
const weekendOnly = await fillCase([
  { id: 'w1', type: 'weekend', slotId: 'full0917', dates: ['2026-06-14'],
    members: [{ id: 'u1', name: '정마스터', position: '차장' }, { id: 'u2', name: '김현장', position: '과장' }] },
]);
dumpAndAssert('① 주말만(출장 0개)', weekendOnly, { allowTrip: false });

// ② 출장만(주말 0개) — 주말 placeholder 0, '출장비' 헤더 1개는 정상(allowTrip).
const tripOnly = await fillCase([
  { id: 't1', type: 'trip', start: '2026-04-16', end: '2026-04-17',
    members: [{ id: 'u7', name: '윤출장', position: '과장' }, { id: 'u8', name: '강지방', position: '사원' }] },
]);
dumpAndAssert('② 출장만(주말 0개)', tripOnly, { allowTrip: true });

// ③ 날짜 역순 입력(06/14 → 06/13) → 출력은 06/13이 먼저(오름차순).
const reversed = await fillCase([
  { id: 'a', type: 'weekend', slotId: 'full0917', dates: ['2026-06-14'],
    members: [{ id: 'u1', name: '나중사람', position: '대리' }] },
  { id: 'b', type: 'weekend', slotId: 'full0917', dates: ['2026-06-13'],
    members: [{ id: 'u2', name: '먼저사람', position: '대리' }] },
]);
console.log('\n=== ③ 날짜 역순 입력(06/14,06/13) → 오름차순 출력 ===');
const head1 = cellText(reversed, 'A8');
const reversedLast = reversed.rowCount; // 상한 고정(getCell materialize로 인한 폭주 방지).
const head2Row = (() => { // 두번째 헤더(spacer 1행 뒤): R8 헤더 + R9 인원 + R10 spacer + R11 헤더.
  for (let r = 9; r <= reversedLast; r++) {
    const a = cellText(reversed, `A${r}`);
    if (typeof a === 'string' && a.includes('주말 근무')) return r;
  }
  return null;
})();
const head2 = head2Row ? cellText(reversed, `A${head2Row}`) : null;
console.log('첫 헤더(A8):', head1);
console.log('둘째 헤더:', head2);
if (typeof head1 === 'string' && head1.startsWith('06/13')) {
  console.log('[OK] ③ 날짜 오름차순(06/13 먼저)');
} else {
  console.error(`[FAIL] ③ 날짜 오름차순 아님 — 첫 헤더="${head1}"`);
  process.exitCode = 1;
}
