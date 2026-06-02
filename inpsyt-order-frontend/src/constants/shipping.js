// 배송비 정책 (2026-06-02 건우님 확정):
//   - 주문 금액 30,000원 미만 → 배송비 3,000원 부과
//   - 30,000원 이상       → 무료배송
// 실제 운영값은 site_settings 테이블이 우선이며, 이 상수는 site_settings 미조회 시 fallback.
export const SHIPPING_DEFAULTS = {
  FREE_SHIPPING_THRESHOLD: 30000, // 이 금액 이상이면 무료배송
  SHIPPING_COST: 3000,            // 미만이면 부과되는 배송비
};
