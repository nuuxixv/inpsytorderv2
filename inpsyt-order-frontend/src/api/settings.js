import { supabase } from '../supabaseClient';

/**
 * 전역 환경설정(배송비 등)을 가져옵니다.
 * select('*')이므로 free_shipping_basis 포함 모든 컬럼을 그대로 받는다.
 * 컬럼 미적용(마이그레이션 전) 환경에서는 해당 키가 응답에서 빠질 뿐이라
 * 호출부의 `?? 'list_price'` 폴백이 그대로 동작한다(graceful).
 * @returns {Promise<object>} 환경설정 데이터
 */
export const getSettings = async () => {
  const { data, error } = await supabase
    .from('site_settings')
    .select('*')
    .single();

  if (error) {
    console.error('Error fetching settings:', error);
    throw error;
  }

  return data;
};

/**
 * 전역 환경설정을 업데이트합니다.
 * @param {object} settings 업데이트할 필드들
 */
export const updateSettings = async (settings) => {
  const { data, error } = await supabase
    .from('site_settings')
    .update({ ...settings, updated_at: new Date().toISOString() })
    .eq('id', 1);

  if (error) {
    console.error('Error updating settings:', error);
    throw error;
  }

  return data;
};
