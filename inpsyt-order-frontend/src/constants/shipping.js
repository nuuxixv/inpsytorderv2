// 배송비 정책 기본값 — site_settings 미조회 시 fallback 단일 출처.
// 실제 운영값은 site_settings 테이블이 우선이며, 이 값은 fallback일 뿐이다.
export const SHIPPING_DEFAULTS = {
  FREE_SHIPPING_THRESHOLD: 30000,
  SHIPPING_COST: 3000,
};
