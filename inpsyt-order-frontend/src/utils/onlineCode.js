/**
 * 온라인코드 상품 탐지 — 단일 진실 소스. 서버(create-order) 판정과 등가.
 *
 * 판정은 3상태(`includes_online_code`)를 존중한다 — 단순 OR이 아니다:
 *  - `true`  → 포함 확정.
 *  - `false` → 미포함 확정. **문자열 폴백을 타지 않는다(오탐 차단).**
 *  - `null`/`undefined`(미확인 또는 컬럼 미적용) → 상품명 "온라인" 폴백(기존 동작 보존, 회귀 0).
 *
 * 핵심: `false`는 문자열보다 **강하다**. 도서 5건(온라인상담개론·온라인마케팅성공마스터… 등)이
 * 상품명에 "온라인"을 담고 있으나 온라인코드와 무관하다(온라인코드는 검사 전용). 단순 OR이면
 * 플래그를 false로 확정해도 이름 매칭이 살아 오탐이 난다 → false가 폴백을 끊어 이를 막는다.
 *
 * 배경:
 *  - 과거 코드는 `category === '온라인코드' || name.includes('온라인')` 였다. category 도메인은
 *    검사/도서/도구뿐 → `=== '온라인코드'`는 절대 참이 될 수 없는 죽은 조건(제거해도 무회귀).
 *  - 이름 매칭만으로는 온라인코드를 포함한 SET 상품 대부분이 이름에 "온라인"이 없어 누락됐다.
 *    `includes_online_code` 플래그가 이 갭을 메운다(true로 확정).
 *
 * 상품명 필드는 컨텍스트마다 다르다: 주문서 장바구니 = `item.name`,
 * 출고 order_items 스냅샷 = `item.product_name`. 둘 다 확인한다.
 */

const nameHasOnline = (item) => {
  const name = item?.name ?? item?.product_name ?? '';
  return typeof name === 'string' && name.includes('온라인');
};

// 단일 품목 판정 — 3상태 존중. true=포함, false=미포함(폴백 차단), null/undefined=이름 폴백.
export const itemHasOnlineCode = (item) => {
  if (!item) return false;
  // 카트 아이템은 플래그가 자기 자신에, 출고 order_items는 join된 products에 실린다.
  const flag = item.includes_online_code ?? item.products?.includes_online_code;
  if (flag === true) return true;
  if (flag === false) return false;
  return nameHasOnline(item);
};

// 장바구니/주문 품목 배열 중 하나라도 온라인코드면 true.
export const hasOnlineCode = (items = []) => (items || []).some(itemHasOnlineCode);

// 주문 단위 판정 — orders.has_online_code 컬럼(boolean)이 있으면 우선 신뢰,
// null/undefined(미계산·컬럼 미적용)면 order_items 스냅샷(product_name)으로 폴백.
export const orderHasOnlineCode = (order) => {
  if (typeof order?.has_online_code === 'boolean') return order.has_online_code;
  return hasOnlineCode(order?.mergedItems || order?.order_items);
};
