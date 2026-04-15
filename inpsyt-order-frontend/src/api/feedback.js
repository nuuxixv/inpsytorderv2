import { supabase } from '../supabaseClient';

/**
 * 피드백 목록을 가져옵니다.
 * @param {object} [filters] - 필터 옵션
 * @param {string} [filters.status] - 상태 필터
 * @returns {Promise<Array>} 피드백 목록 (created_at DESC)
 */
export const getFeedback = async (filters = {}) => {
  let query = supabase
    .from('feedback')
    .select('*')
    .order('created_at', { ascending: false });

  if (filters.status) {
    query = query.eq('status', filters.status);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching feedback:', error);
    throw error;
  }

  // user_id로 user_profiles에서 이름을 가져와 매핑
  if (data && data.length > 0) {
    const userIds = [...new Set(data.map(fb => fb.user_id).filter(Boolean))];
    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from('user_profiles')
        .select('id, name')
        .in('id', userIds);
      const profileMap = Object.fromEntries((profiles || []).map(p => [p.id, p.name]));
      data.forEach(fb => { fb._userName = profileMap[fb.user_id] || null; });
    }
  }

  return data;
};

/**
 * 피드백 상태 및 관리자 메모를 업데이트합니다.
 * @param {string} id - 피드백 ID
 * @param {string} status - 새 상태
 * @param {string} [adminNote] - 관리자 메모
 * @returns {Promise<object>} 업데이트된 피드백
 */
export const updateFeedbackStatus = async (id, status, adminNote) => {
  const { data, error } = await supabase
    .from('feedback')
    .update({
      status,
      admin_note: adminNote,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error updating feedback:', error);
    throw error;
  }

  return data;
};
