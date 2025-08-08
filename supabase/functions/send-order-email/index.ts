import postgres from "postgres";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.43.2";

// 환경 변수 로드
const DATABASE_URL = Deno.env.get("SUPABASE_DB_URL")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

// Supabase 클라이언트 초기화 (데이터 조회용)
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
});

// 이메일 발송 로직
export async function sendOrderEmail(orderId: number) {
  console.log(`Processing order ID: ${orderId}`);
  try {
    // 1. 주문 정보 및 관련 데이터 조회
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("*, events(name)")
      .eq("id", orderId)
      .single();

    if (orderError) throw orderError;
    if (!order) throw new Error(`Order with ID ${orderId} not found.`);

    const { data: orderItems, error: orderItemsError } = await supabase
      .from("order_items")
      .select("*, products(*)")
      .eq("order_id", order.id);

    if (orderItemsError) throw orderItemsError;

    // 2. 이메일 템플릿 및 내용 구성 (기존 로직 재사용)
    const emailTemplate = await Deno.readTextFile('./ordermail.html');
    
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

    const formatAddress = (shipping_address: any) => {
      if (!shipping_address) return 'N/A';
      const { postcode, address, detail } = shipping_address;
      return `(${postcode}) ${address} ${detail || ''}`.trim();
    };

    const emailData = {
      customerName: order.customer_name || '고객님',
      orderDate: new Date(order.created_at).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }),
      eventName: order.events?.name || 'N/A', // 학회명 추가
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

    let emailBody = emailTemplate;
    for (const [key, value] of Object.entries(emailData)) {
      emailBody = emailBody.replace(new RegExp(`{{${key}}}`, 'g'), String(value));
    }

    // 3. Resend API로 이메일 발송
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
    
    console.log(`Email for order ${orderId} sent successfully.`);

  } catch (error) {
    console.error(`Failed to process order ${orderId}:`, error);
    throw error; // <--- Add this line to re-throw the error
  }
}

// 데이터베이스 리스너 설정
async function setupListener() {
  const sql = postgres(DATABASE_URL);
  
  // 'order_paid' 채널을 리슨
  await sql.listen("order_paid", async (payload) => {
    try {
      const orderId = parseInt(payload, 10);
      if (isNaN(orderId)) {
        throw new Error(`Invalid order ID received: ${payload}`);
      }
      await sendOrderEmail(orderId);
    } catch (e) {
      console.error("Error processing notification payload:", e);
    }
  });

  console.log("Database listener started for 'order_paid' channel.");
}

// 리스너 실행
setupListener().catch(e => {
  console.error("Failed to setup database listener:", e);
  // 리스너 설정에 실패하면 프로세스를 종료하여 재시작을 유도할 수 있습니다.
  Deno.exit(1);
});