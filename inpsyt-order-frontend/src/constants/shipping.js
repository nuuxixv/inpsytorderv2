// 배송비 정책 기본값 — site_settings 미조회 시 fallback 단일 출처.
// 실제 운영값은 site_settings 테이블이 우선이며, 이 값은 fallback일 뿐이다.
// (2026-06-01 재배포 트리거: #40 배포 지연 강제 재빌드용 무해 변경)
export const SHIPPING_DEFAULTS = {
  FREE_SHIPPING_THRESHOLD: 30000,
  SHIPPING_COST: 3000,
};
