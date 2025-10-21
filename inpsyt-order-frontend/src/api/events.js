import { supabase } from '../supabaseClient';

/**
 * 모든 학회 목록을 이름순으로 가져옵니다.
 * @returns {Promise<Array>} 학회 목록
 * @throws {Error} 데이터 조회 실패 시 에러 발생
 */
export const getEvents = async () => {
  const { data, error } = await supabase
    .from('events')
    .select('id, name, discount_rate')
    .order('name', { ascending: true });

  if (error) {
    console.error('Error fetching events:', error);
    throw error;
  }

  return data;
};
