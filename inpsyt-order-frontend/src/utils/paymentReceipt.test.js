// paymentReceipt.fillReceiptWorksheet 검증 — 실제 양식 파일을 ExcelJS로 로드해 셀 실측.
// 정책(2026-06-15): 입력 블록 1개 = 양식 섹션 1개(별도 렌더). 같은 type도 합치지 않음.
import { describe, it, expect, beforeAll } from 'vitest';
import ExcelJS from 'exceljs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
import { fillReceiptWorksheet } from './paymentReceipt.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATE = path.join(__dirname, '..', '..', 'public', 'templates', 'payment-receipt-template.xlsx');
const TARGET_SHEET = '03.지불증 (템플릿)';

let templateBuf;
beforeAll(() => {
  templateBuf = fs.readFileSync(TEMPLATE);
});

async function fill(args) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(templateBuf);
  const ws = wb.getWorksheet(TARGET_SHEET);
  const ret = fillReceiptWorksheet(ws, args);
  return { ws, ...ret };
}

const text = (ws, addr) => {
  const v = ws.getCell(addr).value;
  if (v && typeof v === 'object') return v.richText ? v.richText.map((t) => t.text).join('') : (v.result ?? v.text ?? '');
  return v;
};

// '영수인' 라벨 행 탐색.
const findReceiverRow = (ws) => {
  for (let r = 1; r <= ws.rowCount + 5; r++) {
    let hit = false;
    ws.getRow(r).eachCell({ includeEmpty: false }, (cell) => {
      const v = cell.value;
      const t = typeof v === 'string' ? v : (v && v.richText ? v.richText.map((x) => x.text).join('') : '');
      if (t && t.includes('영수인')) hit = true;
    });
    if (hit) return r;
  }
  return null;
};

// 시트 전체에서 placeholder/잔재 토큰을 수집한다(allowTrip이면 의도된 '출장비' 헤더는 제외).
// 토큰: 양식 placeholder(MM/DD·{member)·미사용 출장 헤더(출장비)·객체값 잔재([object Object]).
const collectResidueTokens = (ws, { allowTrip }) => {
  const TOKENS = ['MM/DD', '{member', '출장비', '[object Object]'];
  const lastRow = ws.rowCount; // 상한 고정(getCell이 빈 행을 materialize하지 않도록 eachRow 사용).
  const hits = [];
  for (let r = 1; r <= lastRow; r++) {
    ws.getRow(r).eachCell({ includeEmpty: false }, (cell) => {
      const v = cell.value;
      const t = typeof v === 'string' ? v : (v && v.richText ? v.richText.map((x) => x.text).join('') : '');
      if (!t) return;
      TOKENS.forEach((tok) => {
        if (!t.includes(tok)) return;
        if (tok === '출장비' && allowTrip) return; // 출장 섹션 헤더는 정상.
        hits.push(`${cell.address}:"${t}"(${tok})`);
      });
    });
  }
  return hits;
};

describe('fillReceiptWorksheet — 블록별 별도 섹션', () => {
  it('주말 3블록(같은 06/13도 분리) + 출장 1블록 = 4섹션, spacer 1행씩', async () => {
    const blocks = [
      { id: 'w1', type: 'weekend', slotId: 'full0917', dates: ['2026-06-13'],
        members: [
          { id: 'u1', name: '정마스터', position: '차장' },
          { id: 'u2', name: '김현장', position: '과장' },
          { id: 'u3', name: '이부스', position: '대리' },
          { id: 'u4', name: '박접수', position: '사원' },
          { id: 'u5', name: '최진행', position: '사원' },
        ] },
      { id: 'w2', type: 'weekend', slotId: 'am0913', dates: ['2026-06-13'],
        members: [{ id: 'u6', name: '한반일', position: '사원' }] },
      { id: 'w3', type: 'weekend', slotId: 'full0917', dates: ['2026-06-14'],
        members: [
          { id: 'u1', name: '정마스터', position: '차장' },
          { id: 'u3', name: '이부스', position: '대리' },
        ] },
      { id: 't1', type: 'trip', start: '2026-04-16', end: '2026-04-17',
        members: [
          { id: 'u7', name: '윤출장', position: '과장' },
          { id: 'u8', name: '강지방', position: '사원' },
        ] },
    ];
    const { ws, total } = await fill({ blocks, receiver: { name: '김현장', position: '과장' }, todayISO: '2026-06-20' });

    const EXPECTED = 70000 * 5 + 40000 + 70000 * 2 + 40000 * 2; // 610000
    expect(total).toBe(EXPECTED);
    expect(text(ws, 'D4')).toBe(EXPECTED);
    expect(String(text(ws, 'B4'))).toMatch(/원정$/);

    // 섹션1: 헤더(R8) + 인원 5행(R9~13). 같은 날짜라도 합치지 않음.
    expect(text(ws, 'A8')).toBe('06/13(토) 09:00 ~ 17:00 주말 근무');
    expect(text(ws, 'B8')).toBeFalsy();
    expect(text(ws, 'B9')).toBe('정마스터 차장');
    expect(text(ws, 'C9')).toBe(70000);
    expect(text(ws, 'B13')).toBe('최진행 사원');
    expect(text(ws, 'C13')).toBe(70000);

    // spacer R14.
    expect(text(ws, 'A14')).toBeFalsy();
    expect(text(ws, 'B14')).toBeFalsy();
    expect(text(ws, 'C14')).toBeFalsy();

    // 섹션2: 헤더(R15, 반일) + 인원 1행(R16).
    expect(text(ws, 'A15')).toBe('06/13(토) 09:00 ~ 13:00 주말 근무');
    expect(text(ws, 'B16')).toBe('한반일 사원');
    expect(text(ws, 'C16')).toBe(40000);

    // spacer R17.
    expect(text(ws, 'B17')).toBeFalsy();

    // 섹션3: 헤더(R18, 06/14) + 인원 2행(R19~20).
    expect(text(ws, 'A18')).toBe('06/14(일) 09:00 ~ 17:00 주말 근무');
    expect(text(ws, 'B19')).toBe('정마스터 차장');
    expect(text(ws, 'C19')).toBe(70000);
    expect(text(ws, 'B20')).toBe('이부스 대리');

    // spacer R21.
    expect(text(ws, 'B21')).toBeFalsy();

    // 섹션4: 출장 헤더(R22) + 인원 2행(R23~24).
    expect(text(ws, 'A22')).toBe('04/16(목)~04/17(금) 출장비');
    expect(text(ws, 'B23')).toBe('윤출장 과장');
    expect(text(ws, 'C23')).toBe(40000);
    expect(text(ws, 'B24')).toBe('강지방 사원');
    expect(text(ws, 'C24')).toBe(40000);

    // 작성일·영수인은 라벨 추종(섹션 N개로 밀려도 정확).
    const recRow = findReceiverRow(ws);
    expect(text(ws, `D${recRow}`)).toBe('김현장 과장');
    expect(text(ws, `C${recRow - 1}`)).toBe('2026년');
    expect(text(ws, `D${recRow - 1}`)).toBe('6월');
    expect(text(ws, `E${recRow - 1}`)).toBe('20일');
  });

  it('주말 1블록만 — 단일 섹션, 출장 섹션 없음', async () => {
    const blocks = [
      { id: 'w1', type: 'weekend', slotId: 'full0917', dates: ['2026-10-18', '2026-10-19'],
        members: [{ id: 'u1', name: '김단독', position: '대리' }] },
    ];
    const { ws, total } = await fill({ blocks, receiver: { name: '관리자', position: '차장' }, todayISO: '2026-10-20' });

    expect(total).toBe(70000 * 2); // 종일 × 2일 × 1명
    expect(text(ws, 'A8')).toBe('10/18(일), 10/19(월) 09:00 ~ 17:00 주말 근무');
    expect(text(ws, 'B9')).toBe('김단독 대리');
    expect(text(ws, 'C9')).toBe(140000);
    // 두번째 섹션·출장 헤더 없음.
    expect(text(ws, 'A10')).toBeFalsy();
    const recRow = findReceiverRow(ws);
    expect(text(ws, `D${recRow}`)).toBe('관리자 차장');
  });

  it('정렬: 섹션 내 인원은 직급순>이름순', async () => {
    const blocks = [
      { id: 'w1', type: 'weekend', slotId: 'full0917', dates: ['2026-06-13'],
        members: [
          { id: 'a', name: '가사원', position: '사원' },
          { id: 'b', name: '나차장', position: '차장' },
          { id: 'c', name: '다대리', position: '대리' },
        ] },
    ];
    const { ws } = await fill({ blocks, receiver: { name: 'x', position: '과장' }, todayISO: '2026-06-20' });
    expect(text(ws, 'B9')).toBe('나차장 차장');
    expect(text(ws, 'B10')).toBe('다대리 대리');
    expect(text(ws, 'B11')).toBe('가사원 사원');
  });

  it('빈 블록 — 내역 비고 작성일·영수인만', async () => {
    const { ws, total } = await fill({ blocks: [], receiver: { name: '관리자', position: '차장' }, todayISO: '2026-06-20' });
    expect(total).toBe(0);
    expect(String(text(ws, 'B4'))).toMatch(/원정$/);
    const recRow = findReceiverRow(ws);
    expect(text(ws, `D${recRow}`)).toBe('관리자 차장');
  });

  it('주말만(출장 0개) — 미사용 출장 placeholder 0 잔존', async () => {
    const blocks = [
      { id: 'w1', type: 'weekend', slotId: 'full0917', dates: ['2026-06-14'],
        members: [
          { id: 'u1', name: '정마스터', position: '차장' },
          { id: 'u2', name: '김현장', position: '과장' },
        ] },
    ];
    const { ws } = await fill({ blocks, receiver: { name: '관리자', position: '차장' }, todayISO: '2026-06-20' });

    expect(text(ws, 'A8')).toBe('06/14(일) 09:00 ~ 17:00 주말 근무');
    expect(text(ws, 'B9')).toBe('정마스터 차장');
    expect(text(ws, 'B10')).toBe('김현장 과장');

    // 핵심: MM/DD·{member·출장비·[object Object] 등 placeholder/잔재가 0건.
    expect(collectResidueTokens(ws, { allowTrip: false })).toEqual([]);

    // 보존 영역(작성일/영수인/대표이사 귀중)도 정상 추종.
    const recRow = findReceiverRow(ws);
    expect(text(ws, `D${recRow}`)).toBe('관리자 차장');
    expect(text(ws, `C${recRow - 1}`)).toBe('2026년');
  });

  it('출장만(주말 0개) — 미사용 주말 placeholder 0 잔존', async () => {
    const blocks = [
      { id: 't1', type: 'trip', start: '2026-04-16', end: '2026-04-17',
        members: [
          { id: 'u7', name: '윤출장', position: '과장' },
          { id: 'u8', name: '강지방', position: '사원' },
        ] },
    ];
    const { ws } = await fill({ blocks, receiver: { name: '관리자', position: '차장' }, todayISO: '2026-06-20' });

    expect(text(ws, 'A8')).toBe('04/16(목)~04/17(금) 출장비');
    expect(text(ws, 'B9')).toBe('윤출장 과장');
    expect(text(ws, 'C9')).toBe(40000);

    // 핵심: 주말 placeholder(MM/DD·{member) 0건. 의도된 '출장비' 헤더 1개만 정상(allowTrip).
    expect(collectResidueTokens(ws, { allowTrip: true })).toEqual([]);

    const recRow = findReceiverRow(ws);
    expect(text(ws, `D${recRow}`)).toBe('관리자 차장');
  });

  it('날짜 역순 입력(06/14 → 06/13) → 출력은 오름차순(06/13 먼저)', async () => {
    const blocks = [
      { id: 'a', type: 'weekend', slotId: 'full0917', dates: ['2026-06-14'],
        members: [{ id: 'u1', name: '나중사람', position: '대리' }] },
      { id: 'b', type: 'weekend', slotId: 'full0917', dates: ['2026-06-13'],
        members: [{ id: 'u2', name: '먼저사람', position: '대리' }] },
    ];
    const { ws } = await fill({ blocks, receiver: { name: '관리자', position: '차장' }, todayISO: '2026-06-20' });

    // 첫 섹션 헤더 = 06/13(오름차순), 인원행 = 먼저사람.
    expect(text(ws, 'A8')).toBe('06/13(토) 09:00 ~ 17:00 주말 근무');
    expect(text(ws, 'B9')).toBe('먼저사람 대리');
    // spacer R10 후 둘째 섹션 = 06/14.
    expect(text(ws, 'A11')).toBe('06/14(일) 09:00 ~ 17:00 주말 근무');
    expect(text(ws, 'B12')).toBe('나중사람 대리');
  });

  it('같은 날짜면 시간대(slot start) 오름차순', async () => {
    const blocks = [
      { id: 'pm', type: 'weekend', slotId: 'pm1317', dates: ['2026-06-13'], // 13:00 시작
        members: [{ id: 'u1', name: '오후사람', position: '대리' }] },
      { id: 'am', type: 'weekend', slotId: 'am0913', dates: ['2026-06-13'], // 09:00 시작
        members: [{ id: 'u2', name: '오전사람', position: '대리' }] },
    ];
    const { ws } = await fill({ blocks, receiver: { name: '관리자', position: '차장' }, todayISO: '2026-06-20' });
    // 같은 06/13 → 09:00 슬롯이 먼저.
    expect(text(ws, 'A8')).toBe('06/13(토) 09:00 ~ 13:00 주말 근무');
    expect(text(ws, 'A11')).toBe('06/13(토) 13:00 ~ 17:00 주말 근무');
  });
});
