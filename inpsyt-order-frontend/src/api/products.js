import { supabase } from '../supabaseClient';

/**
 * 조건에 따라 상품 목록을 가져옵니다.
 * @param {object} options - 필터링 및 정렬 옵션
 * @param {string} [options.searchTerm] - 검색어 (상품명)
 * @param {string} [options.category] - 카테고리
 * @returns {Promise<Array>} 상품 목록
 * @throws {Error} 데이터 조회 실패 시 에러 발생
 */
export const fetchProducts = async ({ searchTerm, category, tags, isPopularOnly = false, currentPage = 1, productsPerPage = 10 }) => {
  let query = supabase.from('products').select('*', { count: 'exact' }); // Request count

  if (searchTerm) {
    query = query.ilike('name', `%${searchTerm}%`);
  }

  if (category) {
    query = query.eq('category', category);
  }

  if (tags && tags.length > 0) {
    query = query.overlaps('tags', tags);
  }

  if (isPopularOnly) {
    query = query.eq('is_popular', true);
  }

  query = query.order('is_popular', { ascending: false }).order('name');

  // Apply pagination
  const from = (currentPage - 1) * productsPerPage;
  const to = from + productsPerPage - 1;
  query = query.range(from, to);

  const { data, error, count } = await query; // Get count

  if (error) {
    console.error('Error fetching products:', error);
    throw error;
  }

  return { data, count }; // Return both data and count
};

/**
 * 모든 상품 목록을 가져옵니다. (페이지네이션 처리)
 * @returns {Promise<Array>} 상품 목록
 * @throws {Error} 데이터 조회 실패 시 에러 발생
 */
export const fetchAllProducts = async () => {
  const allProducts = [];
  const limit = 1000; // Supabase 서버의 기본 제한
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('Error fetching products in chunk:', error);
      throw error;
    }

    if (data && data.length > 0) {
      allProducts.push(...data);
      offset += data.length;
    } else {
      hasMore = false;
    }
  }
  
  return allProducts;
};
