import { describe, it, expect } from 'vitest';
import { shippingBasisAmount, calcShippingFee, SHIPPING_DEFAULTS } from './shipping';

describe('shippingBasisAmount', () => {
  const totals = { originalTotal: 50000, discountedTotal: 40000 };

  it("basis 'list_price' → 정가 합계", () => {
    expect(shippingBasisAmount({ basis: 'list_price', ...totals })).toBe(50000);
  });

  it("basis 'discounted' → 할인가(실결제) 합계", () => {
    expect(shippingBasisAmount({ basis: 'discounted', ...totals })).toBe(40000);
  });

  it('basis NULL → 정가 폴백 (현행 동작)', () => {
    expect(shippingBasisAmount({ basis: null, ...totals })).toBe(50000);
  });

  it('basis undefined(컬럼 부재) → 정가 폴백', () => {
    expect(shippingBasisAmount({ basis: undefined, ...totals })).toBe(50000);
  });

  it('0원 주문 → basis 무관 0', () => {
    expect(shippingBasisAmount({ basis: 'discounted', originalTotal: 0, discountedTotal: 0 })).toBe(0);
    expect(shippingBasisAmount({ basis: 'list_price', originalTotal: 0, discountedTotal: 0 })).toBe(0);
  });
});

describe('calcShippingFee', () => {
  const threshold = SHIPPING_DEFAULTS.FREE_SHIPPING_THRESHOLD; // 30000
  const shippingCost = SHIPPING_DEFAULTS.SHIPPING_COST; // 3000

  it('정가 기준: 정가는 임계치 이상이나 할인가는 미만 → 무료 (정가 판정)', () => {
    const fee = calcShippingFee({
      basis: 'list_price', originalTotal: 32000, discountedTotal: 25000, threshold, shippingCost,
    });
    expect(fee).toBe(0);
  });

  it('할인가 기준: 같은 금액 조합 → 배송비 부과 (할인가 판정)', () => {
    const fee = calcShippingFee({
      basis: 'discounted', originalTotal: 32000, discountedTotal: 25000, threshold, shippingCost,
    });
    expect(fee).toBe(3000);
  });

  it('NULL 폴백 → 정가 판정', () => {
    const fee = calcShippingFee({
      basis: null, originalTotal: 32000, discountedTotal: 25000, threshold, shippingCost,
    });
    expect(fee).toBe(0);
  });

  it('0원 주문 → basis 무관 무료', () => {
    expect(calcShippingFee({
      basis: 'discounted', originalTotal: 0, discountedTotal: 0, threshold, shippingCost,
    })).toBe(0);
  });

  it('현장수령 → 항상 무료', () => {
    const fee = calcShippingFee({
      basis: 'list_price', originalTotal: 10000, discountedTotal: 10000, threshold, shippingCost, isOnsite: true,
    });
    expect(fee).toBe(0);
  });

  it('임계치 미만 → 배송비 부과', () => {
    const fee = calcShippingFee({
      basis: 'list_price', originalTotal: 20000, discountedTotal: 20000, threshold, shippingCost,
    });
    expect(fee).toBe(3000);
  });
});
