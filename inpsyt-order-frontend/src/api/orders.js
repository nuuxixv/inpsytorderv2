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
    selectedStatuses,
    selectedEvents,
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
    query = query.ilike('customer_name', `%${searchTerm}%`);
  }
  if (selectedStatuses && selectedStatuses.length > 0) {
    query = query.in('status', selectedStatuses);
  }
  if (selectedEvents && selectedEvents.length > 0) {
    query = query.in('event_id', selectedEvents);
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

/**
 * 출고 현황용 주문 목록을 가져옵니다 (order_items → products 중첩 join 포함).
 */
export const getFulfillmentOrders = async ({ eventId, statuses, dateFrom, dateTo } = {}) => {
  let query = supabase
    .from('orders')
    .select(`
      id, parent_order_id, customer_name, phone_number, shipping_address,
      final_payment, delivery_fee, status, created_at,
      customer_request, admin_memo, event_id,
      events(name),
      order_items(product_id, quantity, price_at_purchase,
        products(name, category)
      )
    `)
    .in('status', statuses || ['paid', 'preparing', 'completed'])
    .order('created_at', { ascending: false });

  if (eventId) query = query.eq('event_id', eventId);
  if (dateFrom) query = query.gte('created_at', dateFrom);
  if (dateTo) query = query.lte('created_at', dateTo);

  const { data, error } = await query;
  if (error) throw error;
  return data;
};

/**
 * 두 주문을 연계시킵니다. childOrderId의 parent_order_id를 parentOrderId로 설정하고
 * 배송비를 자동 조정합니다.
 * @param {string} parentOrderId 부모 주문 ID
 * @param {string} childOrderId 자식 주문 ID
 * @param {object} [settings] 사이트 환경설정 (배송비 임계치 등)
 */
export const linkOrders = async (parentOrderId, childOrderId, settings = {}) => {
  const { data: orders, error: fetchError } = await supabase
    .from('orders')
    .select('id, total_cost, discount_amount, delivery_fee, final_payment, status, customer_name')
    .in('id', [parentOrderId, childOrderId]);

  if (fetchError) throw fetchError;

  const parent = orders.find(o => o.id === parentOrderId);
  const child = orders.find(o => o.id === childOrderId);
  if (!parent || !child) throw new Error('주문을 찾을 수 없습니다.');

  const threshold = settings.free_shipping_threshold ?? 30000;
  const combinedListPrice = parent.total_cost + child.total_cost;
  const PAID_STATUSES = ['paid', 'completed'];

  // child의 배송비는 항상 0 (합배송)
  let newFinalPayment = child.total_cost - child.discount_amount;

  // parent가 배송비를 이미 납부한 경우, 합산 금액 무관하게 child에서 차감
  // (박 선생님이 3,000원 냈으면 김 선생님은 그만큼 덜 내는 구조)
  if (PAID_STATUSES.includes(parent.status) && parent.delivery_fee > 0) {
    newFinalPayment -= parent.delivery_fee;
  }

  const { error } = await supabase
    .from('orders')
    .update({ parent_order_id: parentOrderId, delivery_fee: 0, final_payment: newFinalPayment })
    .eq('id', childOrderId);

  if (error) throw error;

  return {
    combinedListPrice,
    freeShipping: combinedListPrice >= threshold,
    parentPaidShipping: PAID_STATUSES.includes(parent.status) ? parent.delivery_fee : 0,
    newFinalPayment,
    originalFinalPayment: child.final_payment,
    saved: child.final_payment - newFinalPayment,
  };
};

/**
 * 합배송된 주문을 다시 분리합니다 (부모 주문과의 연결 해제).
 * @param {string} orderId 분리할 주문 ID
 * @param {object} [settings] 사이트 환경설정 (배송비 임계치 등)
 */
export const unlinkOrders = async (orderId, settings = {}) => {
  const { data: order, error: fetchError } = await supabase
    .from('orders')
    .select('total_cost, discount_amount')
    .eq('id', orderId)
    .single();

  if (fetchError) throw fetchError;

  const threshold = settings.free_shipping_threshold ?? 30000;
  const shippingFee = settings.shipping_cost ?? 3000;

  // 개별 주문 기준으로 배송비 재계산
  const deliveryFee = order.total_cost >= threshold ? 0 : shippingFee;
  const finalPayment = order.total_cost - order.discount_amount + deliveryFee;

  const { error } = await supabase
    .from('orders')
    .update({ 
      parent_order_id: null, 
      delivery_fee: deliveryFee, 
      final_paymentValue: finalPayment, // typo? 아니, final_payment 
      final_payment: finalPayment
    })
    .eq('id', orderId);

  if (error) throw error;
  return { success: true };
};

/**
 * 주어진 주문 목록에서 연계 주문을 그룹화하여 병합된 주문 객체를 반환합니다.
 * - 부모 주문: { ...order, linkedChildren: [...], mergedItems: [...], mergedTotal: N }
 * - 자식 주문: 그대로 반환 (parent_order_id 유지)
 */
export const groupLinkedOrders = (orders) => {
  // Build a map of children by parent_order_id
  const childrenMap = {};
  orders.forEach(order => {
    if (order.parent_order_id) {
      if (!childrenMap[order.parent_order_id]) childrenMap[order.parent_order_id] = [];
      childrenMap[order.parent_order_id].push(order);
    }
  });

  return orders.map(order => {
    if (!order.parent_order_id) {
      // Parent order
      const children = childrenMap[order.id] || [];
      const mergedItems = [
        ...(order.order_items || []),
        ...children.flatMap(c => c.order_items || []),
      ];
      const mergedTotal = (order.final_payment || 0) + children.reduce((s, c) => s + (c.final_payment || 0), 0);
      return { ...order, linkedChildren: children, mergedItems, mergedTotal };
    } else {
      // Child order - return as-is
      return { ...order, linkedChildren: [], mergedItems: order.order_items || [], mergedTotal: order.final_payment || 0 };
    }
  });
};

/**
 * 연계 주문 연결 시 parent 후보를 검색합니다.
 * parent_order_id가 없는 주문만 반환 (이미 child인 주문은 parent가 될 수 없음).
 */
export const searchOrdersForLinking = async (term, excludeOrderId) => {
  const digits = term.replace(/-/g, '');
  let phoneVariant = term;
  if (/^\d{10,11}$/.test(digits)) {
    phoneVariant = digits.length === 11
      ? `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`
      : `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  const phoneOrClause = phoneVariant !== term ? `,phone_number.ilike.%${phoneVariant}%` : '';

  let query = supabase
    .from('orders')
    .select('id, customer_name, phone_number, total_cost, final_payment, delivery_fee, status, created_at, parent_order_id')
    .or(`customer_name.ilike.%${term}%,phone_number.ilike.%${term}%${phoneOrClause}`)
    .is('parent_order_id', null)
    .order('created_at', { ascending: false })
    .limit(10);

  if (excludeOrderId) query = query.neq('id', excludeOrderId);

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
};
