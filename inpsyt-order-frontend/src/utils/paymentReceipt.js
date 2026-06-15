// 지불증(수당 영수증) 엑셀 내보내기 — depositResolution.js 패턴 확장.
// 회사 공통 양식(public/templates/payment-receipt-template.xlsx)을 ExcelJS로 열어
// 「날짜/항목 블록」을 양식에 채워 다운로드한다.
//
// 채우는 시트: "03.지불증 (템플릿)". "(참고)" 시트는 내보낼 때 제거(입금결의서 동일).
//
// 정책(2026-06-15 정정): 입력 블록 1개 = 양식 섹션 1개(별도 렌더). 같은 종류 블록도 합치지 않는다.
//   - 섹션 = [헤더행: A="{날짜라벨} {시간대} 주말 근무"(주말) / "{날짜라벨} 출장비"(출장), B=null]
//            + [인원행 N: B="이름 직급", C=1인 수당].
//   - 섹션 순서 = 주말 블록 전부(입력순) → 출장 블록 전부(입력순). 섹션 간 spacer 1행.
//   - (구) mergeSameType 병합 폐기: 같은 type이라도 입력 블록이 다르면 각각 섹션.
//
// 셀맵(2026-06-08 정정 유지):
//   A1               제목(양식 보유 — 미변경)
//   A4 "금"          양식 보유 라벨
//   B4 / D4          한글금액+원정 / 총합(숫자)
//   섹션 헤더행 A     "{날짜라벨} {slot.start} ~ {slot.end} 주말 근무"(주말) / "{날짜라벨} 출장비"(출장), B=null
//   섹션 인원행 B/C   "이름 직급" / 1인 수당
//   작성일행 C/D/E    YYYY년 · M월 · D일
//   영수인행 D        영수인 "이름 직급"
//
// 동적 행(난점·해결):
//   - 섹션 수·인원 수가 양식 고정 2슬롯과 다르므로, 양식의 헤더행·인원행 서식을 템플릿으로 잡아
//     duplicateRow(서식 상속)로 위에서부터 섹션을 쌓는다(내역 영역에 병합 없음 — A1:B2만 병합).
//   - 작성일/영수인은 섹션 N개로 밀려도 라벨('작성일'/'영수인') 재탐색으로 추종한다.

import ExcelJS from 'exceljs';
import { numberToKoreanCurrency } from './koreanCurrency.js';
import { getTodayKST } from './date.js';
import { perMemberAmount, grandTotal, computeConflicts, sortMembers, getWeekendSlot } from './allowanceRules.js';

const TEMPLATE_URL = '/templates/payment-receipt-template.xlsx';
const TARGET_SHEET = '03.지불증 (템플릿)';
const REF_SHEET = '03.지불증 (참고)';
const OUTPUT_SHEET_NAME = '03.지불증';

// 양식 내역 영역 고정 행(서식 템플릿·재구성 기준).
// 양식 확인: 헤더행(R8)·인원행(R9) 서식이 동일 패턴 → 인원 템플릿 하나로 통일.
const MEMBER_TPL = 9; // 내역 서식 템플릿 행(헤더·인원 공통).
const SECTION_START = 8; // 첫 섹션이 시작하는 행(< 내역 > R7 바로 아래).
const TRIP_SLOT_END = 17; // 양식 원래 내역 영역 마지막 인원행(재구성 시 제거 기준).

const WDAY = ['일', '월', '화', '수', '목', '금', '토'];
const parseISO = (iso) => new Date(`${iso}T00:00:00`);
const dow = (iso) => WDAY[parseISO(iso).getDay()];
const mmdd = (iso) => `${iso.slice(5, 7)}/${iso.slice(8, 10)}`; // 10-16 → 10/16

// 멤버 표시 = "{이름} {직급}"(직급 없으면 이름만).
const memberLabel = (m) => (m.position ? `${m.name} ${m.position}` : m.name);

// 주말 블록 날짜 라벨: "10/18(일), 10/19(월)".
function weekendDateLabel(block) {
  const ds = [...(block.dates || [])].sort();
  if (!ds.length) return '';
  return ds.map((d) => `${mmdd(d)}(${dow(d)})`).join(', ');
}

// 출장 블록 날짜 라벨: "10/16(목)~10/17(금)".
function tripDateLabel(block) {
  if (!block.start || !block.end) return '';
  return `${mmdd(block.start)}(${dow(block.start)})~${mmdd(block.end)}(${dow(block.end)})`;
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

// 주말 블록 시간대 라벨: "{slot.start} ~ {slot.end} 주말 근무"(예 "09:00 ~ 17:00 주말 근무").
function weekendSlotLabel(block) {
  const slot = getWeekendSlot(block.slotId);
  return `${slot.start} ~ ${slot.end} 주말 근무`;
}

// 입력 블록 1개 → 섹션 1개 디스크립터(헤더 라벨 + 정렬된 인원·1인 수당).
// 같은 종류라도 블록을 합치지 않는다(2026-06-15 정책).
function blockToSection(block) {
  const per = perMemberAmount(block);
  const members = sortMembers(block.members || []).map((m) => ({ ...m, amount: per }));
  let headerLabel;
  if (block.type === 'weekend') {
    headerLabel = [weekendDateLabel(block), weekendSlotLabel(block)].filter(Boolean).join(' ');
  } else {
    const dl = tripDateLabel(block);
    headerLabel = dl ? `${dl} 출장비` : '출장비';
  }
  return { headerLabel, members };
}

// 한 행(A~E)의 셀 서식·행 높이를 캡처한다(서식 상속용).
function captureRowStyle(ws, rowNum) {
  const row = ws.getRow(rowNum);
  const cells = {};
  ['A', 'B', 'C', 'D', 'E'].forEach((c) => {
    const cell = ws.getCell(`${c}${rowNum}`);
    cells[c] = {
      font: cell.font,
      alignment: cell.alignment,
      border: cell.border,
      fill: cell.fill,
      numFmt: cell.numFmt,
    };
  });
  return { height: row.height, cells };
}

// start행부터 count개의 빈 행을 삽입하고, 캡처한 서식(tpl)을 입힌다.
function insertFormattedRows(ws, start, count, tpl) {
  const blanks = Array.from({ length: count }, () => []);
  ws.spliceRows(start, 0, ...blanks); // 빈 행 count개 삽입(아래 행은 밀림).
  for (let i = 0; i < count; i++) {
    const r = start + i;
    if (tpl.height != null) ws.getRow(r).height = tpl.height;
    ['A', 'B', 'C', 'D', 'E'].forEach((c) => {
      const cell = ws.getCell(`${c}${r}`);
      const s = tpl.cells[c];
      if (s.font) cell.font = s.font;
      if (s.alignment) cell.alignment = s.alignment;
      if (s.border) cell.border = s.border;
      if (s.fill) cell.fill = s.fill;
      if (s.numFmt) cell.numFmt = s.numFmt;
    });
  }
}

// 섹션 디스크립터의 행 종류 시퀀스를 만든다: [{kind:'header'|'member', ...}].
// 섹션 사이마다 spacer 1행(kind:'spacer')을 끼운다.
function buildRowPlan(sections) {
  const plan = [];
  sections.forEach((sec, si) => {
    if (si > 0) plan.push({ kind: 'spacer' });
    plan.push({ kind: 'header', label: sec.headerLabel });
    sec.members.forEach((m) => plan.push({ kind: 'member', name: memberLabel(m), amount: m.amount }));
  });
  return plan;
}

// 라벨 텍스트로 행을 찾는다(작성일/영수인 — 행 삽입으로 밀린 위치 보정).
function findRowByLabel(ws, label, maxRow) {
  for (let r = 1; r <= maxRow; r++) {
    const row = ws.getRow(r);
    let found = false;
    row.eachCell({ includeEmpty: false }, (cell) => {
      const v = cell.value;
      const text = typeof v === 'string' ? v : (v && v.richText ? v.richText.map((t) => t.text).join('') : '');
      if (text && text.includes(label)) found = true;
    });
    if (found) return r;
  }
  return null;
}

/**
 * 양식 워크시트(ws)에 블록·영수인·총합·작성일을 채운다(순수 ExcelJS — DOM 미접촉).
 * Node 점검 스크립트에서도 재사용 가능하도록 분리.
 * @param {object} ws        - ExcelJS Worksheet(템플릿 시트)
 * @param {object} args
 * @param {Array}  args.blocks
 * @param {object} [args.receiver] - { name, position }
 * @param {string} [args.todayISO] - 'YYYY-MM-DD'(미지정 시 getTodayKST)
 * @returns {{ total:number }}
 */
export function fillReceiptWorksheet(ws, { blocks, receiver, todayISO } = {}) {
  // 섹션 = 주말 블록 전부(입력순) → 출장 블록 전부(입력순). 같은 type도 합치지 않는다(2026-06-15 정책).
  const weekendBlocks = (blocks || []).filter((b) => b.type === 'weekend');
  const tripBlocks = (blocks || []).filter((b) => b.type === 'trip');
  const sections = [...weekendBlocks, ...tripBlocks].map(blockToSection);
  const total = grandTotal(blocks);

  // 내역 영역 행 시퀀스(헤더/인원/섹션간 spacer). 비면 빈 한 행(서식만).
  const plan = buildRowPlan(sections);
  const planLen = Math.max(plan.length, 1);

  // ── 양식 내역 영역을 planLen행으로 결정적 재구성 ──
  // 양식 원래 내역 블록 = SECTION_START(R8) ~ ORIG_AREA_END(R19, 출장 인원 마지막 + spacer 2행) = 12행.
  // 인원 템플릿(MEMBER_TPL=R9) 서식을 캡처 → 원래 영역 제거 → 같은 자리에 인원 서식행 planLen개 삽입.
  // → 내역이 항상 SECTION_START부터 연속. 작성일/영수인은 라벨 재탐색으로 추종(고정 행 가정 폐기).
  const ORIG_AREA_END = TRIP_SLOT_END + 2; // R19.
  const ORIG_AREA_LEN = ORIG_AREA_END - SECTION_START + 1; // 12행.

  const tpl = captureRowStyle(ws, MEMBER_TPL); // 인원행 서식(헤더행도 동일 서식 패턴 — 양식 확인).
  ws.spliceRows(SECTION_START, ORIG_AREA_LEN); // 원래 내역 영역 제거.
  insertFormattedRows(ws, SECTION_START, planLen, tpl); // 같은 자리에 서식행 planLen개 삽입.

  // ── 내역 값 채우기 ──
  plan.forEach((row, i) => {
    const r = SECTION_START + i;
    if (row.kind === 'header') {
      // A열이 좁아 날짜가 잘림 → A에 "{날짜} {항목}"을 합치고 B를 비워 빈 셀로 넘쳐 전체 표시.
      ws.getCell(`A${r}`).value = row.label;
      ws.getCell(`B${r}`).value = null;
      ws.getCell(`C${r}`).value = null;
    } else if (row.kind === 'member') {
      ws.getCell(`A${r}`).value = null;
      ws.getCell(`B${r}`).value = row.name;
      ws.getCell(`C${r}`).value = row.amount;
    } else {
      // spacer: 빈 행.
      ws.getCell(`A${r}`).value = null;
      ws.getCell(`B${r}`).value = null;
      ws.getCell(`C${r}`).value = null;
    }
  });

  // ── 총합(헤더 영역 — 행 재구성 영향 없음) ──
  // B4 = 한글+'원정'(A4 "금"과 합쳐 "금 사십육만원정"), D4 = 숫자.
  ws.getCell('B4').value = `${numberToKoreanCurrency(total)}원정`;
  ws.getCell('D4').value = total;

  // ── 작성일·영수인: 섹션 N개로 밀린 위치를 라벨 재탐색으로 추종 ──
  const todayKST = todayISO || getTodayKST(); // 'YYYY-MM-DD'
  const [yy, mo, da] = todayKST.split('-');
  const maxRow = ws.rowCount + 5;

  // 영수인 행 = '영수인' 라벨 재탐색(주의: '영수'만 쓰면 C6 "정히 영수합니다"가 먼저 매칭됨).
  // 섹션 N개로 밀려도 라벨로 정확히 찾음. 실패 시 원래 영수인 행(21) + 재구성 행수 증감분 보정.
  const recRow = findRowByLabel(ws, '영수인', maxRow) || (21 + (planLen - ORIG_AREA_LEN));
  ws.getCell(`D${recRow}`).value = receiver ? memberLabel(receiver) : '';

  // 작성일 = 영수인 바로 윗행(양식 고정 구조). C"YYYY년" · D"M월" · E"D일"(월/일 0 제거).
  const dateRow = recRow - 1;
  ws.getCell(`C${dateRow}`).value = `${Number(yy)}년`;
  ws.getCell(`D${dateRow}`).value = `${Number(mo)}월`;
  ws.getCell(`E${dateRow}`).value = `${Number(da)}일`;

  return { total };
}

/**
 * 지불증 엑셀을 생성·다운로드한다.
 * @param {object} args
 * @param {object} args.event   - { name, venue, start_date, end_date }(읽기 — 파일명·라벨용)
 * @param {Array}  args.blocks  - [{ type:'weekend'|'trip', timeMode, dates|start/end, members:[{id,name,position}] }]
 * @param {object} [args.receiver] - 영수인 { name, position }(로그인 관리자)
 * @returns {{ total:number }}
 * @throws 중복(같은날짜 주말+출장) 미해결 시 / 양식 로드 실패 시.
 */
export async function exportPaymentReceipt({ event, blocks, receiver }) {
  // 중복(§2) 차단 — 모달이 막지만 export 단에서도 방어.
  if (computeConflicts(blocks).size > 0) {
    throw new Error('같은 날짜에 주말출근비·출장비가 중복 지급된 인원이 있어 내보낼 수 없습니다.');
  }

  const res = await fetch(TEMPLATE_URL);
  if (!res.ok) throw new Error('지불증 양식 파일을 불러오지 못했습니다.');
  const buf = await res.arrayBuffer();

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf);
  const ws = wb.getWorksheet(TARGET_SHEET);
  if (!ws) throw new Error(`양식에 "${TARGET_SHEET}" 시트가 없습니다.`);

  const todayKST = getTodayKST();
  const { total } = fillReceiptWorksheet(ws, { blocks, receiver, todayISO: todayKST });

  // 참고 시트 제거 + 시트명 정리.
  const refWs = wb.getWorksheet(REF_SHEET);
  if (refWs) wb.removeWorksheet(refWs.id);
  ws.name = OUTPUT_SHEET_NAME;

  const out = await wb.xlsx.writeBuffer();
  const blob = new Blob([out], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const safeName = (event?.name || '행사').replace(/[\\/:*?"<>|]/g, '_').slice(0, 40);
  triggerDownload(blob, `지불증_${safeName}_${todayKST}.xlsx`);

  return { total };
}
