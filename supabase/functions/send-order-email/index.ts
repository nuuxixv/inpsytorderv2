import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.43.2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  try {
    const { record: order } = await req.json();
    if (!order) {
      return new Response("Order data not found", { status: 400 });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false },
    });

    const { data: orderItems, error: orderItemsError } = await supabase
      .from("order_items")
      .select("*, products(*)")
      .eq("order_id", order.id);

    if (orderItemsError) {
      throw new Error(`Failed to fetch order items: ${orderItemsError.message}`);
    }

    // 이메일 템플릿 읽기
    const emailTemplate = await Deno.readTextFile('./ordermail.html');

    // 주문 아이템 HTML 생성
    let orderItemsHtml = '';
    if (orderItems && orderItems.length > 0) {
      orderItems.forEach(item => {
        const product = item.products || {};
        const productName = product.name || '알 수 없는 상품';
        const price = item.price_at_purchase || 0;
        const quantity = item.quantity || 0;
        const itemTotal = price * quantity;

        orderItemsHtml += `
          <tr style="height: 22px;">
            <td style="overflow: hidden; padding: 2px 3px; vertical-align: middle;"></td>
            <td style="overflow: hidden; padding: 2px 3px; vertical-align: middle; font-family: 'Noto Sans KR'; font-size: 9pt; color: rgb(67, 67, 67);" colspan="4">${productName}</td>
            <td style="overflow: hidden; padding: 2px 3px; vertical-align: middle; font-family: 'Noto Sans KR'; font-size: 9pt; text-align: right;">${price.toLocaleString()}</td>
            <td style="overflow: hidden; padding: 2px 3px; vertical-align: middle; font-family: 'Noto Sans KR'; font-size: 9pt; text-align: right;">${quantity}</td>
            <td style="overflow: hidden; padding: 2px 3px; vertical-align: middle; font-family: 'Noto Sans KR'; font-size: 9pt; text-align: right;">${itemTotal.toLocaleString()}</td>
            <td style="overflow: hidden; padding: 2px 3px; vertical-align: middle;"></td>
          </tr>
        `;
      });
    } else {
      orderItemsHtml = `<tr><td colspan="9" style="text-align: center; padding: 10px;">주문 내역이 없습니다.</td></tr>`;
    }

    // 주소 포맷팅
    const formatAddress = (shipping_address) => {
      if (!shipping_address) return 'N/A';
      const { postcode, address, detail } = shipping_address;
      return `(${postcode}) ${address} ${detail || ''}`.trim();
    };

    // 데이터 객체 생성
    const emailData = {
      customerName: order.customer_name || '고객님',
      orderDate: new Date(order.created_at).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }),
      phoneNumber: order.phone_number || 'N/A',
      customerEmail: order.email,
      inpsytId: order.inpsyt_id || 'N/A',
      shippingAddress: formatAddress(order.shipping_address),
      customerRequest: order.customer_request || '없음',
      totalCost: (order.total_cost || 0).toLocaleString(),
      discountAmount: (order.discount_amount || 0).toLocaleString(),
      deliveryFee: (order.delivery_fee || 0).toLocaleString(),
      finalPayment: (order.final_payment || 0).toLocaleString(),
      orderItemsHtml: orderItemsHtml,
    };

    // 템플릿에 데이터 채우기
    let emailBody = emailTemplate;
    for (const [key, value] of Object.entries(emailData)) {
      emailBody = emailBody.replace(new RegExp(`{{${key}}}`, 'g'), String(value));
    }

    // Resend API 호출
    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "onboarding@resend.dev",
        to: order.email,
        subject: `[인싸이트] 주문이 성공적으로 접수되었습니다. (주문번호: ${order.id})`,
        html: emailBody,
      }),
    });

    if (!resendResponse.ok) {
      const errorData = await resendResponse.json();
      throw new Error(`Resend API Error: ${JSON.stringify(errorData)}`);
    }

    const data = await resendResponse.json();
    console.log("Email sent successfully:", data);

    return new Response(JSON.stringify(data), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    console.error("Edge Function Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { "Content-Type": "application/json" },
      status: 500,
    });
  }
});
