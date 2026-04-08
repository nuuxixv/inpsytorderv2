import { supabase } from '../supabaseClient';

/**
 * 주문 ID를 받아 결제 완료 알림톡을 발송합니다.
 * Vercel serverless(서울 리전, icn1)를 통해 한국 IP로 msgagent를 호출합니다.
 * msgagent는 서버 IP를 체크하므로 한국 IP가 필요합니다.
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
      return { success: false, error: `서버 응답 오류 (HTTP ${response.status})` };
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
