/**
 * 상품별 할인율 오버라이드 공식 — 백엔드(create-order·마이그레이션)와 등가 정본.
 * 이 공식이 어드민 저장·고객 표시·서버 재계산의 단일 진실 소스다.
 *
 *   effectiveRate = discount_override ?? (is_discountable ? eventRate : 0)
 *   discountedUnit = round(list_price * (1 - effectiveRate))
 *
 * discount_override는 0(명시적 정가)과 null/undefined(미지정=행사율 위임)를 구분한다.
 * `??`가 0을 살리므로 0 오버라이드가 행사율을 이긴다.
 */

export const getEffectiveRate = (product, eventRate = 0) => {
  const p = product || {};
  return p.discount_override ?? (p.is_discountable ? eventRate : 0);
};

export const getDiscountedUnit = (product, eventRate = 0) =>
  Math.round(((product && product.list_price) || 0) * (1 - getEffectiveRate(product, eventRate)));

// % 입력(0~100) → 소수 rate. 공란/null/undefined/비숫자 → null(=오버라이드 해제).
// eventForm.percentToRate(공란→0)와 의도가 다르다: 여기선 공란/0/값 3분기가 핵심.
// 100% 초과는 클램프(주문가 음수 방지, eventForm과 동일 방어).
export const percentToRateNullable = (raw) => {
  if (raw === '' || raw == null) return null;
  const n = parseFloat(raw);
  if (!Number.isFinite(n)) return null;
  return Math.min(100, Math.max(0, n)) / 100;
};

// 소수 rate → % 입력값. null/undefined → ''(빈 필드), 아니면 정수 %.
export const rateToPercentNullable = (rate) => {
  if (rate == null) return '';
  return Math.round(rate * 100);
};
