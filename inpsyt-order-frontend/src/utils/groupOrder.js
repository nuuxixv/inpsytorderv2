// 합배송(껍데기 부모 + 자식) 공유 헬퍼.
// 목록·모달·고객·출고 화면이 종합 상태·이름 요약·트리 구성을 동일 규칙으로 쓴다.
// 설계: docs/superpowers/specs/2026-07-07-주문연계-그룹모델-재설계-design.md
import { STATUS_TO_KOREAN } from '../constants/orderStatus';

const STAGE_ORDER = { pending: 0, paid: 1, completed: 2 };
const INACTIVE = ['cancelled', 'refunded'];

/**
 * 자식 주문들의 종합 상태를 파생한다.
 * - 활성 자식(취소/환불 제외) 전부 동일 → 그 상태 (caption 없음)
 * - 섞이면 가장 뒤처진 단계(pending<paid<completed) + "일부 {앞선상태}" caption
 * - 취소 병존 → "일부 취소" caption 추가
 * - 전원 취소 → { value:'cancelled', caption:'전체 취소' }
 * @param {Array<{status:string}>} children
 * @returns {{ value:string, caption:(string|null) }}
 */
export const summarizeGroupStatus = (children = []) => {
  const active = children.filter((c) => !INACTIVE.includes(c.status));
  const cancelledCount = children.length - active.length;

  if (active.length === 0) {
    return { value: 'cancelled', caption: '전체 취소' };
  }

  const statuses = active.map((c) => c.status);
  const allSame = statuses.every((s) => s === statuses[0]);

  let laggard = statuses[0];
  let leader = statuses[0];
  statuses.forEach((s) => {
    if ((STAGE_ORDER[s] ?? 0) < (STAGE_ORDER[laggard] ?? 0)) laggard = s;
    if ((STAGE_ORDER[s] ?? 0) > (STAGE_ORDER[leader] ?? 0)) leader = s;
  });

  const captions = [];
  if (!allSame) captions.push(`일부 ${STATUS_TO_KOREAN[leader] || leader}`);
  if (cancelledCount > 0) captions.push('일부 취소');

  return {
    value: allSame ? statuses[0] : laggard,
    caption: captions.length ? captions.join(' · ') : null,
  };
};

/**
 * 자식 이름들을 유니크하게 요약한다.
 * 1명 → "A" / 2명 → "A, B" / 3명+ → "A 외 N명"
 * @param {Array<{customer_name:string}>} children
 * @returns {string}
 */
export const formatGroupCustomerNames = (children = []) => {
  const names = [...new Set(children.map((c) => c.customer_name).filter(Boolean))];
  if (names.length === 0) return '';
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]}, ${names[1]}`;
  return `${names[0]} 외 ${names.length - 1}명`;
};

/**
 * groupLinkedOrders 결과(플랫)를 트리 구조로 변환한다.
 * 껍데기 부모 → { type:'group', shell, children } / 그 외 → { type:'single', order }
 * 부모가 현재 페이지에 없는 고아 자식은 single 로 폴백(사라짐 방지).
 * @param {Array} groupedOrders groupLinkedOrders 결과
 * @returns {Array<{type:'group'|'single', shell?, children?, order?}>}
 */
export const buildOrderTree = (groupedOrders = []) => {
  const shellIds = new Set(
    groupedOrders.filter((o) => o.is_group_parent).map((o) => o.id)
  );

  const tree = [];
  groupedOrders.forEach((order) => {
    if (order.is_group_parent) {
      tree.push({ type: 'group', shell: order, children: order.linkedChildren || [] });
    } else if (!order.parent_order_id || !shellIds.has(order.parent_order_id)) {
      // 비연계 단독 or 부모가 현재 페이지에 없는 고아 자식
      tree.push({ type: 'single', order });
    }
    // 부모가 페이지에 있는 자식은 group 노드 안에서 렌더 — top-level 스킵
  });
  return tree;
};
