// 검사/도서/도구 매출 3버킷 합산 + 배송비 할당 (입금결의서·대시보드 공용).
// 규칙 (2026-06-24 건우님 — 도구-검사 합산 정책 영구 폐지, 도구 독립 버킷):
//  - 결제완료 주문만 — status ∈ PAID_STATUSES. 취소·환불·미결제 제외.
//  - 카테고리 분류: 도서 / 검사 / 도구 3-way. 셋 중 어디에도 안 맞으면 unclassified(미분류) 별도 버킷.
//    (이전엔 "그 외=검사" fallback이었으나 집계 오염 방지를 위해 미분류로 격리 + 콘솔 경고)
//  - 배송비 할당(주문당 1회, 우선순위 검사 > 도구 > 도서): 한 주문에 여러 종류가 섞여도
//    배송비는 가장 우선순위 높은 버킷 1곳으로만 귀속(중복 계상 방지). 미분류만 있는 주문은 배송비 미귀속.
//    (기존 "검사 우선" 정신 유지 — 검사가 있으면 검사로. 검사 없고 도구 있으면 도구로.)
//  - 면세(공급가/부가세 분리 없음).
//  - 합계: total = test + book + tool + unclassified (각 버킷에 귀속 배송비 포함).
//
// 도구 분리 전후 total 불변: 도구가 검사에서 빠져 tool 버킷으로 이동할 뿐 총합은 동일.

export const PAID_STATUSES = ['paid', 'completed'];

function isBookCategory(cat) {
  const c = (cat || '').toLowerCase();
  return c.includes('도서') || c.includes('book');
}

function isToolCategory(cat) {
  const c = (cat || '').toLowerCase();
  return c.includes('도구') || c.includes('tool');
}

function isTestCategory(cat) {
  const c = (cat || '').toLowerCase();
  return c.includes('검사') || c.includes('test');
}

/**
 * @param {Array} orders - { status, delivery_fee, order_items:[{category, product_id, price_at_purchase, quantity}] }
 * @param {object} [opts] - { productsMap } 카테고리 보강용(item.category 없을 때)
 * @returns {{ test:number, book:number, tool:number, unclassified:number, total:number,
 *             testShipping:number, bookShipping:number, toolShipping:number }}
 */
export function computeRevenueByCategory(orders, opts = {}) {
  const { productsMap } = opts;
  let test = 0, book = 0, tool = 0, unclassified = 0;
  let testShipping = 0, bookShipping = 0, toolShipping = 0;

  for (const order of orders || []) {
    if (!PAID_STATUSES.includes(order.status)) continue;

    let orderTest = 0, orderBook = 0, orderTool = 0, orderUnclassified = 0;
    for (const item of order.order_items || []) {
      const cat = item.category || (productsMap && productsMap[item.product_id]?.category) || '';
      const amount = (item.price_at_purchase || 0) * (item.quantity || 0);
      // 검사도구처럼 '검사'와 '도구'가 함께 든 라벨은 도구를 우선(도구 독립 버킷 정책).
      if (isToolCategory(cat)) orderTool += amount;
      else if (isBookCategory(cat)) orderBook += amount;
      else if (isTestCategory(cat)) orderTest += amount;
      else {
        orderUnclassified += amount;
        console.warn(`[revenueByCategory] 미분류 카테고리: "${cat}" (product_id=${item.product_id})`);
      }
    }

    test += orderTest;
    book += orderBook;
    tool += orderTool;
    unclassified += orderUnclassified;

    // 배송비 귀속 — 검사 > 도구 > 도서 우선순위로 한 버킷에만.
    const ship = order.delivery_fee || 0;
    if (ship > 0) {
      if (orderTest > 0) { test += ship; testShipping += ship; }
      else if (orderTool > 0) { tool += ship; toolShipping += ship; }
      else if (orderBook > 0) { book += ship; bookShipping += ship; }
      else { unclassified += ship; } // 미분류만 있는 주문 — 배송비도 미분류로
    }
  }

  return {
    test, book, tool, unclassified,
    total: test + book + tool + unclassified,
    testShipping, bookShipping, toolShipping,
  };
}
