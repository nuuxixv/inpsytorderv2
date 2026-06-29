import { supabase } from '../supabaseClient';

// =====================================================================
// 소분류(subcategories) · 배지(badges) 마스터 CRUD
// =====================================================================
// - A8 설정 화면이 단일 진실 소스 UI. A6 상품 폼/엑셀은 이 마스터를 소비.
// - 상품 연결은 자연키(products.sub_category=name / products.badges 원소=name).
//   FK 없음 — 엑셀 호환. 미등록 값은 UI에서 "미등록" 폴백.
// - graceful: 마이그레이션 미적용(테이블 없음) 시 빈 배열 반환 → 기존 자유입력
//   동작 보존. 호출부는 빈 마스터를 "프리셋 없음"으로 취급한다.
// =====================================================================

// PostgREST: 관계/테이블 미존재 시 코드. 그 외 권한·네트워크 오류는 throw.
const isMissingTable = (error) =>
  error && (error.code === '42P01' || error.code === 'PGRST205' || error.code === 'PGRST204');

// ── 소분류 ──────────────────────────────────────────────────────────

/**
 * 소분류 마스터 전체를 가져온다(대분류 → 정렬순서 → 이름).
 * @returns {Promise<Array>} subcategories 행 배열. 테이블 미존재 시 [].
 */
export const fetchSubcategories = async () => {
  const { data, error } = await supabase
    .from('subcategories')
    .select('*')
    .order('parent_category', { ascending: true })
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true });

  if (error) {
    if (isMissingTable(error)) return [];
    console.error('Error fetching subcategories:', error);
    throw error;
  }
  return data || [];
};

export const createSubcategory = async ({ name, parent_category, color, sort_order, is_active = true }) => {
  const { data, error } = await supabase
    .from('subcategories')
    .insert([{ name, parent_category, color: color || null, sort_order: sort_order ?? 0, is_active }])
    .select()
    .single();
  if (error) throw error;
  return data;
};

export const updateSubcategory = async (id, updates) => {
  const { data, error } = await supabase
    .from('subcategories')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
};

export const deleteSubcategory = async (id) => {
  const { error } = await supabase.from('subcategories').delete().eq('id', id);
  if (error) throw error;
};

// ── 배지 ────────────────────────────────────────────────────────────

/**
 * 배지 마스터 전체를 가져온다(우선순위 → 이름).
 * @returns {Promise<Array>} badges 행 배열. 테이블 미존재 시 [].
 */
export const fetchBadges = async () => {
  const { data, error } = await supabase
    .from('badges')
    .select('*')
    .order('priority', { ascending: true })
    .order('name', { ascending: true });

  if (error) {
    if (isMissingTable(error)) return [];
    console.error('Error fetching badges:', error);
    throw error;
  }
  return data || [];
};

export const createBadge = async ({ name, color, priority, is_active = true }) => {
  const { data, error } = await supabase
    .from('badges')
    .insert([{ name, color: color || null, priority: priority ?? 0, is_active }])
    .select()
    .single();
  if (error) throw error;
  return data;
};

export const updateBadge = async (id, updates) => {
  const { data, error } = await supabase
    .from('badges')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
};

export const deleteBadge = async (id) => {
  const { error } = await supabase.from('badges').delete().eq('id', id);
  if (error) throw error;
};

// ── 사용 카운트 집계 (삭제 가드레일·표시용) ─────────────────────────

/**
 * 상품의 sub_category·badges를 전수 조회해 이름별 사용 카운트를 집계한다.
 * 연 800건·상품 수천 규모라 클라이언트 집계로 충분(가상 스크롤·서버 RPC 불필요).
 * @returns {Promise<{ subCounts: Object, badgeCounts: Object }>}
 *   subCounts[name] = 해당 sub_category를 가진 상품 수
 *   badgeCounts[name] = badges 배열에 해당 이름을 포함한 상품 수
 */
export const fetchMasterUsageCounts = async () => {
  const subCounts = {};
  const badgeCounts = {};
  const limit = 1000;
  let offset = 0;
  let hasMore = true;

  // products.badges 컬럼이 아직 없으면(마이그레이션 미적용) select에서 빠뜨려
  // sub_category만 집계 — graceful 폴백. 첫 청크에서 한 번만 판별.
  let columns = 'sub_category, badges';

  while (hasMore) {
    let { data, error } = await supabase
      .from('products')
      .select(columns)
      .range(offset, offset + limit - 1);

    if (error && offset === 0 && columns.includes('badges')) {
      columns = 'sub_category';
      ({ data, error } = await supabase
        .from('products')
        .select(columns)
        .range(offset, offset + limit - 1));
    }

    if (error) {
      console.error('Error counting master usage:', error);
      throw error;
    }

    if (data && data.length > 0) {
      data.forEach((p) => {
        if (p.sub_category) subCounts[p.sub_category] = (subCounts[p.sub_category] || 0) + 1;
        (p.badges || []).forEach((b) => {
          if (b) badgeCounts[b] = (badgeCounts[b] || 0) + 1;
        });
      });
      offset += data.length;
    } else {
      hasMore = false;
    }
  }

  return { subCounts, badgeCounts };
};
