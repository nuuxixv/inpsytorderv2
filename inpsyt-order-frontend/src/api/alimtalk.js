import { supabase } from '../supabaseClient';

/**
 * 주문 ID를 받아 결제 완료 알림톡을 발송합니다.
 * Vercel serverless function(/api/send-alimtalk)을 통해 Node.js로 호출합니다.
 * (msgagent.com이 구형 TLS 사용 → 브라우저/Deno 직접 호출 불가, Node.js는 가능)
 * @param {number} orderId
 * @returns {{ success: boolean, skipped?: boolean, error?: string }}
 */
export const sendAlimtalk = async (orderId) => {
  try {
    const { data: { session } } = await supabase.auth.getSession();

    const response = await fetch('/api/send-alimtalk', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session?.access_token ?? ''}`,
      },
      body: JSON.stringify({ order_id: orderId }),
    });

    let data;
    try {
      data = await response.json();
    } catch {
      return { success: false, error: `서버 응답 파싱 오류 (HTTP ${response.status})` };
    }

    if (!response.ok) {
      return { success: false, error: data?.error ?? `HTTP ${response.status}` };
    }
    if (data?.skipped) return { success: true, skipped: true };

    return { success: true };
  } catch (err) {
    console.error('[알림톡] sendAlimtalk error:', err);
    return { success: false, error: err.message };
  }
};
