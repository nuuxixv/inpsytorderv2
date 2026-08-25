// 배송비 정책 (2026-06-02 건우님 확정):
//   - 주문 금액 30,000원 미만 → 배송비 3,000원 부과
//   - 30,000원 이상       → 무료배송
// 실제 운영값은 site_settings 테이블이 우선이며, 이 상수는 site_settings 미조회 시 fallback.
export const SHIPPING_DEFAULTS = {
  FREE_SHIPPING_THRESHOLD: 30000, // 이 금액 이상이면 무료배송
  SHIPPING_COST: 3000,            // 미만이면 부과되는 배송비
};

// 무료배송 판정 기준 금액. basis: 'discounted'면 할인가(실결제) 합계, 그 외(null/미설정 포함) 정가 합계.
// site_settings.free_shipping_basis 값('list_price' | 'discounted' | NULL) 을 그대로 받는다.
// 기본값·폴백 = 정가 = 현행 동작. 서버(create-order)와 등가로 유지할 것.
export const shippingBasisAmount = ({ basis, originalTotal, discountedTotal }) =>
  basis === 'discounted' ? discountedTotal : originalTotal;

// 합배송 묶음 합계 산출 단일 소스. 저장된 주문 값에서 유도:
//   정가 합   = Σ total_cost
//   할인가 합 = Σ (final_payment - delivery_fee)
// final_payment = 할인가 합 + delivery_fee 불변식은 create-order·합배송 RPC(link/reassign/delete)
// 전 경로가 배송비 조정 시 두 값을 함께 갱신해 유지한다. 서버 RPC와 등가로 유지할 것.
export const combinedOrderTotals = (orders) => ({
  originalTotal: orders.reduce((s, o) => s + (o.total_cost || 0), 0),
  discountedTotal: orders.reduce((s, o) => s + ((o.final_payment || 0) - (o.delivery_fee || 0)), 0),
});

// 배송비 계산 단일 소스. 현장수령·0원·기준 이상은 무료, 그 외 shippingCost.
// 0원 주문은 basis 무관 무료(서버 규칙 동일). 서버(create-order)와 등가로 유지할 것.
export const calcShippingFee = ({
  basis,
  originalTotal,
  discountedTotal,
  threshold,
  shippingCost,
  isOnsite = false,
}) => {
  if (isOnsite) return 0;
  const amount = shippingBasisAmount({ basis, originalTotal, discountedTotal });
  return amount === 0 || amount >= threshold ? 0 : shippingCost;
};
