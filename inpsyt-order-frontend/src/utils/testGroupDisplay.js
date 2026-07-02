// =====================================================================
// 검사 위계(검사군 2뎁스) 진열용 순수 로직 — DOCS/PRD_검사위계.md, C1_OrderPage.md §검사군 카드.
// - test_group_id 로 클라 그룹핑. 서버 조인·집계 RPC 불필요.
// - 메타(약어·검사명·정렬)는 test_groups 마스터에서 병합.
// - graceful: test_group_id 없으면 그룹에 안 들어가고 평면으로 떨어짐(호출부가 평면 처리).
//             마스터가 비어도(테이블 미존재) 메타 폴백으로 진열 유지.
// - is_active 필터·검사군 is_active=false 제외는 호출부에서 수행(입력 상품은 이미 노출 대상).
// =====================================================================

// 도구는 검사 하위로 본다(진열·필터 정규화).
export const normalizeCategory = (category) => (category === '도구' ? '검사' : category);

/**
 * 검사군 마스터 배열 → 노출 검사군 메타 맵(is_active=false 제외).
 * @param {Array} master test_groups 행 배열
 * @returns {Map<number, object>} id → { abbr, name, sort_order, ... }
 */
export function buildGroupMetaMap(master) {
  const m = new Map();
  for (const g of master || []) {
    if (g.is_active === false) continue;
    m.set(g.id, g);
  }
  return m;
}

/**
 * 노출 대상 상품(이미 is_active·행사필터 통과)을 검사군으로 그룹핑.
 * @param {Array} products 노출 상품
 * @param {Map} groupMetaById buildGroupMetaMap 결과
 * @param {boolean} hasMaster 마스터 로드 여부(있는데 메타 없으면 제외)
 * @returns {Array} [{ id, abbr, name, sort_order, options: [product...] }] — 정렬 완료
 */
export function groupTestProducts(products, groupMetaById, hasMaster) {
  const map = new Map();
  for (const p of products || []) {
    if (normalizeCategory(p.category) !== '검사') continue;
    if (p.test_group_id == null) continue;
    const meta = groupMetaById.get(p.test_group_id);
    if (hasMaster && !meta) continue; // 마스터 있는데 검사군 없음/숨김 → 제외
    let g = map.get(p.test_group_id);
    if (!g) {
      g = {
        id: p.test_group_id,
        abbr: meta?.abbr ?? null,
        name: meta?.name ?? p.name,
        sort_order: meta?.sort_order ?? 0,
        options: [],
      };
      map.set(p.test_group_id, g);
    }
    g.options.push(p);
  }

  const groups = [...map.values()];
  const cmp = (a, b) => {
    const sa = a.sort_order ?? Number.MAX_SAFE_INTEGER;
    const sb = b.sort_order ?? Number.MAX_SAFE_INTEGER;
    if (sa !== sb) return sa - sb;
    return 0;
  };
  // 옵션 정렬: sort_order ASC(NULL 폴백 원본순 — 안정정렬) → 형태명
  for (const g of groups) {
    g.options.sort((a, b) => {
      const c = cmp(a, b);
      if (c !== 0) return c;
      return (a.option_name || a.name || '').localeCompare(b.option_name || b.name || '');
    });
  }
  // 검사군 정렬: sort_order ASC → 검사명
  groups.sort((a, b) => {
    const c = cmp(a, b);
    if (c !== 0) return c;
    return (a.name || '').localeCompare(b.name || '');
  });
  return groups;
}
