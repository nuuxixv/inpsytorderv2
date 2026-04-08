import { supabase } from '../supabaseClient';

/**
 * 주문 ID를 받아 결제 완료 알림톡을 발송합니다.
 * send-alimtalk Edge Function을 통해 서버 사이드로 호출합니다.
 * @param {number} orderId
 * @returns {{ success: boolean, skipped?: boolean, error?: string }}
 */
export const sendAlimtalk = async (orderId) => {
  try {
    const { data, error } = await supabase.functions.invoke('send-alimtalk', {
      body: { order_id: orderId },
    });

    if (error) {
      // FunctionsHttpError일 때 실제 응답 바디를 추출
      let detail = error.message;
      try {
        const body = await error.context?.json?.();
        if (body?.error) detail = body.error;
      } catch {}
      console.error('[알림톡] invoke error:', detail, error);
      return { success: false, error: detail };
    }
    if (data?.skipped) return { success: true, skipped: true };
    // 원샷 API 실제 응답을 콘솔에 출력 (디버깅용)
    console.log('[알림톡] Edge Function 응답:', JSON.stringify(data));
    if (!data?.success) return { success: false, error: data?.error ?? '알 수 없는 오류' };

    return { success: true };
  } catch (err) {
    console.error('[알림톡] sendAlimtalk error:', err);
    return { success: false, error: err.message };
  }
};
