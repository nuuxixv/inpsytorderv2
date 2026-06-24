// revenueByCategory 순수 유닛 테스트 — React·MUI 미접촉(EMFILE 회피).
// 핵심 회귀 보호: 도구 독립 3버킷화(2026-06-24) 후에도 total 불변.
import { describe, it, expect, vi } from 'vitest';
import { computeRevenueByCategory, PAID_STATUSES } from './revenueByCategory';

const order = (status, deliveryFee, items) => ({
  status,
  delivery_fee: deliveryFee,
  order_items: items.map(([category, price, qty]) => ({
    category, price_at_purchase: price, quantity: qty,
  })),
});

describe('PAID_STATUSES', () => {
  it('paid·completed만 매출 대상', () => {
    expect(PAID_STATUSES).toEqual(['paid', 'completed']);
  });
});

describe('computeRevenueByCategory — 3버킷 분류', () => {
  it('검사/도서/도구를 각 버킷으로 분리한다', () => {
    const r = computeRevenueByCategory([
      order('paid', 0, [['검사', 100000, 1]]),
      order('paid', 0, [['도서', 20000, 1]]),
      order('paid', 0, [['도구', 30000, 1]]),
    ]);
    expect(r.test).toBe(100000);
    expect(r.book).toBe(20000);
    expect(r.tool).toBe(30000);
    expect(r.unclassified).toBe(0);
    expect(r.total).toBe(150000);
  });

  it('"검사도구" 라벨은 도구 버킷(도구 우선 판정)', () => {
    const r = computeRevenueByCategory([order('paid', 0, [['검사도구', 35000, 1]])]);
    expect(r.tool).toBe(35000);
    expect(r.test).toBe(0);
  });

  it('미분류 카테고리는 unclassified 버킷 + 콘솔 경고("그 외=검사" fallback 폐지)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const r = computeRevenueByCategory([order('paid', 0, [['소모품', 5000, 2]])]);
    expect(r.unclassified).toBe(10000);
    expect(r.test).toBe(0);
    expect(r.total).toBe(10000);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('결제완료 아닌 주문(pending/cancelled/refunded)은 제외', () => {
    const r = computeRevenueByCategory([
      order('pending', 3000, [['검사', 88000, 1]]),
      order('cancelled', 0, [['도서', 18000, 1]]),
      order('refunded', 0, [['도구', 30000, 1]]),
    ]);
    expect(r.total).toBe(0);
  });
});

describe('computeRevenueByCategory — 배송비 우선순위(검사 > 도구 > 도서)', () => {
  it('검사가 있으면 배송비는 검사로', () => {
    const r = computeRevenueByCategory([
      order('paid', 3000, [['검사', 100000, 1], ['도구', 30000, 1], ['도서', 20000, 1]]),
    ]);
    expect(r.testShipping).toBe(3000);
    expect(r.toolShipping).toBe(0);
    expect(r.bookShipping).toBe(0);
    expect(r.test).toBe(103000);
  });

  it('검사 없고 도구 있으면 배송비는 도구로', () => {
    const r = computeRevenueByCategory([
      order('paid', 3000, [['도구', 30000, 1], ['도서', 20000, 1]]),
    ]);
    expect(r.toolShipping).toBe(3000);
    expect(r.bookShipping).toBe(0);
    expect(r.tool).toBe(33000);
  });

  it('도서만 있으면 배송비는 도서로', () => {
    const r = computeRevenueByCategory([order('paid', 6000, [['도서', 20000, 1]])]);
    expect(r.bookShipping).toBe(6000);
    expect(r.book).toBe(26000);
  });
});

describe('도구 분리 전후 total 불변 (회귀 보호)', () => {
  // 도구가 검사에서 빠져 tool 버킷으로 이동할 뿐 — 총합은 동일해야 한다.
  it('검사도구가 섞인 주문 세트의 total은 도구 분리 전(검사 합산)과 동일', () => {
    const orders = [
      order('paid', 3000, [['검사', 88000, 2], ['검사도구', 35000, 1]]),
      order('completed', 3000, [['검사', 120000, 1]]),
      order('paid', 6000, [['도서', 18000, 3], ['도서', 25000, 2]]),
      order('paid', 3000, [['검사', 88000, 1], ['도서', 22000, 1]]),
    ];
    const r = computeRevenueByCategory(orders);

    // 도구 분리 전 정의(도구=검사, 미분류=검사, 배송비 검사 우선)로 total 재계산
    let test = 0, book = 0;
    for (const o of orders) {
      let ot = 0, ob = 0;
      for (const it of o.order_items) {
        const c = (it.category || '').toLowerCase();
        const amt = it.price_at_purchase * it.quantity;
        if (c.includes('도서') || c.includes('book')) ob += amt; else ot += amt;
      }
      const ship = o.delivery_fee || 0;
      if (ot > 0) { test += ot + ship; book += ob; } else { book += ob + ship; }
    }
    const oldTotal = test + book;

    expect(r.total).toBe(oldTotal);
    expect(r.tool).toBe(35000); // 검사도구 1세트가 도구 버킷으로 분리됨
    expect(r.unclassified).toBe(0);
  });
});
