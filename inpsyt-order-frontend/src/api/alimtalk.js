import { supabase } from '../supabaseClient';

const ENDPOINT = 'https://api2.msgagent.com/api/webshot/send/kakao/AT/inpsyt2';
const SENDER_KEY = '799de9af7fd86b7301222f39715f012c33d8ed85';
const CALLBACK = '023305121';
const TEMPLATE_CODE = 'inpsytorder_paid1';
const FRONTEND_URL = import.meta.env.VITE_APP_URL ?? 'https://inpsytorder.vercel.app';

/**
 * 주문 ID를 받아 결제 완료 알림톡을 발송합니다.
 * @param {number} orderId
 * @returns {{ success: boolean, error?: string }}
 */
export const sendAlimtalk = async (orderId) => {
  try {
    // 주문 정보 조회
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('id, customer_name, phone_number, is_on_site_sale, access_token, events(name)')
      .eq('id', orderId)
      .single();

    if (orderError || !order) return { success: false, error: '주문을 찾을 수 없습니다.' };
    if (order.is_on_site_sale) return { success: true, skipped: true };
    if (!order.phone_number) return { success: false, error: '수신자 연락처가 없습니다.' };

    const phone = order.phone_number.replace(/-/g, '');
    const name = order.customer_name ?? '';
    const eventName = order.events?.name ?? '';
    const statusUrl = `${FRONTEND_URL}/order/status/${order.access_token}`;
    // MSG: 변수 치환된 완성 텍스트
    const msg = `${name}님, 안녕하세요.\n${eventName}에서 결제가 완료되었습니다.\n\n주문 내역은 아래에서 확인하실 수 있습니다.`;
    console.log('[알림톡] PHONE:', phone, '| URL:', statusUrl);

    const formData = new FormData();
    formData.append('id', 'inpsyt2');
    formData.append('PHONE', phone);
    formData.append('CALLBACK', CALLBACK ?? '');
    formData.append('MSG', msg);
    formData.append('SENDER_KEY', SENDER_KEY);
    formData.append('TEMPLATE_CODE', TEMPLATE_CODE);
    formData.append('BTN_TYPES', 'WL');
    formData.append('BTN_TXTS', '주문내역 확인하기');
    formData.append('BTN_URLS1', statusUrl);
    formData.append('BTN_URLS2', statusUrl);
    formData.append('FAILED_TYPE', 'LMS');
    formData.append('FAILED_MSG', `[인싸이트] ${name}님, ${eventName} 결제가 완료되었습니다.\n주문 조회: ${statusUrl}`);

    const response = await fetch(ENDPOINT, { method: 'POST', body: formData });
    const responseText = await response.text();
    console.log('[알림톡] 원샷 응답:', responseText);

    if (!response.ok) {
      console.error('원샷 API HTTP 오류:', responseText);
      return { success: false, error: `원샷 API 오류: ${responseText}` };
    }

    // 원샷은 HTTP 200이어도 result_code로 성공 여부 판단
    let resultCode = null;
    try {
      const json = JSON.parse(responseText);
      resultCode = json.result_code;
    } catch {}

    if (resultCode !== undefined && resultCode !== 0) {
      console.error('[알림톡] 발송 실패 result_code:', resultCode);
      return { success: false, error: `원샷 result_code: ${resultCode}` };
    }

    // 발송 이력 기록
    await supabase.from('orders').update({ alimtalk_sent_at: new Date().toISOString() }).eq('id', orderId);

    return { success: true };
  } catch (err) {
    console.error('sendAlimtalk error:', err);
    return { success: false, error: err.message };
  }
};
