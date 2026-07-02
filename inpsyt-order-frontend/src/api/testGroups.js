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
