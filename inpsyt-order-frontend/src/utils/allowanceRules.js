// 지불증(수당 영수증) 규정 엔진 — 순수 함수만(React·MUI·DOM 의존 없음).
// 사양: design-system/specs/A10_PaymentReceiptModal.md §2 수당규정 / §7 규정엔진.
//
// 입력 단위 = 「날짜/항목 블록」(엑셀 양식 블록과 1:1):
//   - weekend(주말출근비): 날짜 다중선택 + 시간대(규정 slot) 공통. 1인 수당 = slot 단가 × 날짜수.
//   - trip(출장비):        날짜 범위(start~end). 평일수 = 범위 내 월~금 일수(토·일 제외). 1인 수당 = 20,000 × 평일수.
//     토·일은 출장비에서 제외(주말은 별도 주말출근비 블록으로 받음).
// 블록합 = 1인 수당 × 인원수. 총합 = Σ 블록합.
//
// 중복검증(§2): 같은 인원이 같은 날짜에 주말+출장 양쪽이면 충돌(같은날짜 중복지급 금지).
//   출장 점유일 = 평일만(토·일은 출장 점유 아님 → 같은 주말날짜에 주말블록과 공존 가능).

// ─── 고정 단가 ─────────────────────────────────────────────────
export const HALF_RATE = 40000; // 반일
export const FULL_RATE = 70000; // 종일
export const TRIP_RATE = 20000; // 출장 평일 1일당

// ─── 주말출근 시간대 규정(고정) — slot 단위 선택 ─────────────────
// 반일 40,000 / 종일 70,000. 식사 여부는 라벨 표기용(금액 영향 없음).
export const WEEKEND_SLOTS = [
  { id: 'am0913', label: '09:00~13:00', start: '09:00', end: '13:00', meal: false, rate: HALF_RATE, category: 'half' },
  { id: 'am0914', label: '09:00~14:00', start: '09:00', end: '14:00', meal: true, rate: HALF_RATE, category: 'half' },
  { id: 'am1014', label: '10:00~14:00', start: '10:00', end: '14:00', meal: false, rate: HALF_RATE, category: 'half' },
  { id: 'am1015', label: '10:00~15:00', start: '10:00', end: '15:00', meal: true, rate: HALF_RATE, category: 'half' },
  { id: 'pm1317', label: '13:00~17:00', start: '13:00', end: '17:00', meal: false, rate: HALF_RATE, category: 'half' },
  { id: 'full0917', label: '09:00~17:00', start: '09:00', end: '17:00', meal: null, rate: FULL_RATE, category: 'full' },
  { id: 'full1018', label: '10:00~18:00', start: '10:00', end: '18:00', meal: null, rate: FULL_RATE, category: 'full' },
];

export const DEFAULT_WEEKEND_SLOT_ID = 'full0917';

// slotId → slot 조회. 없으면 기본(종일 09:00~17:00).
export function getWeekendSlot(slotId) {
  return WEEKEND_SLOTS.find((s) => s.id === slotId) || WEEKEND_SLOTS.find((s) => s.id === DEFAULT_WEEKEND_SLOT_ID);
}

// ─── 직급(차장>과장>대리>사원 고정) ───────────────────────────
export const POSITIONS = ['차장', '과장', '대리', '사원'];
export const POSITION_RANK = Object.fromEntries(POSITIONS.map((p, i) => [p, i]));

// ─── 날짜 유틸(date-fns 미사용 — 'YYYY-MM-DD' 문자열 기반) ──────
const parseISO = (iso) => new Date(`${iso}T00:00:00`);

// b − a 일수. (범위 평일 계산용)
export function dayDiff(a, b) {
  if (!a || !b) return 0;
  return Math.round((parseISO(b) - parseISO(a)) / 86400000);
}

// 평일(월~금) 여부. 토(6)·일(0) 제외. 공휴일 무시(연 8일 규모).
const isWeekday = (date) => {
  const d = date.getDay();
  return d !== 0 && d !== 6;
};

// 범위 [start..end] 포함, 월~금 평일 날짜 배열('YYYY-MM-DD'). 토·일 제외.
function tripWeekdayDates(block) {
  const out = [];
  if (!block.start || !block.end) return out;
  const n = dayDiff(block.start, block.end);
  if (n < 0) return out;
  for (let i = 0; i <= n; i++) {
    const d = parseISO(block.start);
    d.setDate(d.getDate() + i);
    if (!isWeekday(d)) continue;
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    out.push(`${d.getFullYear()}-${mm}-${dd}`);
  }
  return out;
}

// ─── 블록 단가·금액 ────────────────────────────────────────────
// 주말 블록 단가 = 선택 slot 단가. slotId 미지정 시 기본 slot.
export function weekendUnit(block) {
  return getWeekendSlot(block.slotId).rate;
}

// 출장 평일수 = 범위 [start..end] 포함, 월~금 평일 일수(토·일 제외). 0~N.
// 예: 04.16(목)~04.17(금) = 2 / 04.16(목)~04.18(토) = 2(토 제외) / 토~일 = 0.
export function tripWeekdays(block) {
  return tripWeekdayDates(block).length;
}

// 1인 수당.
export function perMemberAmount(block) {
  if (block.type === 'weekend') return weekendUnit(block) * (block.dates?.length || 0);
  return TRIP_RATE * tripWeekdays(block);
}

// 블록 합산 = 1인 수당 × 인원수.
export function blockTotal(block) {
  return perMemberAmount(block) * (block.members?.length || 0);
}

// 총합 = Σ 블록합.
export function grandTotal(blocks) {
  return (blocks || []).reduce((sum, b) => sum + blockTotal(b), 0);
}

// 블록이 차지하는 날짜 집합(중복검증·라벨용).
// 출장 = 범위 내 평일만(토·일은 출장 점유 아님 → 같은 주말날짜에 주말블록과 공존 가능).
export function blockDateSet(block) {
  if (block.type === 'weekend') return new Set(block.dates || []);
  return new Set(tripWeekdayDates(block));
}

// ─── 중복검증: 같은 인원이 같은 날짜에 주말+출장 양쪽 ──────────
// 반환: Map<memberId, Set<isoDate>>(충돌 날짜만).
export function computeConflicts(blocks) {
  const byMember = new Map(); // memberId → { weekend:Set, trip:Set }
  (blocks || []).forEach((b) => {
    const dates = blockDateSet(b);
    (b.members || []).forEach((m) => {
      if (!byMember.has(m.id)) byMember.set(m.id, { weekend: new Set(), trip: new Set() });
      const slot = byMember.get(m.id);
      const target = b.type === 'weekend' ? slot.weekend : slot.trip;
      dates.forEach((d) => target.add(d));
    });
  });
  const conflicts = new Map();
  byMember.forEach((slot, mid) => {
    const overlap = [...slot.weekend].filter((d) => slot.trip.has(d));
    if (overlap.length) conflicts.set(mid, new Set(overlap));
  });
  return conflicts;
}

// 지급 인원 수 = 유니크 멤버(1인 수당>0 블록 소속만).
export function paidMemberCount(blocks) {
  const ids = new Set();
  (blocks || []).forEach((b) => {
    if (perMemberAmount(b) > 0) (b.members || []).forEach((m) => ids.add(m.id));
  });
  return ids.size;
}

// 정렬: 직급순(차장>과장>대리>사원) → 이름순.
export function sortMembers(arr) {
  return [...(arr || [])].sort((a, b) => {
    const r = (POSITION_RANK[a.position] ?? 99) - (POSITION_RANK[b.position] ?? 99);
    return r !== 0 ? r : a.name.localeCompare(b.name, 'ko');
  });
}

// ─── 전체 요약(모달·export 공용) ───────────────────────────────
// 반환: { blocks: [{ ...block, slot, unit, weekdays, per, total }], total, paidCount, conflicts }
export function summarize(blocks) {
  const list = (blocks || []).map((b) => ({
    ...b,
    slot: b.type === 'weekend' ? getWeekendSlot(b.slotId) : null,
    unit: b.type === 'weekend' ? weekendUnit(b) : TRIP_RATE,
    weekdays: b.type === 'weekend' ? 0 : tripWeekdays(b),
    per: perMemberAmount(b),
    total: blockTotal(b),
  }));
  return {
    blocks: list,
    total: grandTotal(blocks),
    paidCount: paidMemberCount(blocks),
    conflicts: computeConflicts(blocks),
  };
}
