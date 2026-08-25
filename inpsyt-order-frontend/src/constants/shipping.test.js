import { describe, it, expect } from 'vitest';
import { shippingBasisAmount, calcShippingFee, combinedOrderTotals, SHIPPING_DEFAULTS } from './shipping';

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

describe('combinedOrderTotals (합배송 묶음 합계)', () => {
  // 저장된 주문 값: total_cost=정가 합, final_payment=할인가 합+delivery_fee
  const orders = [
    { total_cost: 20000, final_payment: 19000, delivery_fee: 3000 }, // 할인가 16000
    { total_cost: 15000, final_payment: 15000, delivery_fee: 0 },    // 할인 없음+무배(현장 등)
  ];

  it('정가 합 = Σ total_cost, 할인가 합 = Σ (final_payment - delivery_fee)', () => {
    expect(combinedOrderTotals(orders)).toEqual({ originalTotal: 35000, discountedTotal: 31000 });
  });

  it('필드 누락(null/undefined) → 0으로 취급', () => {
    expect(combinedOrderTotals([{}, { total_cost: null, final_payment: null, delivery_fee: null }]))
      .toEqual({ originalTotal: 0, discountedTotal: 0 });
  });

  it('결제완료 주문의 잔존 배송비도 할인가 합에서 제외된다 (불변식)', () => {
    // link RPC의 배송비 조정은 final_payment·delivery_fee 를 함께 갱신하므로
    // (final_payment - delivery_fee) = 상품 할인가 합이 조정 전후 동일해야 한다.
    const before = [{ total_cost: 20000, final_payment: 19000, delivery_fee: 3000 }];
    const after = [{ total_cost: 20000, final_payment: 16000, delivery_fee: 0 }]; // 비대표 pending 0처리 후
    expect(combinedOrderTotals(before).discountedTotal).toBe(combinedOrderTotals(after).discountedTotal);
  });

  it('통합 시나리오: 정가 기준은 무료·할인가 기준은 부과 (기준 전환 시 판정 분기)', () => {
    // 정가 합 32000 ≥ 30000 → 무료 / 할인가 합 25000 < 30000 → 부과
    const group = [
      { total_cost: 20000, final_payment: 18000, delivery_fee: 3000 }, // 할인가 15000
      { total_cost: 12000, final_payment: 10000, delivery_fee: 0 },    // 할인가 10000
    ];
    const totals = combinedOrderTotals(group);
    const threshold = SHIPPING_DEFAULTS.FREE_SHIPPING_THRESHOLD;
    expect(shippingBasisAmount({ basis: null, ...totals }) >= threshold).toBe(true);          // 정가(폴백) → 무료
    expect(shippingBasisAmount({ basis: 'list_price', ...totals }) >= threshold).toBe(true);  // 정가 → 무료
    expect(shippingBasisAmount({ basis: 'discounted', ...totals }) >= threshold).toBe(false); // 할인가 → 부과
  });
});
