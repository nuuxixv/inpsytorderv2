import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { sortEventsForDropdown, groupEventsForDropdown, formatEventStartDate } from './eventSort';

describe('sortEventsForDropdown', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-13T03:00:00Z')); // KST 2026-07-13 정오
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('오늘±7일 이내 학회를 최상단 고정, 각 그룹 내부 start_date 내림차순, null 맨 뒤', () => {
    const events = [
      { id: 1, start_date: '2026-01-01' }, // 나머지
      { id: 2, start_date: '2026-07-10' }, // 고정(오늘-3)
      { id: 3, start_date: null }, // null
      { id: 4, start_date: '2026-07-16' }, // 고정(오늘+3)
      { id: 5, start_date: '2026-12-01' }, // 나머지
      { id: 6, start_date: '2026-07-05' }, // 나머지(오늘-8, 범위 밖)
    ];
    const sorted = sortEventsForDropdown(events).map((e) => e.id);
    // 고정 그룹(4,2) 내림차순 → 나머지(5:12-01, 6:07-05, 1:01-01) 내림차순 → null(3)
    expect(sorted).toEqual([4, 2, 5, 6, 1, 3]);
  });

  it('배열 아님 방어', () => {
    expect(sortEventsForDropdown(null)).toEqual([]);
    expect(sortEventsForDropdown(undefined)).toEqual([]);
  });

  it('원본 배열을 변형하지 않는다', () => {
    const events = [{ id: 1, start_date: '2026-01-01' }, { id: 2, start_date: '2026-07-10' }];
    const copy = [...events];
    sortEventsForDropdown(events);
    expect(events).toEqual(copy);
  });
});

describe('groupEventsForDropdown', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-13T03:00:00Z')); // KST 2026-07-13 정오
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('혼합: pinned/rest 분리, 각 그룹 내림차순, null은 rest 맨 뒤', () => {
    const events = [
      { id: 1, start_date: '2026-01-01' }, // rest
      { id: 2, start_date: '2026-07-10' }, // pinned(오늘-3)
      { id: 3, start_date: null }, // rest(null)
      { id: 4, start_date: '2026-07-16' }, // pinned(오늘+3)
      { id: 5, start_date: '2026-12-01' }, // rest
      { id: 6, start_date: '2026-07-05' }, // rest(오늘-8, 범위 밖)
    ];
    const { pinned, rest } = groupEventsForDropdown(events);
    expect(pinned.map((e) => e.id)).toEqual([4, 2]);
    expect(rest.map((e) => e.id)).toEqual([5, 6, 1, 3]);
  });

  it('pinned만: rest는 빈 배열', () => {
    const events = [
      { id: 1, start_date: '2026-07-16' },
      { id: 2, start_date: '2026-07-10' },
    ];
    const { pinned, rest } = groupEventsForDropdown(events);
    expect(pinned.map((e) => e.id)).toEqual([1, 2]);
    expect(rest).toEqual([]);
  });

  it('rest만: pinned는 빈 배열', () => {
    const events = [
      { id: 1, start_date: '2026-01-01' },
      { id: 2, start_date: '2026-12-01' },
    ];
    const { pinned, rest } = groupEventsForDropdown(events);
    expect(pinned).toEqual([]);
    expect(rest.map((e) => e.id)).toEqual([2, 1]);
  });

  it('전부 null: pinned 비고 rest에 모두', () => {
    const events = [
      { id: 1, start_date: null },
      { id: 2, start_date: null },
    ];
    const { pinned, rest } = groupEventsForDropdown(events);
    expect(pinned).toEqual([]);
    expect(rest.map((e) => e.id)).toEqual([1, 2]);
  });

  it('배열 아님 방어', () => {
    expect(groupEventsForDropdown(null)).toEqual({ pinned: [], rest: [] });
    expect(groupEventsForDropdown(undefined)).toEqual({ pinned: [], rest: [] });
  });

  it('원본 배열을 변형하지 않는다', () => {
    const events = [{ id: 1, start_date: '2026-01-01' }, { id: 2, start_date: '2026-07-10' }];
    const copy = [...events];
    groupEventsForDropdown(events);
    expect(events).toEqual(copy);
  });
});

describe('formatEventStartDate', () => {
  it('yyyy.M.d 포맷(월·일 0패딩 없음)', () => {
    expect(formatEventStartDate('2026-07-05')).toBe('2026.7.5');
    expect(formatEventStartDate('2026-12-25')).toBe('2026.12.25');
  });
  it('null이면 null', () => {
    expect(formatEventStartDate(null)).toBeNull();
    expect(formatEventStartDate('')).toBeNull();
  });
});
