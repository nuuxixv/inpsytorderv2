// 검사/도서 매출 합산 + 배송비 할당 (입금결의서·대시보드 공용).
// 규칙 (2026-06-01 건우님):
//  - 결제완료 주문만 — status ∈ PAID_STATUSES. 취소·환불·미결제 제외.
//  - 도구는 검사로 합산. (검사/검사도구 = 검사 버킷)
//  - 배송비 할당: 주문에 검사(또는 도구) 품목이 하나라도 있으면 배송비 → 검사,
//    도서만 있는 주문이면 배송비 → 도서. (검사+도서 혼합 주문은 배송비를 검사로)
//  - 면세(공급가/부가세 분리 없음).
//  - 합계: total = test + book (검사·도서 각각 배송비 포함).
//
// 예: 검사 200,000(배송비 3,000 포함) / 도서 152,500(배송비 6,000 포함) / 전체 352,500

export const PAID_STATUSES = ['paid', 'completed'];

// 도서만 명시 분류하고, 그 외(검사·도구·미분류)는 모두 검사 버킷으로 본다.
function isBookCategory(cat) {
  const c = (cat || '').toLowerCase();
  return c.includes('도서') || c.includes('book');
}

/**
 * @param {Array} orders - { status, delivery_fee, order_items:[{category, product_id, price_at_purchase, quantity}] }
 * @param {object} [opts] - { productsMap } 카테고리 보강용(item.category 없을 때)
 * @returns {{ test:number, book:number, total:number, testShipping:number, bookShipping:number }}
 */
export function computeRevenueByCategory(orders, opts = {}) {
  const { productsMap } = opts;
  let test = 0, book = 0, testShipping = 0, bookShipping = 0;

  for (const order of orders || []) {
    if (!PAID_STATUSES.includes(order.status)) continue;

    let orderTest = 0, orderBook = 0;
    for (const item of order.order_items || []) {
      const cat = item.category || (productsMap && productsMap[item.product_id]?.category) || '';
      const amount = (item.price_at_purchase || 0) * (item.quantity || 0);
      if (isBookCategory(cat)) orderBook += amount;
      else orderTest += amount; // 검사/도구/미분류는 검사 버킷
    }

    const ship = order.delivery_fee || 0;
    if (orderTest > 0) {
      // 검사(또는 검사+도서 혼합) 주문 → 배송비는 검사로
      test += orderTest + ship;
      testShipping += ship;
      book += orderBook;
    } else {
      // 도서만 있는 주문 → 배송비는 도서로
      book += orderBook + ship;
      bookShipping += ship;
    }
  }

  return { test, book, total: test + book, testShipping, bookShipping };
}
