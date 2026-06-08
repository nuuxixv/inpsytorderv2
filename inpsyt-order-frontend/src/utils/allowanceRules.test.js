// allowanceRules 순수 유닛 테스트 — React·MUI 미접촉(EMFILE 회피).
import { describe, it, expect } from 'vitest';
import {
  HALF_RATE, FULL_RATE, TRIP_RATE,
  WEEKEND_SLOTS, DEFAULT_WEEKEND_SLOT_ID, getWeekendSlot,
  dayDiff, weekendUnit, tripNights, perMemberAmount, blockTotal,
  grandTotal, blockDateSet, computeConflicts, paidMemberCount, sortMembers, summarize,
} from './allowanceRules';

const M = (id, name, position = '사원', adhoc = false) => ({ id, name, position, adhoc });

describe('단가 상수', () => {
  it('반일40k·종일70k·출장20k', () => {
    expect([HALF_RATE, FULL_RATE, TRIP_RATE]).toEqual([40000, 70000, 20000]);
  });
});

describe('WEEKEND_SLOTS 규정', () => {
  it('7개 slot (반일5·종일2)', () => {
    expect(WEEKEND_SLOTS).toHaveLength(7);
    expect(WEEKEND_SLOTS.filter((s) => s.category === 'half')).toHaveLength(5);
    expect(WEEKEND_SLOTS.filter((s) => s.category === 'full')).toHaveLength(2);
  });
  it('반일 slot 단가 = 40,000', () => {
    WEEKEND_SLOTS.filter((s) => s.category === 'half').forEach((s) => expect(s.rate).toBe(40000));
  });
  it('종일 slot 단가 = 70,000', () => {
    WEEKEND_SLOTS.filter((s) => s.category === 'full').forEach((s) => expect(s.rate).toBe(70000));
  });
  it('식사 표기: am0914·am1015 식사O / am0913·am1014·pm1317 식사X', () => {
    expect(getWeekendSlot('am0914').meal).toBe(true);
    expect(getWeekendSlot('am1015').meal).toBe(true);
    expect(getWeekendSlot('am0913').meal).toBe(false);
    expect(getWeekendSlot('am1014').meal).toBe(false);
    expect(getWeekendSlot('pm1317').meal).toBe(false);
  });
});

describe('getWeekendSlot', () => {
  it('id로 slot 조회', () => {
    expect(getWeekendSlot('full0917')).toMatchObject({ start: '09:00', end: '17:00', rate: 70000 });
    expect(getWeekendSlot('pm1317')).toMatchObject({ start: '13:00', end: '17:00', rate: 40000 });
  });
  it('미지정·없는 id → 기본 slot(full0917)', () => {
    expect(getWeekendSlot(undefined).id).toBe(DEFAULT_WEEKEND_SLOT_ID);
    expect(getWeekendSlot('nope').id).toBe(DEFAULT_WEEKEND_SLOT_ID);
  });
});

describe('dayDiff', () => {
  it('종료−시작 일수', () => {
    expect(dayDiff('2026-10-16', '2026-10-17')).toBe(1);
    expect(dayDiff('2026-10-16', '2026-10-19')).toBe(3);
    expect(dayDiff('2026-10-16', '2026-10-16')).toBe(0);
  });
  it('월 경계도 정확', () => {
    expect(dayDiff('2026-10-31', '2026-11-02')).toBe(2);
  });
  it('빈 입력은 0', () => {
    expect(dayDiff(null, '2026-10-17')).toBe(0);
    expect(dayDiff('2026-10-16', null)).toBe(0);
  });
});

describe('주말출근비 블록 (slot 기반)', () => {
  const block = {
    type: 'weekend', slotId: 'full0917',
    dates: ['2026-10-18', '2026-10-19'],
    members: [M('a', '정과장', '과장'), M('b', '이사원', '사원')],
  };
  it('종일 slot 단가 = 70,000', () => {
    expect(weekendUnit(block)).toBe(70000);
  });
  it('반일 slot 단가 = 40,000', () => {
    expect(weekendUnit({ ...block, slotId: 'pm1317' })).toBe(40000);
  });
  it('slotId 미지정 → 기본 slot(종일 70,000)', () => {
    expect(weekendUnit({ ...block, slotId: undefined })).toBe(70000);
  });
  it('1인 수당 = slot 단가 × 날짜수 (70000×2=140000)', () => {
    expect(perMemberAmount(block)).toBe(140000);
  });
  it('블록합 = 1인 × 인원수 (140000×2=280000)', () => {
    expect(blockTotal(block)).toBe(280000);
  });
  it('반일 slot 2일 2명 = 40000×2×2 = 160000', () => {
    expect(blockTotal({ ...block, slotId: 'am0913' })).toBe(160000);
  });
  it('날짜 0개면 1인 0원', () => {
    expect(perMemberAmount({ ...block, dates: [] })).toBe(0);
  });
});

describe('출장비 블록', () => {
  const block = {
    type: 'trip', start: '2026-10-16', end: '2026-10-17',
    members: [M('a', '정과장', '과장'), M('b', '이사원', '사원')],
  };
  it('박수 = 범위(종료−시작) 그대로 (목~금 = 1박)', () => {
    expect(tripNights(block)).toBe(1);
  });
  it('2박 이상도 범위로 (16~19 = 3박)', () => {
    expect(tripNights({ ...block, end: '2026-10-19' })).toBe(3);
  });
  it('평일 필터 없음 — 주말 포함 범위도 일수 그대로 (토~월 = 2박)', () => {
    expect(tripNights({ ...block, start: '2026-10-17', end: '2026-10-19' })).toBe(2);
  });
  it('1인 수당 = 20,000 × 박수 (20000×1=20000)', () => {
    expect(perMemberAmount(block)).toBe(20000);
  });
  it('블록합 = 20000×1×2 = 40000', () => {
    expect(blockTotal(block)).toBe(40000);
  });
  it('범위 미선택이면 0박·0원', () => {
    expect(tripNights({ ...block, start: null, end: null })).toBe(0);
    expect(perMemberAmount({ ...block, start: null, end: null })).toBe(0);
  });
});

describe('grandTotal', () => {
  it('Σ 블록합', () => {
    const blocks = [
      { type: 'weekend', slotId: 'full0917', dates: ['2026-10-18', '2026-10-19'], members: [M('a'), M('b')] }, // 280000
      { type: 'trip', start: '2026-10-16', end: '2026-10-17', members: [M('a'), M('b')] }, // 40000
    ];
    expect(grandTotal(blocks)).toBe(320000);
  });
  it('빈 배열 0', () => {
    expect(grandTotal([])).toBe(0);
  });
});

describe('blockDateSet', () => {
  it('weekend = dates 그대로', () => {
    const set = blockDateSet({ type: 'weekend', dates: ['2026-10-18', '2026-10-19'] });
    expect([...set].sort()).toEqual(['2026-10-18', '2026-10-19']);
  });
  it('trip = start~end 전 날짜 전개(귀가일 포함)', () => {
    const set = blockDateSet({ type: 'trip', start: '2026-10-16', end: '2026-10-18' });
    expect([...set].sort()).toEqual(['2026-10-16', '2026-10-17', '2026-10-18']);
  });
  it('월 경계 전개', () => {
    const set = blockDateSet({ type: 'trip', start: '2026-10-31', end: '2026-11-01' });
    expect([...set].sort()).toEqual(['2026-10-31', '2026-11-01']);
  });
});

describe('computeConflicts (§2 같은날짜 중복지급)', () => {
  it('같은 인원·같은 날짜 주말+출장 → 충돌', () => {
    const blocks = [
      { type: 'weekend', slotId: 'full0917', dates: ['2026-10-17'], members: [M('a', '정과장', '과장')] },
      { type: 'trip', start: '2026-10-16', end: '2026-10-17', members: [M('a', '정과장', '과장')] }, // 16,17 포함 → 17 겹침
    ];
    const c = computeConflicts(blocks);
    expect(c.has('a')).toBe(true);
    expect([...c.get('a')]).toEqual(['2026-10-17']);
  });
  it('금 출장 + 토·일 주말(날짜 다름) → 충돌 아님', () => {
    const blocks = [
      { type: 'trip', start: '2026-10-16', end: '2026-10-16', members: [M('a')] }, // 금 16
      { type: 'weekend', slotId: 'full0917', dates: ['2026-10-17', '2026-10-18'], members: [M('a')] }, // 토·일
    ];
    expect(computeConflicts(blocks).size).toBe(0);
  });
  it('다른 인원은 서로 충돌 아님', () => {
    const blocks = [
      { type: 'weekend', slotId: 'full0917', dates: ['2026-10-17'], members: [M('a')] },
      { type: 'trip', start: '2026-10-17', end: '2026-10-17', members: [M('b')] },
    ];
    expect(computeConflicts(blocks).size).toBe(0);
  });
  it('충돌 없으면 빈 Map', () => {
    expect(computeConflicts([]).size).toBe(0);
  });
});

describe('paidMemberCount (유니크·1인수당>0)', () => {
  it('여러 블록 중복 카운트 방지', () => {
    const blocks = [
      { type: 'weekend', slotId: 'full0917', dates: ['2026-10-18'], members: [M('a'), M('b')] },
      { type: 'trip', start: '2026-10-16', end: '2026-10-17', members: [M('a'), M('c')] }, // a 중복
    ];
    expect(paidMemberCount(blocks)).toBe(3); // a,b,c
  });
  it('1인 수당 0(날짜 미선택) 블록은 미집계', () => {
    const blocks = [
      { type: 'weekend', slotId: 'full0917', dates: [], members: [M('a'), M('b')] }, // 0원
    ];
    expect(paidMemberCount(blocks)).toBe(0);
  });
});

describe('sortMembers (직급순>이름순)', () => {
  it('차장>과장>대리>사원, 동급은 이름순', () => {
    const arr = [
      M('1', '최사원', '사원'), M('2', '박차장', '차장'),
      M('3', '강사원', '사원'), M('4', '정과장', '과장'),
    ];
    expect(sortMembers(arr).map((m) => m.name)).toEqual(['박차장', '정과장', '강사원', '최사원']);
  });
  it('원본 불변', () => {
    const arr = [M('1', 'b', '사원'), M('2', 'a', '사원')];
    const copy = [...arr];
    sortMembers(arr);
    expect(arr).toEqual(copy);
  });
});

describe('summarize', () => {
  it('블록별 unit/nights/per/total + 총합·인원·충돌', () => {
    const blocks = [
      { type: 'weekend', slotId: 'full0917', dates: ['2026-10-18', '2026-10-19'], members: [M('a'), M('b')] },
      { type: 'trip', start: '2026-10-16', end: '2026-10-17', members: [M('a')] },
    ];
    const s = summarize(blocks);
    expect(s.total).toBe(280000 + 20000);
    expect(s.paidCount).toBe(2); // a,b
    expect(s.conflicts.size).toBe(0);
    expect(s.blocks[0]).toMatchObject({ unit: 70000, per: 140000, total: 280000 });
    expect(s.blocks[0].slot).toMatchObject({ id: 'full0917', rate: 70000 });
    expect(s.blocks[1]).toMatchObject({ unit: 20000, nights: 1, per: 20000, total: 20000 });
    expect(s.blocks[1].slot).toBeNull();
  });
});
