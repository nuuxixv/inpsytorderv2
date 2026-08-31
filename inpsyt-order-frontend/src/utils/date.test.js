import { describe, it, expect, vi, afterEach } from 'vitest';
import { getTodayKST, getEventStatusKST } from './date';

// 접속 기기의 시간대가 무엇이든 KST 달력 날짜가 나와야 한다.
// 과거 구현은 offset 을 손으로 더해 기기 설정에 의존했다.
const atUtc = (iso) => vi.setSystemTime(new Date(iso));

afterEach(() => vi.useRealTimers());

describe('getTodayKST — 기기 시간대와 무관하게 KST 날짜', () => {
  it('UTC 15:00 은 KST 로 이미 다음 날이다', () => {
    vi.useFakeTimers();
    atUtc('2026-08-30T15:00:00Z');
    expect(getTodayKST()).toBe('2026-08-31');
  });

  it('UTC 14:59 은 아직 같은 날이다 (경계)', () => {
    vi.useFakeTimers();
    atUtc('2026-08-30T14:59:59Z');
    expect(getTodayKST()).toBe('2026-08-30');
  });

  it('KST 자정 직후', () => {
    vi.useFakeTimers();
    atUtc('2026-08-30T15:00:01Z');
    expect(getTodayKST()).toBe('2026-08-31');
  });
});

describe('getEventStatusKST — 시작·종료 당일은 진행중', () => {
  it('종료일 당일 KST 낮이면 아직 진행중', () => {
    vi.useFakeTimers();
    atUtc('2026-08-31T03:00:00Z'); // KST 12:00
    expect(getEventStatusKST('2026-08-29', '2026-08-31').label).toBe('진행중');
  });

  it('종료일 당일 KST 밤 23시도 진행중', () => {
    vi.useFakeTimers();
    atUtc('2026-08-31T14:00:00Z'); // KST 23:00
    expect(getEventStatusKST('2026-08-29', '2026-08-31').label).toBe('진행중');
  });

  it('종료 다음 날 KST 0시 5분이면 종료', () => {
    vi.useFakeTimers();
    atUtc('2026-08-31T15:05:00Z'); // KST 익일 00:05
    expect(getEventStatusKST('2026-08-29', '2026-08-31').label).toBe('종료');
  });

  it('시작 전이면 예정', () => {
    vi.useFakeTimers();
    atUtc('2026-08-31T03:00:00Z');
    expect(getEventStatusKST('2026-09-01', '2026-09-02').label).toBe('예정');
  });

  it('날짜가 비면 미정', () => {
    expect(getEventStatusKST(null, null).label).toBe('미정');
  });
});
