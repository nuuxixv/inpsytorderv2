import { supabase } from '../supabaseClient';

/**
 * 전역 환경설정(배송비 등)을 가져옵니다.
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
