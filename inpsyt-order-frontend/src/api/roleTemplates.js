import { supabase } from '../supabaseClient';

/**
 * 모든 역할 템플릿을 조회합니다.
 * @returns {Promise<Array>} 역할 템플릿 목록 (시스템 템플릿 우선, 이름순)
 */
export const getRoleTemplates = async () => {
  const { data, error } = await supabase
    .from('role_templates')
    .select('*')
    .order('is_system', { ascending: false })
    .order('name');

  if (error) {
    console.error('Error fetching role templates:', error);
    throw error;
  }

  return data;
};

/**
 * 새 역할 템플릿을 생성합니다.
 * @param {object} data - { name, description, permissions }
 * @returns {Promise<object>} 생성된 역할 템플릿
 */
export const createRoleTemplate = async ({ name, description, permissions }) => {
  const { data, error } = await supabase
    .from('role_templates')
    .insert([{ name, description, permissions }])
    .select()
    .single();

  if (error) {
    console.error('Error creating role template:', error);
    throw error;
  }

  return data;
};

/**
 * 역할 템플릿을 업데이트합니다.
 * @param {string} id - 템플릿 UUID
 * @param {object} data - { name, description, permissions }
 * @returns {Promise<object>} 업데이트된 역할 템플릿
 */
export const updateRoleTemplate = async (id, { name, description, permissions }) => {
  const { data, error } = await supabase
    .from('role_templates')
    .update({ name, description, permissions, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error updating role template:', error);
    throw error;
  }

  return data;
};

/**
 * 역할 템플릿을 삭제합니다. (시스템 템플릿은 RLS에 의해 삭제 불가)
 * @param {string} id - 템플릿 UUID
 */
export const deleteRoleTemplate = async (id) => {
  const { error } = await supabase
    .from('role_templates')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting role template:', error);
    throw error;
  }
};
