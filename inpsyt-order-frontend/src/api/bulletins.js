import { supabase } from '../supabaseClient';

/**
 * 게시판 목록을 가져옵니다.
 * @returns {Promise<Array>} 고정글 우선, 최신순 정렬
 */
export const getBulletins = async () => {
  const { data, error } = await supabase
    .from('bulletins')
    .select('*')
    .order('is_pinned', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching bulletins:', error);
    throw error;
  }

  return data;
};

/**
 * 새 게시글을 작성합니다.
 * @param {object} data - { title, content, category, author_id, author_name, is_pinned }
 * @returns {Promise<object>} 생성된 게시글
 */
export const createBulletin = async (data) => {
  const { data: created, error } = await supabase
    .from('bulletins')
    .insert({
      title: data.title,
      content: data.content,
      category: data.category,
      author_id: data.author_id,
      author_name: data.author_name,
      is_pinned: data.is_pinned || false,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating bulletin:', error);
    throw error;
  }

  return created;
};

/**
 * 게시글을 수정합니다.
 * @param {string} id - 게시글 ID
 * @param {object} data - 수정할 필드
 * @returns {Promise<object>} 수정된 게시글
 */
export const updateBulletin = async (id, data) => {
  const { data: updated, error } = await supabase
    .from('bulletins')
    .update({
      ...data,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error updating bulletin:', error);
    throw error;
  }

  return updated;
};

/**
 * 게시글을 삭제합니다.
 * @param {string} id - 게시글 ID
 */
export const deleteBulletin = async (id) => {
  const { error } = await supabase
    .from('bulletins')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting bulletin:', error);
    throw error;
  }
};

/**
 * 게시글을 읽음 처리합니다.
 * @param {string} bulletinId - 게시글 ID
 * @param {string} userId - 사용자 ID
 */
export const markBulletinRead = async (bulletinId, userId) => {
  const { error } = await supabase
    .from('bulletin_reads')
    .upsert(
      { bulletin_id: bulletinId, user_id: userId, read_at: new Date().toISOString() },
      { onConflict: 'bulletin_id,user_id', ignoreDuplicates: true }
    );

  if (error) {
    console.error('Error marking bulletin read:', error);
    throw error;
  }
};

/**
 * 안 읽은 게시글 수를 가져옵니다.
 * @param {string} userId - 사용자 ID
 * @returns {Promise<number>} 안 읽은 게시글 수
 */
export const getUnreadCount = async (userId) => {
  // 전체 게시글 수
  const { count: totalCount, error: totalError } = await supabase
    .from('bulletins')
    .select('*', { count: 'exact', head: true });

  if (totalError) {
    console.error('Error fetching total bulletins count:', totalError);
    throw totalError;
  }

  // 읽은 게시글 수
  const { count: readCount, error: readError } = await supabase
    .from('bulletin_reads')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId);

  if (readError) {
    console.error('Error fetching read count:', readError);
    throw readError;
  }

  return (totalCount || 0) - (readCount || 0);
};

/**
 * 특정 게시글의 읽은 사용자 목록을 가져옵니다 (master only).
 * @param {string} bulletinId - 게시글 ID
 * @returns {Promise<Array>} 읽음 기록 목록
 */
export const getBulletinReaders = async (bulletinId) => {
  const { data, error } = await supabase
    .from('bulletin_reads')
    .select('*')
    .eq('bulletin_id', bulletinId)
    .order('read_at', { ascending: false });

  if (error) {
    console.error('Error fetching bulletin readers:', error);
    throw error;
  }

  return data;
};
