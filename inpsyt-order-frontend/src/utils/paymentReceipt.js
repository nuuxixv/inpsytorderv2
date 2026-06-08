// 지불증(수당 영수증) 엑셀 내보내기 — depositResolution.js 패턴 확장.
// 회사 공통 양식(public/templates/payment-receipt-template.xlsx)을 ExcelJS로 열어
// 「날짜/항목 블록」을 양식 블록(주말근무/출장)에 채워 다운로드한다.
//
// 채우는 시트: "03.지불증 (템플릿)". "(참고)" 시트는 내보낼 때 제거(입금결의서 동일).
//
// 양식 기본 슬롯(셀맵 — 위임 지시서 2026-06-08 정정):
//   A1               제목(양식 보유 — 미변경)
//   A4 "금"          양식 보유 라벨
//   B4 / D4          한글금액+원정 / 총합(숫자)  ← B4·D4 맞바꿈 + B4에 '원정'
//   [주말근무 블록]   A8 "{날짜라벨} {slot.start} ~ {slot.end} 주말 근무"(A열 병합) · B8 비움 · B9~B11 "이름 직급" · C9~C11 수당
//   [출장 블록]       A14 "{날짜라벨} 출장비"(A열 병합) · B14 비움 · B15~B17 "이름 직급" · C15~C17 수당
//   C20·D20·E20      작성일(YYYY/MM/DD)
//   D21              영수인
//
// 동적 행(난점·해결):
//   - 멤버가 양식 기본 슬롯(블록당 3행)을 넘으면 행 삽입이 필요하고, 삽입하면 아래 블록·작성일·영수인 행이 밀린다.
//   - 해결: ① 아래쪽(출장) 블록부터 멤버 확장 → 위 블록(주말) 행 번호 불변.
//          ② 멤버 확장은 duplicateRow(마지막 슬롯 서식 상속)로 슬롯을 늘린다.
//          ③ 작성일/영수인은 고정 행 가정 대신 라벨('작성일'/'영수인') 재탐색(getRow)으로 위치 보정.
//   - 다중 주말/다중 출장 블록(드묾): 양식 슬롯이 종류별 1블록이라, 같은 종류 추가 블록의 멤버는
//     해당 블록 슬롯에 합쳐 넣고 날짜 라벨을 병기한다(연 8일 규모 — 양식 블록 증식은 과설계).

import ExcelJS from 'exceljs';
import { numberToKoreanCurrency } from './koreanCurrency.js';
import { getTodayKST } from './date.js';
import { perMemberAmount, grandTotal, computeConflicts, sortMembers, getWeekendSlot } from './allowanceRules.js';

const TEMPLATE_URL = '/templates/payment-receipt-template.xlsx';
const TARGET_SHEET = '03.지불증 (템플릿)';
const REF_SHEET = '03.지불증 (참고)';
const OUTPUT_SHEET_NAME = '03.지불증';

// 양식 기본 슬롯(행).
const WK_HEADER = 8;
const WK_SLOT_START = 9;
const WK_SLOT_END = 11;
const TRIP_HEADER = 14;
const TRIP_SLOT_START = 15;
const TRIP_SLOT_END = 17;

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

// 한 블록의 멤버 행을 [slotStart..slotEnd] 슬롯에 채운다.
// 멤버가 슬롯보다 많으면 마지막 슬롯 서식을 상속해 부족분을 아래로 삽입한다.
// 반환: 삽입한 추가 행 수(아래 영역 행 번호 보정용).
function fillMemberSlots(ws, slotStart, slotEnd, members) {
  const slotCount = slotEnd - slotStart + 1;
  const need = members.length;
  let inserted = 0;
  if (need > slotCount) {
    inserted = need - slotCount;
    // duplicateRow(rowNum, count, insert=true): rowNum 아래에 서식 복제 행 삽입.
    ws.duplicateRow(slotEnd, inserted, true);
  }
  for (let i = 0; i < need; i++) {
    const r = slotStart + i;
    ws.getCell(`B${r}`).value = memberLabel(members[i]);
    ws.getCell(`C${r}`).value = members[i].amount;
  }
  // 미사용 기본 슬롯 비움(멤버 < 기본 슬롯일 때).
  for (let i = need; i < slotCount; i++) {
    const r = slotStart + i;
    ws.getCell(`B${r}`).value = null;
    ws.getCell(`C${r}`).value = null;
  }
  return inserted;
}

// 주말 블록 시간대 라벨: "{slot.start} ~ {slot.end} 주말 근무"(예 "09:00 ~ 17:00 주말 근무"). A8 날짜라벨에 병합.
function weekendSlotLabel(block) {
  const slot = getWeekendSlot(block.slotId);
  return `${slot.start} ~ ${slot.end} 주말 근무`;
}

// 1인 수당 부착 + 정렬(직급순>이름순). 같은 종류 블록을 하나로 합쳐 양식 슬롯에 넣는다.
// slotLabel: 주말 블록의 시간대 라벨(시간대 다르면 '; '로 병기 — 단일 블록이 일반). A8 날짜라벨에 병합.
function mergeSameType(blocks) {
  const members = [];
  const labels = [];
  const slotLabels = [];
  blocks.forEach((b) => {
    const per = perMemberAmount(b);
    sortMembers(b.members || []).forEach((m) => members.push({ ...m, amount: per }));
    const label = b.type === 'weekend' ? weekendDateLabel(b) : tripDateLabel(b);
    if (label) labels.push(label);
    if (b.type === 'weekend') {
      const sl = weekendSlotLabel(b);
      if (!slotLabels.includes(sl)) slotLabels.push(sl);
    }
  });
  return { members, dateLabel: labels.join('; '), slotLabel: slotLabels.join('; ') };
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
  const weekendBlocks = (blocks || []).filter((b) => b.type === 'weekend');
  const tripBlocks = (blocks || []).filter((b) => b.type === 'trip');
  const total = grandTotal(blocks);

  // 멤버 슬롯 확장으로 삽입된 행 수(작성일/영수인 행 보정용).
  // 출장 확장 → 작성일/영수인을 밂. 주말 확장 → 출장 영역 + 작성일/영수인을 밂.
  let insertedBelow = 0;

  // ── 출장 블록(아래쪽) 먼저: 위 블록(주말) 행 번호가 안 밀리게 ──
  if (tripBlocks.length === 0) {
    ws.getCell(`A${TRIP_HEADER}`).value = null;
    ws.getCell(`B${TRIP_HEADER}`).value = null;
    for (let r = TRIP_SLOT_START; r <= TRIP_SLOT_END; r++) {
      ws.getCell(`B${r}`).value = null;
      ws.getCell(`C${r}`).value = null;
    }
  } else {
    const trip = mergeSameType(tripBlocks);
    // A열이 좁아 범위 날짜가 잘림 → A14에 "{날짜} 출장비"를 합치고 B14를 비워 빈 셀로 넘쳐 전체 표시.
    ws.getCell(`A${TRIP_HEADER}`).value = trip.dateLabel ? `${trip.dateLabel} 출장비` : '출장비';
    ws.getCell(`B${TRIP_HEADER}`).value = null;
    insertedBelow += fillMemberSlots(ws, TRIP_SLOT_START, TRIP_SLOT_END, trip.members);
  }

  // ── 주말 블록(위쪽) ──
  if (weekendBlocks.length === 0) {
    ws.getCell(`A${WK_HEADER}`).value = null;
    ws.getCell(`B${WK_HEADER}`).value = null;
    for (let r = WK_SLOT_START; r <= WK_SLOT_END; r++) {
      ws.getCell(`B${r}`).value = null;
      ws.getCell(`C${r}`).value = null;
    }
  } else {
    const wk = mergeSameType(weekendBlocks);
    // A열 날짜가 좁아 잘림 → A8에 "{날짜} {시간대 라벨}"을 합치고 B8을 비워 전체 표시(출장 블록과 일관).
    ws.getCell(`A${WK_HEADER}`).value = [wk.dateLabel, wk.slotLabel].filter(Boolean).join(' ');
    ws.getCell(`B${WK_HEADER}`).value = null;
    // 주말 확장은 출장 영역·작성일·영수인을 함께 아래로 민다.
    insertedBelow += fillMemberSlots(ws, WK_SLOT_START, WK_SLOT_END, wk.members);
  }

  // ── 총합(헤더 영역 — 행 삽입 영향 없음) ──
  // B4 = 한글+'원정'(A4 "금"과 합쳐 "금 사십육만원정"), D4 = 숫자.
  ws.getCell('B4').value = `${numberToKoreanCurrency(total)}원정`;
  ws.getCell('D4').value = total;

  // ── 작성일·영수인: 멤버 삽입으로 밀린 행 수만큼 보정해 기록 ──
  // 1차로 삽입 행 수(insertedBelow)로 기본 행(20·21)을 보정하고,
  // 라벨 재탐색이 성공하면 그 결과를 우선(양식 라벨 텍스트가 있으면 가장 정확).
  const todayKST = todayISO || getTodayKST(); // 'YYYY-MM-DD'
  const [yy, mo, da] = todayKST.split('-');
  const maxRow = ws.rowCount + 5;

  // 영수인 행 = '영수인' 라벨 재탐색(주의: '영수'만 쓰면 C6 "정히 영수합니다"가 먼저 매칭됨).
  // 멤버 삽입으로 밀려도 라벨로 정확히 찾음. 실패 시 기본행(21)+삽입분 보정.
  const recRow = findRowByLabel(ws, '영수인', maxRow) || (21 + insertedBelow);
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
