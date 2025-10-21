import { supabase } from '../supabaseClient';

/**
 * 모든 상품 목록을 가져옵니다.
 * @returns {Promise<Array>} 상품 목록
 * @throws {Error} 데이터 조회 실패 시 에러 발생
 */
export const getProducts = async () => {
  const { data, error } = await supabase
    .from('products')
    .select('id, product_code, name, list_price');

  if (error) {
    console.error('Error fetching products:', error);
    throw error;
  }

  return data;
};
