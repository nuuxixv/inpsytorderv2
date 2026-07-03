import { supabase } from '../supabaseClient';

// =====================================================================
// 검사군(test_groups) 마스터 CRUD + 옵션(products) 편집
// =====================================================================
// - A6 상품 관리의 "검사군 관리" 패널이 단일 진실 소스 UI.
// - 상품 연결은 FK(products.test_group_id → test_groups.id, 1:1, ON DELETE SET NULL).
//   검사군 삭제 시 상품은 보존되고 소속만 NULL 로 풀린다(주문·매출 보호).
// - 즉시저장이 아니라 위험 액션(분리/병합/삭제)은 확인 스텝 후 실행. 편집은 즉시.
// - graceful: 마이그레이션 미적용(테이블 없음) 시 빈 배열/무동작 → 기존 화면 회귀 0.
// - 매출 집계·order_items 무관(검사군은 진열 계층 전용).
// =====================================================================

const isMissingTable = (error) =>
  error && (error.code === '42P01' || error.code === 'PGRST205' || error.code === 'PGRST204');

// 가법(신규) 컬럼 미적용 환경 graceful — PGRST204 시 아래 키를 빼고 1회 재시도한다.
// (ProductManagementPage.jsx handleSave 의 image_filename·is_active graceful 패턴과 동종)
const ADDITIVE_OPTION_COLS = [
  'is_active',
  'test_group_id',
  'option_name',
  'option_label',
  'is_common',
  'sort_order',
];

const stripAdditiveCols = (body) => {
  const rest = { ...body };
  ADDITIVE_OPTION_COLS.forEach((k) => delete rest[k]);
  return rest;
};

/**
 * 검사군 마스터 전체(정렬순서 → 검사명).
 * @returns {Promise<Array>} test_groups 행 배열. 테이블 미존재 시 [].
 */
export const fetchTestGroups = async () => {
  const { data, error } = await supabase
    .from('test_groups')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true });

  if (error) {
    if (isMissingTable(error)) return [];
    console.error('Error fetching test_groups:', error);
    throw error;
  }
  return data || [];
};

export const createTestGroup = async ({ abbr, name, category, sort_order, is_active = true }) => {
  const { data, error } = await supabase
    .from('test_groups')
    .insert([{ abbr: abbr || null, name, category: category || null, sort_order: sort_order ?? 0, is_active }])
    .select()
    .single();
  if (error) throw error;
  return data;
};

export const updateTestGroup = async (id, updates) => {
  const { data, error } = await supabase
    .from('test_groups')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
};

// 검사군 마스터만 제거. 소속 상품은 FK ON DELETE SET NULL 로 test_group_id=NULL 로 풀림(상품 보존).
export const deleteTestGroup = async (id) => {
  const { error } = await supabase.from('test_groups').delete().eq('id', id);
  if (error) throw error;
};

/**
 * 검사군별 소속 옵션(products) 카운트. test_group_id 기준 집계.
 * 연 800건·상품 수천 규모라 클라이언트 집계로 충분.
 * @returns {Promise<Object>} counts[test_group_id] = 소속 상품 수. 컬럼 미존재 시 {}.
 */
export const fetchTestGroupOptionCounts = async () => {
  const counts = {};
  const limit = 1000;
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await supabase
      .from('products')
      .select('test_group_id')
      .range(offset, offset + limit - 1);

    if (error) {
      if (isMissingTable(error)) return {};
      console.error('Error counting test group options:', error);
      throw error;
    }

    if (data && data.length > 0) {
      data.forEach((p) => {
        if (p.test_group_id != null) counts[p.test_group_id] = (counts[p.test_group_id] || 0) + 1;
      });
      offset += data.length;
    } else {
      hasMore = false;
    }
  }

  return counts;
};

/**
 * 특정 검사군의 소속 옵션(products) 목록. 옵션 순서·말머리 편집용.
 * sort_order → name 정렬.
 * @param {number} testGroupId
 * @returns {Promise<Array>} products 행 배열
 */
export const fetchTestGroupOptions = async (testGroupId) => {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('test_group_id', testGroupId)
    .order('sort_order', { ascending: true, nullsFirst: false })
    .order('name', { ascending: true });

  if (error) {
    if (isMissingTable(error)) return [];
    console.error('Error fetching test group options:', error);
    throw error;
  }
  return data || [];
};

// 옵션 1건 편집(말머리·형태명·공용·개별 노출·순서). 즉시저장.
export const updateProductOption = async (productId, updates) => {
  const { error } = await supabase.from('products').update(updates).eq('id', productId);
  if (error) throw error;
};

/**
 * 분리 — 선택 옵션들을 새 검사군으로 이동.
 * 새 test_groups INSERT 후 선택 상품의 test_group_id 를 새 검사군으로 UPDATE.
 * @param {{ abbr, name, category, sort_order }} newGroup
 * @param {number[]} productIds 새 검사군으로 옮길 옵션 id들
 */
export const splitTestGroup = async (newGroup, productIds) => {
  const created = await createTestGroup(newGroup);
  const { error } = await supabase
    .from('products')
    .update({ test_group_id: created.id })
    .in('id', productIds);
  if (error) throw error;
  return created;
};

/**
 * 병합 — 여러 검사군을 대표 하나로 합침.
 * 흡수될 검사군들의 옵션 test_group_id 를 대표로 UPDATE 후 빈 검사군 삭제.
 * @param {number} keepId 남길 대표 검사군 id
 * @param {number[]} mergeIds 흡수될 검사군 id들(keepId 제외)
 */
export const mergeTestGroups = async (keepId, mergeIds) => {
  const absorbed = mergeIds.filter((id) => id !== keepId);
  if (absorbed.length === 0) return;

  const { error: moveError } = await supabase
    .from('products')
    .update({ test_group_id: keepId })
    .in('test_group_id', absorbed);
  if (moveError) throw moveError;

  const { error: delError } = await supabase
    .from('test_groups')
    .delete()
    .in('id', absorbed);
  if (delError) throw delError;
};

// 검사군 (약어, 검사명) 정규화 키 — seed_hierarchy.py 의 dedup 규칙과 동일.
// abbr 는 빈값→null(nullable), name 은 trim. 대소문자·공백 정규화로 왕복 매칭 안정화.
const tgKey = (abbr, name) => `${(abbr || '').trim().toLowerCase()}||${(name || '').trim().toLowerCase()}`;

/**
 * 엑셀 왕복용 — (약어, 검사명) 조합으로 검사군을 찾거나 없으면 생성한다.
 * seed_hierarchy.py 와 동일한 dedup 규칙((abbr, name), 등장순). 세션 캐시로 같은 검사군 중복 생성 방지.
 * @param {Array} existingGroups 이미 로드된 test_groups 배열(왕복 시작 시 1회 조회)
 * @returns {Function} resolve(abbr, name) → Promise<number|null> test_group_id. 테이블 미존재 시 null.
 */
export const makeTestGroupResolver = (existingGroups = []) => {
  const cache = new Map();
  existingGroups.forEach((g) => {
    if (!cache.has(tgKey(g.abbr, g.name))) cache.set(tgKey(g.abbr, g.name), g.id);
  });
  let tableMissing = false;

  return async (abbr, name) => {
    const cleanName = (name || '').trim();
    if (!cleanName) return null; // 검사명 없으면 미분류로 둔다
    const key = tgKey(abbr, cleanName);
    if (cache.has(key)) return cache.get(key);
    if (tableMissing) return null;

    const created = await createTestGroup({
      abbr: (abbr || '').trim() || null,
      name: cleanName,
      sort_order: 0,
      is_active: true,
    }).catch((error) => {
      if (isMissingTable(error)) { tableMissing = true; return null; }
      throw error;
    });
    if (!created) return null;
    cache.set(key, created.id);
    return created.id;
  };
};

// =====================================================================
// 검사군 상세편집 모달 — 옵션(products) 신설/삭제/이동 + 오케스트레이션
// =====================================================================

/**
 * 옵션 신규 생성 — products INSERT.
 * category='검사' 강제, test_group_id 는 인자로 고정. name 은 받은 값 그대로 저장(자동조합 없음, 프론트 책임).
 * 가법 컬럼(test_group_id·is_active·option_*·is_common·sort_order) 미적용 환경은 PGRST204 감지 후 해당 키 빼고 1회 재시도.
 * @param {number} testGroupId 소속 검사군 id
 * @param {{ option_name?, option_label?, product_code?, name?, list_price?, is_common?, is_active?, sort_order? }} fields
 * @returns {Promise<Object>} 생성된 products 행
 */
export const createProductOption = async (testGroupId, fields = {}) => {
  const body = { ...fields, category: '검사', test_group_id: testGroupId };

  const run = async (payload) =>
    supabase.from('products').insert([payload]).select().single();

  let { data, error } = await run(body);
  if (error && error.code === 'PGRST204') {
    ({ data, error } = await run(stripAdditiveCols(body)));
  }
  if (error) throw error;
  return data;
};

/**
 * 옵션 완전 삭제 — products DELETE.
 * RLS 상 products DELETE 는 master 전용(20251121_apply_rbac_rls.sql:84). edit 운영자는 42501 이 나며,
 * 이를 잡아 사용자에게 명확한 권한 메시지로 rethrow 한다.
 * order_items 스냅샷은 계약상 무영향(FK 완화 20260415_008) — 과거 주문에 손상 없음.
 * @param {number} productId
 * @returns {Promise<void>}
 */
export const deleteProductOption = async (productId) => {
  const { error } = await supabase.from('products').delete().eq('id', productId);
  if (error) {
    if (error.code === '42501') {
      throw new Error('삭제는 관리자(master) 권한이 필요합니다.');
    }
    throw error;
  }
};

/**
 * 옵션 이동 — 선택 옵션들의 test_group_id 를 기존 대상 검사군으로 UPDATE.
 * splitTestGroup(새 검사군 생성) 과 달리, 이미 존재하는 검사군으로의 동종 이동만 수행한다.
 * @param {number} targetGroupId 옮길 대상 검사군 id
 * @param {number[]} productIds 이동할 옵션 id들
 * @returns {Promise<void>}
 */
export const moveOptionsToGroup = async (targetGroupId, productIds) => {
  if (!productIds || productIds.length === 0) return;
  const { error } = await supabase
    .from('products')
    .update({ test_group_id: targetGroupId })
    .in('id', productIds);
  if (error) throw error;
};

/**
 * 상세편집 모달 저장 오케스트레이터 — 검사군 + 옵션 변경분을 순차 반영하는 얇은 조율자.
 * 1) group.id 있으면 updateTestGroup, 없으면 createTestGroup 로 groupId 확보
 * 2) newOptions → createProductOption(groupId, ...) 순차
 * 3) updatedOptions → updateProductOption 순차
 * 4) deletedIds → deleteProductOption 순차
 * 어느 단계든 실패 시 즉시 throw(보상 롤백 없음). 상위가 리로드로 재동기화하는 전제.
 * 연 800건 규모라 트랜잭션·배치 없이 순차 동기 처리로 충분.
 * @param {{ group: Object, newOptions?: Array, updatedOptions?: Array<{id, updates}>, deletedIds?: number[] }} args
 * @returns {Promise<{ groupId: number, createdCount: number, updatedCount: number, deletedCount: number }>}
 */
export const saveTestGroupWithOptions = async ({
  group,
  newOptions = [],
  updatedOptions = [],
  deletedIds = [],
}) => {
  let groupId = group?.id;
  if (groupId) {
    const { id, ...updates } = group;
    await updateTestGroup(id, updates);
  } else {
    const created = await createTestGroup(group);
    groupId = created.id;
  }

  for (const fields of newOptions) {
    await createProductOption(groupId, fields);
  }
  for (const { id, updates } of updatedOptions) {
    await updateProductOption(id, updates);
  }
  for (const productId of deletedIds) {
    await deleteProductOption(productId);
  }

  return {
    groupId,
    createdCount: newOptions.length,
    updatedCount: updatedOptions.length,
    deletedCount: deletedIds.length,
  };
};
