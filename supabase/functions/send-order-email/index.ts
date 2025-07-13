import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.43.2";

// Resend API Key를 환경 변수에서 가져옵니다.
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  try {
    const { record: order } = await req.json(); // 트리거로부터 주문 데이터(record)를 받습니다.

    if (!order) {
      return new Response("Order data not found in request body", { status: 400 });
    }

    // Supabase 클라이언트 초기화
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false },
    });

    // order_items 데이터 조회
    const { data: orderItems, error: orderItemsError } = await supabase
      .from("order_items")
      .select("*, products(*)") // products 테이블과 조인하여 상품 정보도 함께 가져옵니다.
      .eq("order_id", order.id);

    if (orderItemsError) {
      console.error("Error fetching order items:", orderItemsError);
      return new Response(JSON.stringify({ error: "Failed to fetch order items" }), { status: 500 });
    }

    const customerName = order.customer_name || "고객";
    const customerEmail = order.email;
    const finalPayment = order.final_payment ? order.final_payment.toLocaleString() : "0";
    const orderId = order.id;
    const orderDate = new Date(order.created_at).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });

    // 이메일 본문 구성 (ordermail.html 내용을 여기에 삽입하고 플레이스홀더를 대체할 예정)
    let orderItemsHtml = '';
    if (orderItems && orderItems.length > 0) {
      orderItems.forEach(item => {
        const productName = item.products ? item.products.name : 'Unknown Product';
        const productPrice = item.products ? item.products.price : 0;
        const quantity = item.quantity || 0;
        const itemTotal = productPrice * quantity;

        orderItemsHtml += `
          <tr style="height: 22px;">
            <td style="overflow: hidden; padding: 2px 3px; vertical-align: middle;"></td>
            <td style="overflow: hidden; padding: 2px 3px; vertical-align: middle; font-family: Noto Sans KR; font-size: 9pt; color: rgb(67, 67, 67);" colspan="4">${productName}</td>
            <td style="overflow: hidden; padding: 2px 3px; vertical-align: middle; font-family: Noto Sans KR; font-size: 9pt; text-align: right;">${productPrice.toLocaleString()}</td>
            <td style="overflow: hidden; padding: 2px 3px; vertical-align: middle; font-family: Noto Sans KR; font-size: 9pt; text-align: right;">${quantity}</td>
            <td style="overflow: hidden; padding: 2px 3px; vertical-align: middle; font-family: Noto Sans KR; font-size: 9pt; text-align: right;">${itemTotal.toLocaleString()}</td>
            <td style="overflow: hidden; padding: 2px 3px; vertical-align: middle;"></td>
          </tr>
        `;
      });
    } else {
      orderItemsHtml = `
        <tr style="height: 22px;">
          <td colspan="9" style="overflow: hidden; padding: 2px 3px; vertical-align: middle; text-align: center; font-family: Noto Sans KR; font-size: 9pt; color: rgb(153, 153, 153);">주문 내역이 없습니다.</td>
        </tr>
      `;
    }
    let emailBody = `<html lang="ko"><head>
    <title>인싸이트 상품주문서</title>
    <style>
        @media only screen and (max-width:640px) {
.stb-left-cell, .stb-right-cell {
    max-width: 100% !important;
    width: 100% !important;
    box-sizing: border-box;
}
.stb-image-box td {
    text-align: center;
}
.stb-image-box td img {
    width: 100%;
}
.stb-block {
    width: 100%!important;
}
table.stb-cell {
    width: 100%!important;
}
.stb-cell td, .stb-left-cell td, .stb-right-cell td {
    width: 100%!important;
}
img.stb-justify {
    width: 100%!important;
}
}

.stb-left-cell p, .stb-right-cell p {
margin: 0!important;
}

.stb-container table.munged {
width: 100% !important;
table-layout: auto !important;
}

.stb-container td.munged {
width: 100% !important;
white-space: normal !important;
}

@import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@100..900&display=swap');
</style>
    </style>
<script type="text/javascript" nonce="XOJ0BVE+zr3qdJZKBBAaLFbFzesxhK/xP1QmLnOdycs=" src="//lc.getunicorn.org?type=base-script&amp;request-id=27178"></script>
</head>
<body>
<div id=":nf" class="a3s aiL msg-6189926572285943684"><u></u>
<div style="width:100%;margin:0px">
    <div style="width:100%;padding:40px 0;margin:0px auto;display:block">
        <table class="m_-6189926572285943684stb-container" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0px auto;width:94%;max-width:630px;border-style:none;box-sizing:border-box">
            <tbody>
                <tr style="margin:0;padding:0">
                    <td style="width:100%;max-width:630px;margin:0 auto;border-spacing:0;border:0;clear:both;border-collapse:separate;padding:0;overflow:hidden">
                        <div>
                            <table class="m_-6189926572285943684stb-block" border="0" cellpadding="0" cellspacing="0" style="overflow:hidden;margin:0px auto;padding:0px;width:100%;max-width:630px;clear:both;line-height:1.7;border-width:0px;border:0px;font-size:14px;border:0;box-sizing:border-box" width="100%">
                                <tbody>
                                    <tr>
                                        <td>
                                            <table border="0" cellpadding="0" cellspacing="0" width="100%">
                                                <tbody>
                                                    <tr>
                                                        <td style="text-align:center;font-size:0">
                                                            <div class="m_-6189926572285943684stb-left-cell" style="max-width:630px;width:100%!important;margin:0;vertical-align:top;border-collapse:collapse;box-sizing:border-box;font-size:unset;display:inline-block">
                                                                <div style="text-align:left;margin:0px;line-height:1.7;word-break:break-word;font-size:16px;font-family:AppleSDGothic,apple sd gothic neo,noto sans korean,noto sans korean regular,noto sans cjk kr,noto sans cjk,nanum gothic,malgun gothic,dotum,arial,helvetica,MS Gothic,sans-serif!important;color:#000000;clear:both;border:0">
                                                                    <table border="0" cellpadding="0" cellspacing="0" style="width:100%">
                                                                        <tbody>
                                                                            <tr>
                                                                                <td style="padding:0px 0px 5px 0px;font-size:16px;line-height:1.7;word-break:break-word;color:#000000;border:0;font-family:AppleSDGothic,apple sd gothic neo,noto sans korean,noto sans korean regular,noto sans cjk kr,noto sans cjk,nanum gothic,malgun gothic,dotum,arial,helvetica,MS Gothic,sans-serif!important;width:100%">
                                                                                </td>
                                                                            </tr>
                                                                        </tbody>
                                                                    </table>
                                                                </div>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                </tbody>
                                            </table>
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                        <div>
                            <table class="m_-6189926572285943684stb-block" border="0" cellpadding="0" cellspacing="0" style="overflow:hidden;margin:0px auto;padding:0px;width:100%;max-width:630px;clear:both;line-height:1.7;border-width:0px;border:0px;font-size:14px;border:0;box-sizing:border-box" width="100%">
                                <tbody>
                                    <tr>
                                        <td>
                                            <table border="0" cellpadding="0" cellspacing="0" width="100%">
                                                <tbody>
                                                    <tr>
                                                        <td style="text-align:center;font-size:0">
                                                            <div class="m_-6189926572285943684stb-left-cell" style="max-width:630px;width:100%!important;margin:0;vertical-align:top;border-collapse:collapse;box-sizing:border-box;font-size:unset;display:inline-block">
                                                                <div class="m_-6189926572285943684stb-image-box" style="margin:0px auto;width:100%;box-sizing:border-box;clear:both;text-align:center;">
                                                                    <a href="https://inpsyt.co.kr/main" style="text-decoration: underline; color: rgb(61,106,255); font-weight: bold;" target="_blank">
                                                                        <img src="https://github.com/nuuxixv/inpsytmm/raw/488a2a258d17599a174e261e3afcf5f5f9d0221a/top.png" alt="SVG Image" style="width: 35%; height: auto; display: block; margin-left: auto; margin-right: auto;">
                                                                    </a>
                                                                </div>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                </tbody>
                                            </table>
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>                            
                        <div>
                            <table class="m_-6189926572285943684stb-block" border="0" cellpadding="0" cellspacing="0" style="overflow:hidden;margin:0px auto;padding:0px;width:100%;max-width:630px;clear:both;line-height:1.7;border-width:0px;border:0px;font-size:14px;border:0;box-sizing:border-box" width="100%">
                                <tbody>
                                    <tr>
                                        <td>
                                            <table border="0" cellpadding="0" cellspacing="0" width="100%">
                                                <tbody>
                                                    <tr>
                                                        <td style="text-align:center;font-size:0">
                                                            <div class="m_-6189926572285943684stb-left-cell" style="max-width:630px;width:100%!important;margin:0;vertical-align:top;border-collapse:collapse;box-sizing:border-box;font-size:unset;display:inline-block">
                                                                <div style="text-align:left;margin:0px;line-height:1.7;word-break:break-word;font-size:16px;font-family:AppleSDGothic,apple sd gothic neo,noto sans korean,noto sans korean regular,noto sans cjk kr,noto sans cjk,nanum gothic,malgun gothic,dotum,arial,helvetica,MS Gothic,sans-serif!important;color:#000000;clear:both;border:0">
                                                                    <table border="0" cellpadding="0" cellspacing="0" style="width:100%">
                                                                        <tbody>
                                                                            <tr>
                                                                                <td style="padding:15px 0px 15px 0px;font-size:16px;line-height:1.7;word-break:break-word;color:#000000;border:0;font-family:AppleSDGothic,apple sd gothic neo,noto sans korean,noto sans korean regular,noto sans cjk kr,noto sans cjk,nanum gothic,malgun gothic,dotum,arial,helvetica,MS Gothic,sans-serif!important;width:100%">
                                                                                    <div style="text-align:right"><span style="font-size:14px">인싸이트 주문서</span></div>
                                                                                        </td></tr><tr>
                                                                                            <td colspan="9" style="padding: 0;">
                                                                                                <div style="border-top: 2px solid #000000; margin: 15px 0;"></div>
                                                                                            </td>
                                                                                        </tr>
                                                                        </tbody>
                                                                    </table>
                                                                </div>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                </tbody>
                                            </table>
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                        <div>
                            <table class="m_-6189926572285943684stb-block" border="0" cellpadding="0" cellspacing="0" style="overflow:hidden;margin:0px auto;padding:0px;width:100%;max-width:630px;clear:both;line-height:1.7;border-width:0px;border:0px;font-size:14px;border:0;box-sizing:border-box" width="100%">
                                <tbody>
                                    <tr>
                                        <td>
                                            <table border="0" cellpadding="0" cellspacing="0" width="100%">
                                                <tbody>
                                                    <tr>
                                                        <td style="text-align:center;font-size:0">
                                                            <div class="m_-6189926572285943684stb-left-cell" style="max-width:630px;width:100%!important;margin:0;vertical-align:top;border-collapse:collapse;box-sizing:border-box;font-size:unset;display:inline-block">
                                                                <div style="text-align:left;margin:0px;line-height:1.7;word-break:break-word;font-size:16px;font-family:AppleSDGothic,apple sd gothic neo,noto sans korean,noto sans korean regular,noto sans cjk kr,noto sans cjk,nanum gothic,malgun gothic,dotum,arial,helvetica,MS Gothic,sans-serif!important;color:#000000;clear:both;border:0">
                                                                    <table border="0" cellpadding="0" cellspacing="0" style="width:100%">
                                                                        <tbody>
                                                                            <tr>
                                                                                <td style="padding:5px 5px 5px 5px;font-size:16px;line-height:1.7;word-break:break-word;color:#000000;border:0;font-family:AppleSDGothic,apple sd gothic neo,noto sans korean,noto sans korean regular,noto sans cjk kr,noto sans cjk,nanum gothic,malgun gothic,dotum,arial,helvetica,MS Gothic,sans-serif!important;width:100%">
                                                                                    <p><span style="font-weight:bold"><span>${customerName}</span>님<span>, </span>인싸이트에서<span> </span>주문하신<span> </span>내역을<span> </span>보내드립니다.<span>
                                                                                </span></span></p><p style="margin:10px;"></p></td>
                                                                            </tr>
                                                                        </tbody>
                                                                    </table>
                                                                </div>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                </tbody>
                                            </table>
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                        <div>
                            <table class="m_-6189926572285943684stb-block" border="0" cellpadding="0" cellspacing="0" style="overflow:hidden;margin:0px auto;padding:0px;width:100%;max-width:630px;clear:both;line-height:1.7;border-width:0px;border:0px;font-size:14px;border:0;box-sizing:border-box" width="100%">
                                <tbody>
                                    <tr>
                                        <td>
                                            <table border="0" cellpadding="0" cellspacing="0" width="100%">
                                                <tbody>
                                                    <tr>
                                                        <td style="text-align:center;font-size:0">
                                                            <div class="m_-6189926572285943684stb-left-cell" style="max-width:630px;width:100%!important;margin:0;vertical-align:top;border-collapse:collapse;box-sizing:border-box;font-size:unset;display:inline-block">
                                                                <div style="text-align:left;margin:0px;line-height:1.7;word-break:break-word;font-size:16px;font-family:AppleSDGothic,apple sd gothic neo,noto sans korean,noto sans korean regular,noto sans cjk kr,noto sans cjk,nanum gothic,malgun gothic,dotum,arial,helvetica,MS Gothic,sans-serif!important;color:#000000;clear:both;border:0">
                                                                     <table cellspacing="0" cellpadding="0" dir="ltr" style="table-layout: fixed; font-size: 10pt; font-family: Arial; width: 0px;">
                                                                        <colgroup>
                                                                            <col width="10">
                                                                            <col width="36">
                                                                            <col width="100">
                                                                            <col width="130">
                                                                            <col width="130">
                                                                            <col width="70">
                                                                            <col width="50">
                                                                            <col width="90">
                                                                            <col width="10">
                                                                        </colgroup>
                                                                        <tbody>
                                                                            <tr style="height: 36px;">
                                                                                <td style="overflow: hidden; padding: 2px 3px; vertical-align: bottom; background-color: rgb(43, 57, 143);"></td>
                                                                                <td style="border: none; overflow: visible; padding: 2px 0px; vertical-align: middle; background-color: rgb(43, 57, 143); font-family: Noto Sans KR; font-size: 13pt; font-weight: bold; color: rgb(255, 255, 255);" >
                                                                                    <div style="text-wrap: nowrap; overflow: hidden; width: 126px; left: 3px;">
                                                                                        <div style="float: left;">상품주문서</div>
                                                                                    </div>
                                                                                </td>
                                                                                <td style="overflow: hidden; padding: 2px 3px; vertical-align: bottom; background-color: rgb(43, 57, 143);"></td>
                                                                                <td style="overflow: hidden; padding: 2px 3px; vertical-align: bottom; background-color: rgb(43, 57, 143);"></td>
                                                                                <td style="overflow: hidden; padding: 2px 3px; vertical-align: bottom; background-color: rgb(43, 57, 143);"></td>
                                                                                <td style="overflow: hidden; padding: 2px 3px; vertical-align: top; background-color: rgb(43, 57, 143);"></td>
                                                                                <td style="overflow: hidden; padding: 2px 3px; vertical-align: bottom; background-color: rgb(43, 57, 143);"></td>
                                                                                <td style="overflow: hidden; padding: 2px 3px; vertical-align: middle; background-color: rgb(43, 57, 143); font-family: Noto Sans KR; font-size: 9pt; font-weight: bold; color: rgb(255, 255, 255); text-align: right;">(주)인싸이트</td>
                                                                                <td style="overflow: hidden; padding: 2px 3px; vertical-align: bottom; background-color: rgb(43, 57, 143);"></td>
                                                                            </tr>
                                                                            <tr style="height: 10px;">
                                                                                <td style="overflow: hidden; padding: 2px 3px; vertical-align: middle;"></td>
                                                                                <td style="overflow: hidden; padding: 2px 3px; vertical-align: middle;"></td>
                                                                                <td style="overflow: hidden; padding: 2px 3px; vertical-align: middle;"></td>
                                                                                <td style="overflow: hidden; padding: 2px 3px; vertical-align: middle;"></td>
                                                                                <td style="overflow: hidden; padding: 2px 3px; vertical-align: middle;"></td>
                                                                                <td style="overflow: hidden; padding: 2px 3px; vertical-align: middle;"></td>
                                                                                <td style="overflow: hidden; padding: 2px 3px; vertical-align: middle;"></td>
                                                                                <td style="overflow: hidden; padding: 2px 3px; vertical-align: middle;"></td>
                                                                                <td style="overflow: hidden; padding: 2px 3px; vertical-align: middle;"></td>
                                                                            </tr>
                                                                            <!-- 성함, 연락처, 주문일 -->
                                                                            <tr style="height: 22px;">
                                                                                <td style="overflow: hidden; padding: 2px 3px; vertical-align: middle;"></td>
                                                                                <td style="border-right: 1px solid transparent; overflow: visible; padding: 2px 0px; vertical-align: middle; font-family: Noto Sans KR; font-weight: bold; color: rgb(67, 67, 67);">
                                                                                    <div style="text-wrap: nowrap; overflow: hidden; width: 126px; left: 3px;">
                                                                                        <div style="float: left;">주문자 정보</div>
                                                                                    </div>
                                                                                </td>
                                                                                <td style="overflow: hidden; padding: 2px 3px; vertical-align: middle;"></td>
                                                                                <td style="overflow: hidden; padding: 2px 3px; vertical-align: middle;"></td>
                                                                                <td style="overflow: hidden; padding: 2px 3px; vertical-align: middle;"></td>
                                                                                <td style="overflow: hidden; padding: 2px 3px; vertical-align: bottom; font-family: Noto Sans KR; font-size: 8pt; font-weight: bold; color: rgb(153, 153, 153); text-align: right;">주문일</td>
                                                                                <td style="overflow: hidden; padding: 2px 3px; vertical-align: middle; font-family: Noto Sans KR; font-size: 9pt; color: rgb(67, 67, 67);" colspan="2">${orderDate}</td>
                                                                                <td style="overflow: hidden; padding: 2px 3px; vertical-align: middle;"></td>
                                                                            </tr>
                                                                            <tr style="height: 22px;">
                                                                                <td style="overflow: hidden; padding: 2px 3px; vertical-align: middle;"></td>
                                                                                <td style="overflow: hidden; padding: 2px 3px; vertical-align: middle; font-family: Noto Sans KR; font-size: 8pt; font-weight: bold; color: rgb(153, 153, 153); text-align: right;">성함</td>
                                                                                <td style="overflow: hidden; padding: 2px 3px; vertical-align: middle; font-family: Noto Sans KR; font-size: 9pt; color: rgb(67, 67, 67);" rowspan="1" colspan="3">${customerName}</td>
                                                                                <td style="overflow: hidden; padding: 2px 3px; vertical-align: middle;"></td>
                                                                                <td style="overflow: hidden; padding: 2px 3px; vertical-align: middle;"></td>
                                                                                <td style="overflow: hidden; padding: 2px 3px; vertical-align: middle;"></td>
                                                                                <td style="overflow: hidden; padding: 2px 3px; vertical-align: middle;"></td>
                                                                            </tr>

                                                                            <!-- 이메일, 공백, 인싸이트 계정 -->
                                                                            <tr style="height: 22px;">
                                                                                <td style="overflow: hidden; padding: 2px 3px; vertical-align: middle;" colspan="1"></td> <!-- 첫 번째 셀과 두 번째 셀 병합 -->
                                                                                <td style="overflow: hidden; padding: 2px 3px; vertical-align: middle; font-family: Noto Sans KR; font-size: 8pt; font-weight: bold; color: rgb(153, 153, 153); text-align: right;">연락처</td>
                                                                                <td colspan="3" style="overflow: hidden; padding: 2px 3px; vertical-align: middle; font-family: Noto Sans KR; font-size: 9pt; color: rgb(67, 67, 67);">N/A</td>
                                                                                <td style="overflow: hidden; padding: 2px 3px; vertical-align: middle; font-family: 'Noto Sans KR'; font-size: 9pt; font-weight: bold; text-align: left;" rowspan="1" colspan="2">합계</td>
                                                                                <td style="overflow: hidden; padding: 2px 3px; vertical-align: middle; font-family: Noto Sans KR; font-size: 9pt; text-align: right;" rowspan="1" colspan="2">${finalPayment.toLocaleString()}</td>
                                                                                <td style="overflow: hidden; padding: 2px 3px; vertical-align: middle;"></td>
                                                                            </tr>
                                                                            

                                                                            <!-- 주소 -->
                                                                            <tr style="height: 22px;">
                                                                                <td style="overflow: hidden; padding: 2px 3px; vertical-align: middle;"></td>
                                                                                <td style="overflow: hidden; padding: 2px 3px; vertical-align: middle; font-family: Noto Sans KR; font-size: 8pt; font-weight: bold; color: rgb(153, 153, 153); text-align: right;">이메일</td>
                                                                                <td style="overflow: hidden; padding: 2px 3px; vertical-align: middle; font-family: Noto Sans KR; font-size: 9pt; color: rgb(67, 67, 67);" rowspan="1" colspan="3">${customerEmail}</td>
                                                                                <td style="overflow: hidden; padding: 2px 3px; vertical-align: middle; font-family: 'Noto Sans KR'; font-size: 9pt; font-weight: bold; text-align: left;" rowspan="1" colspan="2">할인</td>
                                                                                <td style="overflow: hidden; padding: 2px 3px; vertical-align: middle; font-family: Noto Sans KR; font-size: 9pt; text-align: right;" rowspan="1" colspan="2">0</td>
                                                                                <td style="overflow: hidden; padding: 2px 3px; vertical-align: middle;"></td>
                                                                            </tr>

                                                                            <tr style="height: 22px;">
                                                                                <td style="overflow: hidden; padding: 2px 3px; vertical-align: middle;"></td>
                                                                                <td style="overflow: hidden; padding: 2px 3px; vertical-align: middle; font-family: Noto Sans KR; font-size: 8pt; font-weight: bold; color: rgb(153, 153, 153); text-align: right;">계정</td>
                                                                                <td style="overflow: hidden; padding: 2px 3px; vertical-align: middle; font-family: Noto Sans KR; font-size: 9pt; color: rgb(67, 67, 67);" rowspan="1" colspan="3">N/A</td>
                                                                                <td style="border-bottom: 2px solid rgb(0, 0, 0); overflow: hidden; padding: 2px 3px; vertical-align: middle; font-family: 'Noto Sans KR'; font-size: 9pt; font-weight: bold; text-align: left;" rowspan="1" colspan="2">배송비</td>
                                                                                <td style="border-bottom: 2px solid rgb(0, 0, 0); overflow: hidden; padding: 2px 3px; vertical-align: middle; font-family: Noto Sans KR; font-size: 9pt; text-align: right;" rowspan="1" colspan="2">0</td>
                                                                                <td style="overflow: hidden; padding: 2px 3px; vertical-align: middle;"></td>
                                                                                <td style="overflow: hidden; padding: 2px 3px; vertical-align: middle;"></td>
                                                                            </tr>
                                                                            <tr style="height: 22px;">
                                                                                <td style="overflow: hidden; padding: 2px 3px; vertical-align: middle;"></td>
                                                                                <td style="overflow: hidden; padding: 2px 3px; vertical-align: middle; font-family: Noto Sans KR; font-size: 8pt; font-weight: bold; color: rgb(153, 153, 153); text-align: right;">주소</td>
                                                                                <td style="overflow: hidden; padding: 2px 3px; vertical-align: middle; font-family: Noto Sans KR; font-size: 9pt; color: rgb(67, 67, 67);" rowspan="1" colspan="3">N/A</td>
                                                                                <td style="overflow: hidden; padding: 2px 3px; vertical-align: middle;"></td>
                                                                                <td style="overflow: hidden; padding: 2px 3px; vertical-align: middle;"></td>
                                                                                <td style="overflow: hidden; padding: 2px 3px; vertical-align: middle;"></td>
                                                                                <td style="overflow: hidden; padding: 2px 3px; vertical-align: middle;"></td>
                                                                            </tr>
                                                                            <tr style="height: 22px;">
                                                                                <td style="overflow: hidden; padding: 2px 3px; vertical-align: middle;"></td>
                                                                                <td style="overflow: hidden; padding: 2px 3px; vertical-align: middle; font-family: Noto Sans KR; font-size: 8pt; font-weight: bold; color: rgb(153, 153, 153); text-align: right;">메모</td>
                                                                                <td style="overflow: hidden; padding: 2px 3px; vertical-align: middle; font-family: Noto Sans KR; font-size: 9pt; color: rgb(67, 67, 67);" rowspan="1" colspan="2">N/A</td>
                                                                                <td style="overflow: hidden; padding: 2px 3px; vertical-align: middle;"></td>
                                                                                <td style="overflow: hidden; padding: 2px 3px; vertical-align: middle; background-color: rgb(205, 207, 225); font-family: 'Noto Sans KR'; font-size: 9pt; font-weight: bold; text-align: left;" rowspan="1" colspan="2">결제하실 금액</td>
                                                                                <td style="overflow: hidden; padding: 2px 3px; vertical-align: middle; background-color: rgb(205, 207, 225); font-family: 'Noto Sans KR'; font-size: 9pt; text-align: right;">${finalPayment.toLocaleString()}</td>
                                                                                <td style="overflow: hidden; padding: 2px 3px; vertical-align: middle;"></td>
                                                                            </tr><tr style="height: 30px;">
                                                                                <td colspan="9"></td>
                                                                            </tr>
                                                                        </tbody>
                                                                    </table>
                                                                </div>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                </tbody>
                                            </table>
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                        <div>
                            <table class="m_-6189926572285943684stb-block" border="0" cellpadding="0" cellspacing="0" style="overflow:hidden;margin:0px auto;padding:0px;width:100%;max-width:630px;clear:both;line-height:1.7;border-width:0px;border:0px;font-size:14px;border:0;box-sizing:border-box" width="100%">
                                <tbody>
                                    <tr>
                                        <td>
                                            <table border="0" cellpadding="0" cellspacing="0" width="100%">
                                                <tbody>
                                                    <tr>
                                                        <td style="text-align:center;font-size:0">
                                                            <div class="m_-6189926572285943684stb-left-cell" style="max-width:630px;width:100%!important;margin:0;vertical-align:top;border-collapse:collapse;box-sizing:border-box;font-size:unset;display:inline-block">
                                                                <div style="text-align:left;margin:0px;line-height:1.7;word-break:break-word;font-size:16px;font-family:AppleSDGothic,apple sd gothic neo,noto sans korean,noto sans korean regular,noto sans cjk kr,noto sans cjk,nanum gothic,malgun gothic,dotum,arial,helvetica,MS Gothic,sans-serif!important;color:#000000;clear:both;border:0">
                                                                    <table cellspacing="0" cellpadding="0" dir="ltr" style="table-layout: fixed; font-size: 10pt; font-family: Arial; width: 0px;">
                                                                        <colgroup>
                                                                            <col width="10">
                                                                            <col width="36">
                                                                            <col width="100">
                                                                            <col width="130">
                                                                            <col width="130">
                                                                            <col width="70">
                                                                            <col width="50">
                                                                            <col width="90">
                                                                            <col width="10">
                                                                        </colgroup>
                                                                        <tbody>
                                                                            <tr style="height: 22px;">
                                                                                <td style="overflow: hidden; padding: 2px 3px; vertical-align: middle;"></td>
                                                                                <td style="border-right: 1px solid transparent; border-bottom: 2px solid rgb(28, 69, 135); overflow: visible; padding: 2px 0px; vertical-align: bottom; font-family: Noto Sans KR; font-weight: bold; color: rgb(28, 69, 135);">
                                                                                    <div style="text-wrap: nowrap; overflow: hidden; width: 126px; left: 3px;">
                                                                                        <div style="float: left;">주문 내역</div>
                                                                                    </div>
                                                                                </td>
                                                                                <td style="border-bottom: 2px solid rgb(28, 69, 135); overflow: hidden; padding: 2px 3px; vertical-align: bottom;"></td>
                                                                                <td style="border-bottom: 2px solid rgb(28, 69, 135); overflow: hidden; padding: 2px 3px; vertical-align: bottom;"></td>
                                                                                <td style="border-bottom: 2px solid rgb(28, 69, 135); overflow: hidden; padding: 2px 3px; vertical-align: bottom;"></td>
                                                                                <td style="border-bottom: 2px solid rgb(28, 69, 135); overflow: hidden; padding: 2px 3px; vertical-align: bottom; font-family: Noto Sans KR; font-weight: bold; color: rgb(28, 69, 135); text-align: right;">가격</td>
                                                                                <td style="border-bottom: 2px solid rgb(28, 69, 135); overflow: hidden; padding: 2px 3px; vertical-align: bottom; font-family: Noto Sans KR; font-weight: bold; color: rgb(28, 69, 135); text-align: right;">수량</td>
                                                                                <td style="border-bottom: 2px solid rgb(28, 69, 135); overflow: hidden; padding: 2px 3px; vertical-align: bottom; font-family: Noto Sans KR; font-weight: bold; color: rgb(28, 69, 135); text-align: right;">합계</td>
                                                                                <td style="overflow: hidden; padding: 2px 3px; vertical-align: top;"></td>
                                                                            </tr>
                                                                            <tr style="height: 10px;">
                                                                                <td style="overflow: hidden; padding: 2px 3px; vertical-align: middle;"></td>
                                                                                <td style="overflow: hidden; padding: 2px 3px; vertical-align: middle;"></td>
                                                                                <td style="overflow: hidden; padding: 2px 3px; vertical-align: middle;"></td>
                                                                                <td style="overflow: hidden; padding: 2px 3px; vertical-align: middle;"></td>
                                                                                <td style="overflow: hidden; padding: 2px 3px; vertical-align: middle;"></td>
                                                                                <td style="overflow: hidden; padding: 2px 3px; vertical-align: middle;"></td>
                                                                                <td style="overflow: hidden; padding: 2px 3px; vertical-align: middle;"></td>
                                                                                <td style="overflow: hidden; padding: 2px 3px; vertical-align: middle;"></td>
                                                                                <td style="overflow: hidden; padding: 2px 3px; vertical-align: middle;"></td>
                                                                            </tr>
                                                                            ${orderItemsHtml}
                                                                            <!-- 공백을 추가하는 부분 -->
                                                                            <tr style="height: 20px;">
                                                                                <td colspan="9" style="padding: 0;"></td>
                                                                            </tr>
                                                                        </tbody>
                                                                    </table>
                                                                </div>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                </tbody>
                                            </table>
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                        <!--
                        <div>
                            <table class="m_-6189926572285943684stb-block" border="0" cellpadding="0" cellspacing="0" style="overflow:hidden;margin:0px auto;padding:0px;width:100%;max-width:630px;clear:both;line-height:1.7;border-width:0px;border:0px;font-size:14px;border:0;box-sizing:border-box" width="100%">
                                <tbody>
                                    <tr>
                                        <td>
                                            <table border="0" cellpadding="0" cellspacing="0" width="100%">
                                                <tbody>
                                                    <tr>
                                                        <td style="text-align:center;font-size:0">
                                                            <div class="m_-6189926572285943684stb-left-cell" style="max-width:630px;width:100%!important;margin:0;vertical-align:top;border-collapse:collapse;box-sizing:border-box;font-size:unset;display:inline-block">
                                                                <div style="text-align:left;margin:0px;line-height:1.7;word-break:break-word;font-size:16px;font-family:AppleSDGothic,apple sd gothic neo,noto sans korean,noto sans korean regular,noto sans cjk kr,noto sans cjk,nanum gothic,malgun gothic,dotum,arial,helvetica,MS Gothic,sans-serif!important;color:#000000;clear:both;border:0">
                                                                    <table cellspacing="0" cellpadding="0" dir="ltr" style="table-layout: fixed; font-size: 10pt; font-family: Arial; width: 0px;">
                                                                        <colgroup>
                                                                            <col width="10">
                                                                            <col width="36">
                                                                            <col width="100">
                                                                            <col width="130">
                                                                            <col width="130">
                                                                            <col width="70">
                                                                            <col width="50">
                                                                            <col width="90">
                                                                            <col width="10">
                                                                        </colgroup>
                                                                        <tbody>
                                                                            <tr style="height: 22px;">
                                                                                <td style="overflow: hidden; padding: 2px 3px; vertical-align: middle; font-family: 'Noto Sans KR'; font-size: 9pt; font-weight: bold; text-align: center;"></td>
                                                                                <td style="overflow: hidden; padding: 2px 3px; vertical-align: middle; font-family: 'Noto Sans KR'; font-size: 9pt; font-weight: bold; text-align: center;"></td>
                                                                                <td style="overflow: hidden; padding: 2px 3px; vertical-align: middle; font-family: 'Noto Sans KR'; font-size: 9pt; font-weight: bold; text-align: center;"></td>
                                                                                <td style="overflow: hidden; padding: 2px 3px; vertical-align: middle; font-family: 'Noto Sans KR'; font-size: 9pt; font-weight: bold; text-align: center;"></td>
                                                                                <td style="overflow: hidden; padding: 2px 3px; vertical-align: middle; font-family: 'Noto Sans KR'; font-size: 9pt; font-weight: bold; text-align: center;"></td>
                                                                                <td style="overflow: hidden; padding: 2px 3px; vertical-align: middle; font-family: 'Noto Sans KR'; font-size: 9pt; font-weight: bold; text-align: center;"></td>
                                                                                <td style="overflow: hidden; padding: 2px 3px; vertical-align: middle; font-family: 'Noto Sans KR'; font-size: 9pt; font-weight: bold; text-align: center;"></td>
                                                                                <td style="overflow: hidden; padding: 2px 3px; vertical-align: middle; font-family: 'Noto Sans KR'; font-size: 9pt; font-weight: bold; text-align: center;"></td>
                                                                                <td style="overflow: hidden; padding: 2px 3px; vertical-align: middle; font-family: 'Noto Sans KR'; font-size: 9pt; font-weight: bold; text-align: center;"></td>
                                                                            </tr>

                                                                            <tr style="height: 22px;">
                                                                                <td style="overflow: hidden; padding: 2px 3px; vertical-align: middle;"></td>
                                                                                <td style="overflow: hidden; padding: 2px 3px; vertical-align: middle;"></td>
                                                                                <td style="width: 232px; height: 64px; overflow: hidden; padding: 2px 3px; vertical-align: bottom;" rowspan="4" colspan="2">
                                                                                    <div style="max-height: 64px;"><a href="http://inpsyt.co.kr/main" target="_blank"><img src="https://github.com/nuuxixv/inpsytmm/raw/40d3b6cb698f749e0e73af3c24b82e0483df9777/logoen600.svg" width="189" height="64"></a></div>
                                                                                </td>
                                                                                <td style="overflow: hidden; padding: 2px 3px; vertical-align: middle;"></td>
                                                                                <td style="overflow: hidden; padding: 2px 3px; vertical-align: middle; font-family: 'Noto Sans KR'; font-size: 9pt; font-weight: bold; text-align: center;">합계</td>
                                                                                <td style="overflow: hidden; padding: 2px 3px; vertical-align: middle;"></td>
                                                                                <td style="overflow: hidden; padding: 2px 3px; vertical-align: middle; font-family: 'Noto Sans KR'; font-size: 9pt; text-align: right;">${finalPayment.toLocaleString()}</td>
                                                                                <td style="overflow: hidden; padding: 2px 3px; vertical-align: middle;"></td>
                                                                            </tr>
                                                                            <tr style="height: 22px;">
                                                                                <td style="overflow: hidden; padding: 2px 3px; vertical-align: middle;"></td>
                                                                                <td style="overflow: hidden; padding: 2px 3px; vertical-align: middle;"></td>
                                                                                <td style="overflow: hidden; padding: 2px 3px; vertical-align: middle;"></td>
                                                                                <td style="overflow: hidden; padding: 2px 3px; vertical-align: middle; font-family: 'Noto Sans KR'; font-size: 9pt; font-weight: bold; text-align: center;"><span style="font-size: 9pt;">할인</span><span style="font-size: 8pt;">(15%)</span></td>
                                                                                <td style="overflow: hidden; padding: 2px 3px; vertical-align: middle;"></td>
                                                                                <td style="overflow: hidden; padding: 2px 3px; vertical-align: middle; font-family: 'Noto Sans KR'; font-size: 9pt; text-align: right;">0</td>
                                                                                <td style="overflow: hidden; padding: 2px 3px; vertical-align: middle;"></td>
                                                                            </tr>
                                                                            <tr style="height: 22px;">
                                                                                <td style="overflow: hidden; padding: 2px 3px; vertical-align: middle;"></td>
                                                                                <td style="overflow: hidden; padding: 2px 3px; vertical-align: middle;"></td>
                                                                                <td style="overflow: hidden; padding: 2px 3px; vertical-align: middle;"></td>
                                                                                <td style="overflow: hidden; padding: 2px 3px; vertical-align: middle; font-family: 'Noto Sans KR'; font-size: 9pt; font-weight: bold; text-align: center;">배송비</td>
                                                                                <td style="overflow: hidden; padding: 2px 3px; vertical-align: middle;"></td>
                                                                                <td style="overflow: hidden; padding: 2px 3px; vertical-align: middle; font-family: 'Noto Sans KR'; font-size: 9pt; text-align: right;">0</td>
                                                                                <td style="overflow: hidden; padding: 2px 3px; vertical-align: middle;"></td>
                                                                            </tr>
                                                                            <tr style="height: 10px;">
                                                                                <td style="overflow: hidden; padding: 2px 3px; vertical-align: middle;"></td>
                                                                                <td style="overflow: hidden; padding: 2px 3px; vertical-align: bottom;"></td>
                                                                                <td style="overflow: hidden; padding: 2px 3px; vertical-align: bottom;"></td>
                                                                                <td style="border-bottom: 2px solid rgb(0, 0, 0); overflow: hidden; padding: 2px 3px; vertical-align: middle;"></td>
                                                                                <td style="border-bottom: 2px solid rgb(0, 0, 0); overflow: hidden; padding: 2px 3px; vertical-align: middle;"></td>
                                                                                <td style="border-bottom: 2px solid rgb(0, 0, 0); overflow: hidden; padding: 2px 3px; vertical-align: middle;"></td>
                                                                                <td style="overflow: hidden; padding: 2px 3px; vertical-align: middle;"></td>
                                                                            </tr>
                                                                            <tr style="height: 10px;">
                                                                                <td style="overflow: hidden; padding: 2px 3px; vertical-align: middle;"></td>
                                                                                <td style="overflow: hidden; padding: 2px 3px; vertical-align: bottom;"></td>
                                                                                <td style="overflow: hidden; padding: 2px 3px; vertical-align: bottom;"></td>
                                                                                <td style="overflow: hidden; padding: 2px 3px; vertical-align: middle;"></td>
                                                                                <td style="overflow: hidden; padding: 2px 3px; vertical-align: middle;"></td>
                                                                                <td style="overflow: hidden; padding: 2px 3px; vertical-align: middle;"></td>
                                                                                <td style="overflow: hidden; padding: 2px 3px; vertical-align: middle;"></td>
                                                                            </tr>
                                                                            <tr style="height: 22px;">
                                                                                <td style="overflow: hidden; padding: 2px 3px; vertical-align: middle;"></td>
                                                                                <td style="overflow: hidden; padding: 2px 3px; vertical-align: bottom;"></td>
                                                                                <td style="border-right: 1px solid transparent; overflow: visible; padding: 2px 0px; vertical-align: bottom; font-family: 'Noto Sans KR'; font-size: 9pt; color: rgb(102, 102, 102);">
                                                                                <div style="text-wrap: nowrap; overflow: hidden; width: 357px; left: 3px;">
                                                                                <div style="float: left;">서울시 마포구 동교로 18길 20. 마인드포레스트</div>
                                                                                </div>
                                                                                </td>
                                                                                <td style="overflow: hidden; padding: 2px 3px; vertical-align: bottom;"></td>
                                                                                <td style="overflow: hidden; padding: 2px 3px; vertical-align: bottom;"></td>
                                                                                <td style="overflow: hidden; padding: 2px 3px; vertical-align: middle; background-color: rgb(205, 207, 225); font-family: 'Noto Sans KR'; font-size: 9pt; font-weight: bold;" rowspan="1" colspan="2">결제하실 금액</td>
                                                                                <td style="overflow: hidden; padding: 2px 3px; vertical-align: middle; background-color: rgb(205, 207, 225); font-family: 'Noto Sans KR'; font-size: 9pt; text-align: right;">${finalPayment.toLocaleString()}</td>
                                                                                <td style="overflow: hidden; padding: 2px 3px; vertical-align: middle;"></td>
                                                                            </tr>
                                                                            <tr style="height: 22px;">
                                                                            <td style="overflow: hidden; padding: 2px 3px; vertical-align: middle;"></td>
                                                                            <td style="overflow: hidden; padding: 2px 3px; vertical-align: bottom;"></td>
                                                                            <td style="border-right: 1px solid transparent; overflow: visible; padding: 2px 0px; vertical-align: bottom; font-family: 'Noto Sans KR'; font-size: 9pt; color: rgb(102, 102, 102);">
                                                                            <div style="text-wrap: nowrap; overflow: hidden; width: 357px; left: 3px;">
                                                                            <div style="float: left;">02-336-7133 | inpsyt@inpsyt.co.kr</div>
                                                                            </div>
                                                                            </td>
                                                                            <td style="border-right: 1px solid transparent; overflow: hidden; padding: 2px 3px; vertical-align: bottom;"></td>
                                                                            <td style="overflow: hidden; padding: 2px 3px; vertical-align: bottom;"></td>
                                                                            <td style="overflow: hidden; padding: 2px 3px; vertical-align: middle;"></td>
                                                                            <td style="overflow: hidden; padding: 2px 3px; vertical-align: middle;"></td>
                                                                            <td style="overflow: hidden; padding: 2px 3px; vertical-align: middle;"></td>
                                                                            <td style="overflow: hidden; padding: 2px 3px; vertical-align: middle; font-family: 'Noto Sans KR'; font-size: 9pt; font-weight: bold; text-align: center;"></td>
                                                                            </tr>
                                                                            <tr style="height: 15px;">
                                                                            <td style="overflow: hidden; padding: 2px 3px; vertical-align: middle;"></td>
                                                                            <td style="overflow: hidden; padding: 2px 3px; vertical-align: middle;"></td>
                                                                            <td style="border-right: 1px solid transparent; overflow: visible; padding: 2px 0px; vertical-align: bottom; font-family: 'Noto Sans KR'; font-size: 9pt; color: rgb(102, 102, 102);">
                                                                            <div style="text-wrap: nowrap; overflow: hidden; width: 226px; left: 3px;">
                                                                            <div style="float: left;"></div>
                                                                            </div>
                                                                            </td>
                                                                            <td style="overflow: hidden; padding: 2px 3px; vertical-align: bottom;"></td>
                                                                            <td style="overflow: hidden; padding: 2px 3px; vertical-align: bottom;"></td>
                                                                            <td style="overflow: hidden; padding: 2px 3px; vertical-align: middle;"></td>
                                                                            <td style="overflow: hidden; padding: 2px 3px; vertical-align: middle;"></td>
                                                                            <td style="overflow: hidden; padding: 2px 3px; vertical-align: middle;"></td>
                                                                            <td style="overflow: hidden; padding: 2px 3px; vertical-align: middle;"></td>
                                                                            </tr>
                                                                            <tr style="height: 22px;">
                                                                            <td style="overflow: hidden; padding: 2px 3px; vertical-align: middle;"></td>
                                                                            <td style="overflow: hidden; padding: 2px 3px; vertical-align: middle;"></td>
                                                                            <td style="border-right: 1px solid transparent; overflow: visible; padding: 2px 0px; vertical-align: bottom; font-family: 'Noto Sans KR'; font-size: 8pt; color: rgb(102, 102, 102);">
                                                                            <div style="text-wrap: nowrap; overflow: hidden; width: 226px; left: 3px;">
                                                                            <div style="float: left;">* 출고는 1~2영업일 뒤에 진행됩니다.</div>
                                                                            </div>
                                                                            </td>
                                                                            <td style="overflow: hidden; padding: 2px 3px; vertical-align: bottom;"></td>
                                                                            <td style="overflow: hidden; padding: 2px 3px; vertical-align: bottom;"></td>
                                                                            <td style="overflow: hidden; padding: 2px 3px; vertical-align: middle;"></td>
                                                                            <td style="overflow: hidden; padding: 2px 3px; vertical-align: middle;"></td>
                                                                            <td style="overflow: hidden; padding: 2px 3px; vertical-align: middle;"></td>
                                                                            <td style="overflow: hidden; padding: 2px 3px; vertical-align: middle;"></td>
                                                                            </tr>
                                                                            <tr style="height: 22px;">
                                                                            <td style="overflow: hidden; padding: 2px 3px; vertical-align: middle;"></td>
                                                                            <td style="overflow: hidden; padding: 2px 3px; vertical-align: middle;"></td>
                                                                            <td style="border-right: 1px solid transparent; overflow: visible; padding: 2px 0px; vertical-align: bottom; font-family: 'Noto Sans KR'; font-size: 8pt; color: rgb(102, 102, 102);">
                                                                            <div style="text-wrap: nowrap; overflow: hidden; width: 226px; left: 3px;">
                                                                            <div style="float: left;">* 택배는 로젠택배를 사용합니다.</div>
                                                                            </div>
                                                                            </td>
                                                                            <td style="overflow: hidden; padding: 2px 3px; vertical-align: bottom;"></td>
                                                                            <td style="overflow: hidden; padding: 2px 3px; vertical-align: bottom;"></td>
                                                                            <td style="overflow: hidden; padding: 2px 3px; vertical-align: middle;"></td>
                                                                            <td style="overflow: hidden; padding: 2px 3px; vertical-align: middle;"></td>
                                                                            <td style="overflow: hidden; padding: 2px 3px; vertical-align: middle;"></td>
                                                                            <td style="overflow: hidden; padding: 2px 3px; vertical-align: middle;"></td>
                                                                            </tr>
                                                                            <tr style="height: 22px;">
                                                                            <td style="overflow: hidden; padding: 2px 3px; vertical-align: bottom;"></td>
                                                                            <td style="overflow: hidden; padding: 2px 3px; vertical-align: middle;"></td>
                                                                            <td style="border-right: 1px solid transparent; overflow: visible; padding: 2px 0px; vertical-align: bottom; font-family: 'Noto Sans KR'; font-size: 8pt; color: rgb(102, 102, 102);">
                                                                            <div style="text-wrap: nowrap; overflow: hidden; width: 226px; left: 3px;">
                                                                            <div style="float: left;">* 홈페이지에서 언제든 구매 가능합니다.</div>
                                                                            </div>
                                                                            </td>
                                                                            <td style="overflow: hidden; padding: 2px 3px; vertical-align: bottom;"></td>
                                                                            <td style="overflow: hidden; padding: 2px 3px; vertical-align: bottom;"></td>
                                                                            <td style="overflow: hidden; padding: 2px 3px; vertical-align: bottom;"></td>
                                                                            <td style="overflow: hidden; padding: 2px 3px; vertical-align: bottom;"></td>
                                                                            <td style="overflow: hidden; padding: 2px 3px; vertical-align: bottom;"></td>
                                                                            <td style="overflow: hidden; padding: 2px 3px; vertical-align: middle;"></td>
                                                                            </tr>
                                                                            <tr style="height: 22px;">
                                                                            <td style="overflow: hidden; padding: 2px 3px; vertical-align: bottom;"></td>
                                                                            <td style="overflow: hidden; padding: 2px 3px; vertical-align: middle;"></td>
                                                                            <td style="overflow: hidden; padding: 2px 3px; vertical-align: bottom;"></td>
                                                                            <td style="overflow: hidden; padding: 2px 3px; vertical-align: bottom;"></td>
                                                                            <td style="overflow: hidden; padding: 2px 3px; vertical-align: bottom;"></td>
                                                                            <td style="overflow: hidden; padding: 2px 3px; vertical-align: bottom;"></td>
                                                                            <td style="overflow: hidden; padding: 2px 3px; vertical-align: bottom;"></td>
                                                                            <td style="overflow: hidden; padding: 2px 3px; vertical-align: bottom;"></td>
                                                                            <td style="overflow: hidden; padding: 2px 3px; vertical-align: middle;"></td>
                                                                            </tr>
                                                                        </tbody>
                                                                    </table>
                                                                </div>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                </tbody>
                                            </table>
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    -->
                        <div>
                            <table class="m_-6189926572285943684stb-block" border="0" cellpadding="0" cellspacing="0" style="overflow:hidden;margin:0px auto;padding:0px;width:100%;max-width:630px;clear:both;line-height:1.7;border-width:0px;border:0px;font-size:14px;border:0;box-sizing:border-box" width="100%">
                              <tbody>
                                <tr>
                                  <td>
                                    <table border="0" cellpadding="0" cellspacing="0" width="100%">
                                      <tbody>
                                        <tr>
                                          <td style="text-align:center;font-size:0">
                                            <table border="0" cellpadding="0" cellspacing="0" align="left" width="100%">
                                              <tbody>
                                                <tr>
                                                  <td style="padding:0px 0px 25px 0px;border:0">
                                                    <table style="width:100%;height:0;background:none;padding:0px;border-top-width:1px;border-top-style:solid;border-top-color:#000000;margin:0 0;border-collapse:separate"></table>
                                                  </td>
                                                </tr>
                                              </tbody>
                                            </table>
                                          </td>
                                        </tr>
                                      </tbody>
                                    </table>
                                  </td>
                                </tr>
                              </tbody>
                            </table>
                          </div>
                          <div>
                            <table class="m_-6189926572285943684stb-block" border="0" cellpadding="0" cellspacing="0" style="overflow:hidden;margin:0px auto;padding:0px;width:100%;max-width:630px;clear:both;line-height:1.7;border-width:0px;border:0px;font-size:14px;border:0;box-sizing:border-box" width="100%">
                                <tbody>
                                    <tr>
                                        <td>
                                            <table border="0" cellpadding="0" cellspacing="0" width="100%">
                                                <tbody>
                                                    <tr>
                                                        <td style="text-align:center;font-size:0">
                                                            <table class="m_-6189926572285943684stb-cell" border="0" cellpadding="0" cellspacing="0" style="max-width:630px;width:100%!important;margin:0;vertical-align:middle;border-collapse:collapse;box-sizing:border-box;font-size:unset" align="left" width="100%">
                                                                <tbody>
                                                                    <tr>
                                                                        <td style="padding:0 0;text-align:center;margin:0px;line-height:1.7;word-break:break-word;font-size:16px;font-family: 'Noto Sans KR', sans-serif;color:#747579;border:0; vertical-align:middle;">
                                                                            <table border="0" cellpadding="0" cellspacing="0" style="width:100%; height:100%;">
                                                                                <tbody>
                                                                                    <!-- 이미지가 먼저 표시되도록 순서 변경 -->
                                                                                    <tr>
                                                                                        <td style="vertical-align: middle; text-align: center;">
                                                                                            <div style="max-height: 64px;">
                                                                                                <a href="http://inpsyt.co.kr/main" target="_blank">
                                                                                                    <img src="https://github.com/nuuxixv/inpsytmm/raw/488a2a258d17599a174e261e3afcf5f5f9d0221a/bottom.png" width="140" height="40">
                                                                                                </a>
                                                                                            </div>
                                                                                        </td>
                                                                                    </tr>
                                                                                    <!-- "인싸이트는 신뢰를~" 문장이 이미지 아래로 이동 -->
                                                                                    <tr>
                                                                                        <td style="vertical-align: middle; text-align: center; padding-top: 15px;">
                                                                                            <div style="text-align:center">
                                                                                                <span style="color:#000000"><span style="font-weight:bold">인싸이트는 신뢰를 최우선의 가치로 생각합니다. </span></span>
                                                                                            </div>
                                                                                        </td>
                                                                                    </tr>
                                                                                    <tr>
                                                                                        <td style="vertical-align: middle; text-align: center; padding-top: 15px;">
                                                                                            <div style="text-align:center">
                                                                                                <span style="color:#000000;font-size:12px">발행인 : (주)인싸이트 심리검사연구소</span><br>
                                                                                                <span style="font-size:12px;color:#000000">
                                                                                                    <a href="mailto:inpsyt@inpsyt.co.kr" style="font-family:'Noto Sans KR', sans-serif;color:rgb(0,0,0);padding:0px;text-align:left;line-height:1.7;font-weight:bold;text-decoration:underline" target="_blank">
                                                                                                        inpsyt@inpsyt.co.kr
                                                                                                    </a><br>
                                                                                                    <span style="color:#000000;font-size:12px">대표전화: 02-336-7133</span><br>
                                                                                                </span>
                                                                                            </div>
                                                                                        </td>
                                                                                    </tr>
                                                                                </tbody>
                                                                            </table>
                                                                        </td>
                                                                    </tr>
                                                                </tbody>
                                                            </table>
                                                        </td>
                                                    </tr>
                                                </tbody>
                                            </table>
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                        
                          <div>
                            <table class="m_-6189926572285943684stb-block" border="0" cellpadding="0" cellspacing="0" style="overflow:hidden;margin:0px auto;padding:0px;width:100%;max-width:630px;clear:both;line-height:1.7;border-width:0px;border:0px;font-size:14px;border:0;box-sizing:border-box" width="100%">
                              <tbody>
                                <tr>
                                  <td>
                                    <table border="0" cellpadding="0" cellspacing="0" width="100%">
                                      <tbody>
                                        <tr>
                                          <td style="text-align:center;font-size:0">
                                            <table class="m_-6189926572285943684stb-cell" border="0" cellpadding="0" cellspacing="0" style="max-width:630px;width:100%!important;margin:0;vertical-align:top;border-collapse:collapse;box-sizing:border-box;font-size:unset" align="left" width="100%">
                                              <tbody>
                                                <tr>
                                                  <td style="padding:0 0;text-align:center;margin:0px;line-height:1.7;word-break:break-word;font-size:12px;font-family:AppleSDGothic,apple sd gothic neo,noto sans korean,noto sans korean regular,noto sans cjk kr,noto sans cjk,nanum gothic,malgun gothic,dotum,arial,helvetica,MS Gothic,sans-serif!important;color:#747579;border:0">
                                                    <table border="0" cellpadding="0" cellspacing="0" style="width:100%">
                                               
                                                    </table>
                                                  </td>
                                                </tr>
                                              </tbody>
                                            </table>
                                          </td>
                                        </tr>
                                      </tbody>
                                    </table>
                                  </td>
                                </tr>
                              </tbody>
                            </table>
                          </div>
                    </td>
                </tr>
            </tbody>
        </table>
    </div>
</div>
</div>

</body></html>`;

    // Resend API 호출
    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "onboarding@resend.dev", // Resend 테스트 도메인 사용
        to: customerEmail,
        subject: `[인싸이트] 주문이 성공적으로 접수되었습니다. (주문번호: ${orderId})`,
        html: emailBody,
      }),
    });

    if (!resendResponse.ok) {
      const errorData = await resendResponse.json();
      console.error("Resend API Error:", errorData);
      return new Response(JSON.stringify({ error: "Failed to send email", details: errorData }), { status: 500 });
    }

    const data = await resendResponse.json();
    console.log("Email sent successfully:", data);

    return new Response(JSON.stringify({ message: "Email sent successfully", data }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("Edge Function Error:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
});