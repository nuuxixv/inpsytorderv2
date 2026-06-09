import { supabase } from '../supabaseClient';

/**
 * 모든 학회 목록을 이름순으로 가져옵니다.
 * @returns {Promise<Array>} 학회 목록
 * @throws {Error} 데이터 조회 실패 시 에러 발생
 */
export const getEvents = async () => {
  const { data, error } = await supabase
    .from('events')
    .select('id, name, discount_rate, tags')
    .order('name', { ascending: true });

  if (error) {
    console.error('Error fetching events:', error);
    throw error;
  }

  return data;
};

// L2 학회 상세에서 쓰는 events 단건 컬럼 집합.
// 목록(EventManagementPage)이 fetch하는 운영 필드 + 신규(진행상태 3 boolean·prep_note).
// anon 비노출 컬럼이 포함되므로 authenticated 컨텍스트(어드민)에서만 호출.
const EVENT_DETAIL_COLUMNS =
  'id, name, discount_rate, order_url_slug, start_date, end_date, estimated_delivery_date, ' +
  'event_year, host_society, event_season, status, venue, attendee_ids, note, marketing_cost, ' +
  'draft_done, application_done, payment_resolution_done, prep_note';

/**
 * order_url_slug 로 학회 1건을 가져옵니다. (L2 학회 상세)
 * @param {string} slug - events.order_url_slug
 * @returns {Promise<object|null>} 학회 1행. 없으면 null.
 * @throws {Error} 조회 실패(미존재 제외) 시 에러
 */
export const getEventBySlug = async (slug) => {
  if (!slug) return null;
  const { data, error } = await supabase
    .from('events')
    .select(EVENT_DETAIL_COLUMNS)
    .eq('order_url_slug', slug)
    .maybeSingle();

  if (error) {
    console.error('Error fetching event by slug:', error);
    throw error;
  }
  return data || null;
};

/**
 * 진행상태 플래그(기안/신청/지결) 한 건을 업데이트합니다. (events:edit)
 * @param {string} eventId
 * @param {{ draft_done?: boolean, application_done?: boolean, payment_resolution_done?: boolean }} patch
 * @throws {Error} 업데이트 실패 시
 */
export const updateEventProgress = async (eventId, patch) => {
  const { error } = await supabase.from('events').update(patch).eq('id', eventId);
  if (error) {
    console.error('Error updating event progress:', error);
    throw error;
  }
};

/**
 * 준비 노트(통합 에디터 HTML 본문)를 저장합니다. (events:edit)
 * @param {string} eventId
 * @param {string} prepNote - getHTML() 결과
 * @throws {Error} 저장 실패 시
 */
export const updateEventPrepNote = async (eventId, prepNote) => {
  const { error } = await supabase.from('events').update({ prep_note: prepNote }).eq('id', eventId);
  if (error) {
    console.error('Error updating event prep note:', error);
    throw error;
  }
};

/**
 * 이 학회의 매출 집계용 주문을 가져옵니다.
 * computeRevenueByCategory 입력 형태 — status·delivery_fee·order_items(category·가격·수량).
 * (DashboardPage 입금결의서 select 구조 정합 — paid 필터는 util이 수행.)
 * @param {string} eventId
 * @returns {Promise<Array>} 주문 배열
 * @throws {Error} 조회 실패 시
 */
export const getOrdersForEventRevenue = async (eventId) => {
  if (!eventId) return [];
  const { data, error } = await supabase
    .from('orders')
    .select('status, delivery_fee, order_items(product_id, category, price_at_purchase, quantity)')
    .eq('event_id', eventId);

  if (error) {
    console.error('Error fetching orders for event revenue:', error);
    throw error;
  }
  return data || [];
};
