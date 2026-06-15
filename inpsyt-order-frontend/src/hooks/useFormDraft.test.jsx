// useFormDraft 유닛 테스트 — 키 격리·24h 만료·debounce 저장·복구·삭제.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

const { useAuthMock } = vi.hoisted(() => ({ useAuthMock: vi.fn() }));
vi.mock('./useAuth', () => ({ useAuth: useAuthMock }));

import { useFormDraft } from './useFormDraft';

const U1 = '11111111-1111-1111-1111-111111111111';
const U2 = '22222222-2222-2222-2222-222222222222';

const setUser = (id) => useAuthMock.mockReturnValue({ user: id ? { id } : null });

beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers();
  setUser(U1);
});
afterEach(() => {
  vi.runOnlyPendingTimers();
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe('키 설계·격리', () => {
  it('debounce 2초 후 draft:{type}:{userId}:{targetId} 키로 저장', () => {
    const { result } = renderHook(() => useFormDraft('fieldReport', 'ev-9'));
    act(() => { result.current.saveDraft({ content: 'hi' }); });
    expect(localStorage.getItem('draft:fieldReport:' + U1 + ':ev-9')).toBeNull(); // 아직 debounce 중
    act(() => { vi.advanceTimersByTime(2000); });
    const raw = JSON.parse(localStorage.getItem('draft:fieldReport:' + U1 + ':ev-9'));
    expect(raw.value).toEqual({ content: 'hi' });
    expect(typeof raw.savedAt).toBe('number');
  });

  it('targetId 없으면 :new 키', () => {
    const { result } = renderHook(() => useFormDraft('bulletin', null));
    act(() => { result.current.saveDraft({ title: 'a' }); vi.advanceTimersByTime(2000); });
    expect(localStorage.getItem('draft:bulletin:' + U1 + ':new')).not.toBeNull();
  });

  it('다른 사용자는 같은 type/target이라도 서로의 draft를 못 본다', () => {
    const r1 = renderHook(() => useFormDraft('bulletin', null));
    act(() => { r1.result.current.saveDraft({ title: 'U1 글' }); vi.advanceTimersByTime(2000); });

    setUser(U2);
    const r2 = renderHook(() => useFormDraft('bulletin', null));
    expect(r2.result.current.hasDraft).toBe(false);
    expect(r2.result.current.draft).toBeNull();
  });

  it('type이 다르면 격리(게시판 draft가 준비노트에 안 뜸)', () => {
    const rb = renderHook(() => useFormDraft('bulletin', null));
    act(() => { rb.result.current.saveDraft({ title: 'b' }); vi.advanceTimersByTime(2000); });
    const rp = renderHook(() => useFormDraft('prepNote', null));
    expect(rp.result.current.hasDraft).toBe(false);
  });
});

describe('복구·만료', () => {
  it('유효 draft가 있으면 마운트 시 draft/hasDraft/savedLabel 노출', () => {
    const savedAt = Date.now();
    localStorage.setItem('draft:prepNote:' + U1 + ':ev-1', JSON.stringify({ value: '<p>x</p>', savedAt }));
    const { result } = renderHook(() => useFormDraft('prepNote', 'ev-1'));
    expect(result.current.hasDraft).toBe(true);
    expect(result.current.draft).toBe('<p>x</p>');
    expect(result.current.savedLabel).toMatch(/^\d{2}:\d{2}$/);
  });

  it('24h 초과 draft는 로드 시 무시·삭제', () => {
    const old = Date.now() - 25 * 60 * 60 * 1000;
    const key = 'draft:prepNote:' + U1 + ':ev-1';
    localStorage.setItem(key, JSON.stringify({ value: 'old', savedAt: old }));
    const { result } = renderHook(() => useFormDraft('prepNote', 'ev-1'));
    expect(result.current.hasDraft).toBe(false);
    expect(localStorage.getItem(key)).toBeNull();
  });

  it('손상된 JSON은 무시·삭제', () => {
    const key = 'draft:bulletin:' + U1 + ':new';
    localStorage.setItem(key, '{not json');
    const { result } = renderHook(() => useFormDraft('bulletin', null));
    expect(result.current.hasDraft).toBe(false);
    expect(localStorage.getItem(key)).toBeNull();
  });
});

describe('삭제·비활성', () => {
  it('clearDraft가 키 제거 + 로컬 상태 비움', () => {
    const savedAt = Date.now();
    const key = 'draft:bulletin:' + U1 + ':new';
    localStorage.setItem(key, JSON.stringify({ value: { title: 'a' }, savedAt }));
    const { result } = renderHook(() => useFormDraft('bulletin', null));
    expect(result.current.hasDraft).toBe(true);
    act(() => { result.current.clearDraft(); });
    expect(result.current.hasDraft).toBe(false);
    expect(localStorage.getItem(key)).toBeNull();
  });

  it('enabled:false면 saveDraft no-op', () => {
    const { result } = renderHook(() => useFormDraft('bulletin', null, { enabled: false }));
    act(() => { result.current.saveDraft({ title: 'x' }); vi.advanceTimersByTime(2000); });
    expect(localStorage.getItem('draft:bulletin:' + U1 + ':new')).toBeNull();
  });

  it('비로그인(user 없음)이면 저장·로드 모두 비활성', () => {
    setUser(null);
    const { result } = renderHook(() => useFormDraft('bulletin', null));
    act(() => { result.current.saveDraft({ title: 'x' }); vi.advanceTimersByTime(2000); });
    expect(result.current.hasDraft).toBe(false);
    expect(localStorage.length).toBe(0);
  });
});
