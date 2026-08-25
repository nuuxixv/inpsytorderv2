import { describe, it, expect, beforeEach } from 'vitest';
import { loadOrderDraft, saveOrderDraft, clearOrderDraft, DEFAULT_CUSTOMER_INFO } from './orderDraft';

const sampleDraft = {
  cart: [{ id: 'p1', name: '검사지', quantity: 2 }],
  customerInfo: { ...DEFAULT_CUSTOMER_INFO, name: '홍길동', phone: '010-1234-5678' },
  activeStep: 1,
};

describe('orderDraft', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('저장 후 같은 slug로 복원', () => {
    saveOrderDraft('kpa-2026', sampleDraft);
    const loaded = loadOrderDraft('kpa-2026');
    expect(loaded.cart).toHaveLength(1);
    expect(loaded.customerInfo.name).toBe('홍길동');
    expect(loaded.activeStep).toBe(1);
  });

  it('다른 행사 slug는 격리(이전 카트가 새지 않음)', () => {
    saveOrderDraft('kpa-2026', sampleDraft);
    expect(loadOrderDraft('otism-2026')).toBeNull();
  });

  it('slug 없으면 저장·복원 no-op', () => {
    saveOrderDraft('', sampleDraft);
    expect(loadOrderDraft('')).toBeNull();
    expect(loadOrderDraft(null)).toBeNull();
  });

  it('빈 진행(카트·입력·스텝 모두 비어있음)은 저장하지 않음', () => {
    saveOrderDraft('kpa-2026', { cart: [], customerInfo: DEFAULT_CUSTOMER_INFO, activeStep: 0 });
    expect(loadOrderDraft('kpa-2026')).toBeNull();
  });

  it('카트 비면 activeStep은 0으로 강제(깨진 리뷰 화면 방지)', () => {
    saveOrderDraft('kpa-2026', { cart: [], customerInfo: { ...DEFAULT_CUSTOMER_INFO, name: '홍' }, activeStep: 2 });
    const loaded = loadOrderDraft('kpa-2026');
    expect(loaded.activeStep).toBe(0);
  });

  it('파싱 실패·구버전 스키마는 조용히 무시', () => {
    sessionStorage.setItem('inpsyt:orderDraft:kpa-2026', '{망가진 json');
    expect(loadOrderDraft('kpa-2026')).toBeNull();

    sessionStorage.setItem('inpsyt:orderDraft:kpa-2026', JSON.stringify({ v: 99, cart: [] }));
    expect(loadOrderDraft('kpa-2026')).toBeNull();
  });

  it('복원 시 누락 customerInfo 필드는 기본값으로 채움', () => {
    sessionStorage.setItem('inpsyt:orderDraft:kpa-2026', JSON.stringify({
      v: 1, cart: [{ id: 'p1', quantity: 1 }], customerInfo: { name: '홍' }, activeStep: 1,
    }));
    const loaded = loadOrderDraft('kpa-2026');
    expect(loaded.customerInfo).toMatchObject({ ...DEFAULT_CUSTOMER_INFO, name: '홍' });
  });

  it('clearOrderDraft로 삭제', () => {
    saveOrderDraft('kpa-2026', sampleDraft);
    clearOrderDraft('kpa-2026');
    expect(loadOrderDraft('kpa-2026')).toBeNull();
  });
});
