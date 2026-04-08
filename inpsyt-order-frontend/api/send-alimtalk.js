import https from 'node:https';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL ?? 'https://qnrojyamcrvikbezkzwk.supabase.co';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY ?? '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
const SENDER_KEY = process.env.ONESHOT_SENDER_KEY ?? '799de9af7fd86b7301222f39715f012c33d8ed85';
const CALLBACK = process.env.VITE_ONESHOT_CALLBACK ?? process.env.ONESHOT_CALLBACK ?? '';
const FRONTEND_URL = process.env.VITE_APP_URL ?? 'https://inpsytorder.vercel.app';
const ENDPOINT = 'https://api2.msgagent.com/api/webshot/send/kakao/AT/inpsyt2';
const TEMPLATE_CODE = 'inpsytorder_paid1';

// msgagent.com은 구형 TLS 암호화 사용 → Node.js HTTPS agent에서 레거시 허용
const tlsAgent = new https.Agent({
  minVersion: 'TLSv1',
  ciphers: 'ALL:@SECLEVEL=0',
  rejectUnauthorized: false,
});

function buildMultipart(fields) {
  const boundary = '----Boundary' + Date.now().toString(16);
  const parts = Object.entries(fields).map(
    ([name, value]) =>
      `--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}`
  );
  return {
    body: parts.join('\r\n') + `\r\n--${boundary}--\r\n`,
    contentType: `multipart/form-data; boundary=${boundary}`,
  };
}

function httpsPost(urlStr, body, contentType) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlStr);
    const req = https.request(
      {
        hostname: url.hostname,
        path: url.pathname,
        method: 'POST',
        headers: {
          'Content-Type': contentType,
          'Content-Length': Buffer.byteLength(body),
        },
        agent: tlsAgent,
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => resolve({ status: res.statusCode, text: data }));
      }
    );
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    // JWT 검증
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (SUPABASE_ANON_KEY) {
      const supabaseAuth = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      const { data: authData, error: authError } = await supabaseAuth.auth.getUser(token);
      if (authError || !authData?.user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
    }

    const { order_id } = req.body ?? {};
    if (!order_id) {
      return res.status(400).json({ error: 'order_id is required' });
    }

    if (!SUPABASE_SERVICE_ROLE_KEY) {
      return res.status(503).json({ error: 'SUPABASE_SERVICE_ROLE_KEY 환경변수가 설정되지 않았습니다.' });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('id, customer_name, phone_number, is_on_site_sale, access_token, events(name)')
      .eq('id', order_id)
      .single();

    if (orderError || !order) {
      return res.status(404).json({ error: '주문을 찾을 수 없습니다.' });
    }

    if (order.is_on_site_sale) {
      return res.status(200).json({ skipped: true });
    }

    const phone = order.phone_number?.replace(/-/g, '') ?? '';
    if (!phone) {
      return res.status(400).json({ error: '수신자 연락처가 없습니다.' });
    }

    const name = order.customer_name ?? '';
    const eventName = order.events?.name ?? '';
    const statusUrl = `${FRONTEND_URL}/order/status/${order.access_token}`;
    const msg = `${name}님, 안녕하세요.\n${eventName}에서 결제가 완료되었습니다.\n\n주문 내역은 아래에서 확인하실 수 있습니다.`;

    const { body, contentType } = buildMultipart({
      id: 'inpsyt2',
      PHONE: phone,
      CALLBACK,
      MSG: msg,
      SENDER_KEY,
      TEMPLATE_CODE,
      BTN_TYPES: '웹링크',
      BTN_TXTS: '주문내역 확인하기',
      BTN_URLS1: statusUrl,
      BTN_URLS2: statusUrl,
      FAILED_TYPE: 'LMS',
      FAILED_MSG: `[인싸이트] ${name}님, ${eventName} 결제가 완료되었습니다. 주문 조회: ${statusUrl}`,
    });

    let apiResult;
    try {
      apiResult = await httpsPost(ENDPOINT, body, contentType);
    } catch (err) {
      console.error('msgagent fetch error:', err.message);
      return res.status(502).json({ error: err.message });
    }

    console.log('msgagent response:', apiResult.text);

    let resultCode;
    try {
      resultCode = JSON.parse(apiResult.text)?.result_code;
    } catch {}

    if (resultCode !== 0) {
      return res.status(502).json({ error: `원샷 result_code: ${resultCode}`, detail: apiResult.text });
    }

    await supabase
      .from('orders')
      .update({ alimtalk_sent_at: new Date().toISOString() })
      .eq('id', order_id);

    return res.status(200).json({ success: true });

  } catch (err) {
    console.error('send-alimtalk handler error:', err.message, err.stack);
    return res.status(500).json({ error: err.message });
  }
}
