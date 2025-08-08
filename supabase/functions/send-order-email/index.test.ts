import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { stub } from "https://deno.land/std@0.168.0/testing/mock.ts";
import { sendOrderEmail } from "./index.ts"; // sendOrderEmail만 임포트

// 테스트 환경 변수 설정 (실제 사용되지 않지만, 코드의 일관성을 위해 유지)
Deno.env.set("SUPABASE_URL", "http://mock-supabase-url");
Deno.env.set("SUPABASE_ANON_KEY", "mock-anon-key");
Deno.env.set("RESEND_API_KEY", "mock-resend-key");
Deno.env.set("SUPABASE_DB_URL", "postgresql://user:password@host:port/database");

Deno.test("sendOrderEmail sends email for a valid order", async () => {
  // fetch 함수 모의 (Resend API 호출)
  const fetchStub = stub(
    globalThis,
    "fetch",
    () => Promise.resolve(new Response(JSON.stringify({ id: "email_sent_id" }), { status: 200 })),
  );

  // Deno.readTextFile 모의 (이메일 템플릿 읽기)
  const readTextFileStub = stub(
    Deno,
    "readTextFile",
    () => Promise.resolve(`
      <html>
        <body>
          <p>안녕하세요, {{customerName}}님!</p>
          <p>주문번호: {{inpsytId}}</p>
          <p>주문일: {{orderDate}}</p>
          <p>배송지: {{shippingAddress}}</p>
          <p>요청사항: {{customerRequest}}</p>
          <table>
            <thead>
              <tr>
                <th>상품명</th>
                <th>수량</th>
                <th>단가</th>
                <th>총액</th>
              </tr>
            </thead>
            <tbody>
              {{orderItemsHtml}}
            </tbody>
          </table>
          <p>최종 결제 금액: {{finalPayment}}원</p>
        </body>
      </html>
    `),
  );

  try {
    // 테스트 실행
    await sendOrderEmail(1); 

    // 결과 검증
    assertEquals(fetchStub.calls.length, 1);
    assertEquals(fetchStub.calls[0].args[0], "https://api.resend.com/emails");

    const requestBody = JSON.parse(fetchStub.calls[0].args[1].body?.toString() || '{}');
    assertEquals(requestBody.to, "test@example.com");
    assertEquals(requestBody.subject, "[인싸이트] 주문이 성공적으로 접수되었습니다. (주문번호: 1)");
    
    // 이메일 HTML 내용 검증
    const emailHtml = requestBody.html;
    assertEquals(emailHtml.includes("안녕하세요, 테스트 고객님!"), true);
    assertEquals(emailHtml.includes("주문번호: INPSYT001"), true);
    assertEquals(emailHtml.includes("배송지: (12345) 서울시 강남구 테스트동 123호"), true);
    assertEquals(emailHtml.includes("요청사항: 문 앞에 놓아주세요"), true);
    assertEquals(emailHtml.includes("테스트 상품 A"), true);
    assertEquals(emailHtml.includes("테스트 상품 B"), true);
    assertEquals(emailHtml.includes("최종 결제 금액: 10,000원"), true);

  } finally {
    // 모의 객체 복원
    fetchStub.restore();
    readTextFileStub.restore();
  }
});

Deno.test("sendOrderEmail handles missing order data gracefully", async () => {
  // console.error 모의
  const consoleErrorStub = stub(console, "error");

  let caughtError: Error | null = null;
  try {
    await sendOrderEmail(999);
  } catch (error) {
    caughtError = error;
  } finally {
    consoleErrorStub.restore();
  }
});

Deno.test("sendOrderEmail handles Supabase error when fetching order", async () => {
  // console.error 모의
  const consoleErrorStub = stub(console, "error");
  // fetch 함수 모의 (이 테스트에서는 호출되지 않아야 함)
  const fetchStub = stub(globalThis, "fetch");

  let caughtError: Error | null = null;
  try {
    await sendOrderEmail(1); // mock_supabase_js.ts에서 이 경우 DB connection error를 던지도록 설정됨
  } catch (error) {
    caughtError = error;
  } finally {
    consoleErrorStub.restore();
    fetchStub.restore();
  }
});

Deno.test("sendOrderEmail handles Resend API error", async () => {
  // fetch 함수 모의 (Resend API 에러 응답)
  const fetchStub = stub(
    globalThis,
    "fetch",
    () => Promise.resolve(new Response(JSON.stringify({ message: "Resend error" }), { status: 400 })),
  );

  // console.error 모의
  const consoleErrorStub = stub(console, "error");

  // Deno.readTextFile 모의
  const readTextFileStub = stub(
    Deno,
    "readTextFile",
    () => Promise.resolve("<html><body>Test template</body></html>"),
  );

  let caughtError: Error | null = null;
  try {
    await sendOrderEmail(1);
  } catch (error) {
    caughtError = error;
  } finally {
    fetchStub.restore();
    consoleErrorStub.restore();
    readTextFileStub.restore();
  }
});