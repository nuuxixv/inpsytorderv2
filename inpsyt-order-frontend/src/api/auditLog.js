import { supabase } from '../supabaseClient';
import { format, startOfDay, endOfDay } from 'date-fns';

const PAGE_SIZE = 50;

/**
 * 감사 로그 목록을 필터·페이지네이션 조건으로 조회합니다.
 * audit_log 테이블은 RLS로 master만 SELECT 가능.
 *
 * @param {object} options
 * @param {number} [options.page=1] - 1-base 페이지
 * @param {Date} [options.startDate] - 조회 시작일 (해당일 00:00:00 포함)
 * @param {Date} [options.endDate] - 조회 종료일 (해당일 23:59:59 포함)
 * @param {string} [options.actorId] - 행위자 필터 (actor_id, distinct 드롭다운)
 * @param {string[]} [options.tables] - 대상 테이블 필터 (target_table in)
 * @param {string} [options.search] - target_id / summary 부분 검색
 * @returns {Promise<{ data: Array, count: number }>}
 */
export const getAuditLogs = async ({
  page = 1,
  startDate,
  endDate,
  actorId,
  tables,
  search,
} = {}) => {
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  let query = supabase
    .from('audit_log')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to);

  if (startDate) {
    query = query.gte('created_at', format(startOfDay(startDate), 'yyyy-MM-dd HH:mm:ss'));
  }
  if (endDate) {
    query = query.lte('created_at', format(endOfDay(endDate), 'yyyy-MM-dd HH:mm:ss'));
  }
  if (actorId) {
    query = query.eq('actor_id', actorId);
  }
  if (tables?.length > 0) {
    query = query.in('target_table', tables);
  }
  if (search?.trim()) {
    const s = search.trim();
    query = query.or(`target_id.ilike.%${s}%,summary.ilike.%${s}%`);
  }

  const { data, error, count } = await query;
  if (error) {
    console.error('Error fetching audit logs:', error);
    throw error;
  }
  return { data: data || [], count: count || 0 };
};

/**
 * 행위자 드롭다운용 distinct 행위자 목록을 조회합니다.
 * 최근 기록 기준 상위 N개를 훑어 중복 제거 — 연 800건 규모라 별도 집계 테이블 불필요.
 *
 * @returns {Promise<Array<{ id: string, name: string, role: string }>>}
 */
export const getAuditActors = async () => {
  const { data, error } = await supabase
    .from('audit_log')
    .select('actor_id, actor_name, actor_role')
    .order('created_at', { ascending: false })
    .limit(1000);

  if (error) {
    console.error('Error fetching audit actors:', error);
    throw error;
  }

  const map = new Map();
  (data || []).forEach((row) => {
    if (row.actor_id && !map.has(row.actor_id)) {
      map.set(row.actor_id, {
        id: row.actor_id,
        name: row.actor_name || '이름 없음',
        role: row.actor_role || '',
      });
    }
  });
  return Array.from(map.values());
};

export const AUDIT_PAGE_SIZE = PAGE_SIZE;
