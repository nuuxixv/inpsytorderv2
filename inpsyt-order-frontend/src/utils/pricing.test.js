import { describe, it, expect } from 'vitest';
import {
  getEffectiveRate,
  getDiscountedUnit,
  percentToRateNullable,
  rateToPercentNullable,
} from './pricing';

// backend 계약 표 — discount_override / is_discountable / eventRate → 기대 실효율.
// 이 7케이스는 백엔드(create-order·마이그레이션)와 등가여야 한다.
describe('getEffectiveRate — backend 계약 7케이스', () => {
  const cases = [
    { n: 1, override: null, is_discountable: true, eventRate: 0.15, expected: 0.15 },
    { n: 2, override: null, is_discountable: false, eventRate: 0.15, expected: 0 },
    { n: 3, override: 0, is_discountable: true, eventRate: 0.15, expected: 0 }, // 명시적 정가
    { n: 4, override: 0.05, is_discountable: true, eventRate: 0.15, expected: 0.05 }, // 낮아도 대체
    { n: 5, override: 0.3, is_discountable: false, eventRate: 0.15, expected: 0.3 }, // F여도 우선
    { n: 6, override: 0.3, is_discountable: true, eventRate: 0, expected: 0.3 },
    { n: 7, override: undefined, is_discountable: true, eventRate: 0.15, expected: 0.15 },
  ];

  cases.forEach(({ n, override, is_discountable, eventRate, expected }) => {
    it(`#${n} override=${override} discountable=${is_discountable} eventRate=${eventRate} → ${expected}`, () => {
      const product = { list_price: 10000, is_discountable };
      if (override !== undefined) product.discount_override = override;
      expect(getEffectiveRate(product, eventRate)).toBe(expected);
    });
  });
});

describe('getDiscountedUnit', () => {
  it('실효율을 정가에 적용하고 반올림한다', () => {
    // #1: 0.15 → 10000 * 0.85 = 8500
    expect(getDiscountedUnit({ list_price: 10000, is_discountable: true }, 0.15)).toBe(8500);
    // #3: override 0 → 정가
    expect(getDiscountedUnit({ list_price: 10000, is_discountable: true, discount_override: 0 }, 0.15)).toBe(10000);
    // #4: override 0.05 → 9500
    expect(getDiscountedUnit({ list_price: 10000, is_discountable: true, discount_override: 0.05 }, 0.15)).toBe(9500);
    // 반올림 — 9900 * 0.85 = 8415
    expect(getDiscountedUnit({ list_price: 9900, is_discountable: true }, 0.15)).toBe(8415);
  });

  it('product/가격 누락 시 0 (graceful)', () => {
    expect(getDiscountedUnit(null, 0.15)).toBe(0);
    expect(getDiscountedUnit({ is_discountable: true }, 0.15)).toBe(0);
  });
});

describe('percentToRateNullable — 공란/0/값 3분기', () => {
  it('공란·null·undefined·비숫자 → null(해제)', () => {
    expect(percentToRateNullable('')).toBe(null);
    expect(percentToRateNullable(null)).toBe(null);
    expect(percentToRateNullable(undefined)).toBe(null);
    expect(percentToRateNullable('abc')).toBe(null);
  });
  it('0 → 0 (명시적 정가, 해제와 구분)', () => {
    expect(percentToRateNullable(0)).toBe(0);
    expect(percentToRateNullable('0')).toBe(0);
  });
  it('값 → clamp(0..100)/100', () => {
    expect(percentToRateNullable(5)).toBe(0.05);
    expect(percentToRateNullable('30')).toBe(0.3);
    expect(percentToRateNullable(150)).toBe(1); // 100% 상한
    expect(percentToRateNullable(-5)).toBe(0); // 하한
  });
});

describe('rateToPercentNullable', () => {
  it('null/undefined → 빈 문자열', () => {
    expect(rateToPercentNullable(null)).toBe('');
    expect(rateToPercentNullable(undefined)).toBe('');
  });
  it('rate → 정수 %', () => {
    expect(rateToPercentNullable(0)).toBe(0);
    expect(rateToPercentNullable(0.05)).toBe(5);
    expect(rateToPercentNullable(0.3)).toBe(30);
  });
});
