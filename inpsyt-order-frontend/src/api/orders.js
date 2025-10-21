import { supabase } from '../supabaseClient';
import { format, startOfDay, endOfDay } from 'date-fns';

/**
 * 필터 및 페이지네이션 옵션에 따라 주문 목록을 가져옵니다.
 * @param {object} options - 필터 및 페이지네이션 옵션
 * @param {number} options.currentPage - 현재 페이지
 * @param {number} options.ordersPerPage - 페이지 당 주문 수
 * @param {string} [options.searchTerm] - 고객명/이메일 검색어
 * @param {string} [options.selectedStatus] - 선택된 주문 상태
 * @param {string|number} [options.selectedEvent] - 선택된 학회 ID
 * @param {Date} [options.startDate] - 조회 시작일
 * @param {Date} [options.endDate] - 조회 종료일
 * @returns {Promise<{data: Array, count: number}>} 주문 목록과 전체 개수
 * @throws {Error} 데이터 조회 실패 시 에러 발생
 */
export const getOrders = async (options) => {
  const { 
    currentPage, 
    ordersPerPage, 
    searchTerm, 
    selectedStatus, 
    selectedEvent, 
    startDate, 
    endDate 
  } = options;

  const from = (currentPage - 1) * ordersPerPage;
  const to = from + ordersPerPage - 1;

  let query = supabase
    .from('orders')
    .select(`*, order_items (product_id, quantity, price_at_purchase)`, { count: 'exact' })
    .order('created_at', { ascending: false });

  if (searchTerm) {
    query = query.or(`customer_name.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%`);
  }
  if (selectedStatus) {
    query = query.eq('status', selectedStatus);
  }
  if (selectedEvent && selectedEvent !== '') {
    query = query.eq('event_id', selectedEvent);
  }
  if (startDate && endDate) {
    const start = format(startOfDay(startDate), 'yyyy-MM-dd HH:mm:ss');
    const end = format(endOfDay(endDate), 'yyyy-MM-dd HH:mm:ss');
    query = query.gte('created_at', start).lte('created_at', end);
  }

  const { data, error, count } = await query.range(from, to);

  if (error) {
    console.error('Error fetching orders:', error);
    throw error;
  }

  return { data, count };
};
