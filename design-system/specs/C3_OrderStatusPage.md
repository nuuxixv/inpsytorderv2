# 사양 시트 — C3 고객 주문 상태 (OrderStatusPage)

> 이 시트는 고객 주문 상태 화면의 정보·기능·데이터 구조의 단일 진실 소스다.
> 시안과 실서비스 구현은 이 시트의 모든 항목을 1:1로 반영해야 한다.
> 임의 단순화·통합·생략은 건우님의 명시적 승인 후 이 시트를 먼저 갱신한 다음에만 허용된다.
> 마지막 갱신: 2026-05-13 신설 (M2 시안 착수 사전 정독).

## 참조 파일
- 실 컴포넌트: `inpsyt-order-frontend/src/components/OrderStatusPage.jsx` (297줄, 단일 파일 + 내부 보조 컴포넌트 `SectionTitle`·`ItemsCard`)
- 진입 라우트: `inpsyt-order-frontend/src/App.jsx:49` — `<Route path="/order/status/:token" element={<OrderStatusPage />} />`
- 진입 트리거:
  - C1 주문 제출 직후 `OrderPage.jsx:193` — `navigate('/order/status/${token}')`
  - 어드민 OrderDetailModal `OrderDetailModal.jsx:352` — `href` 링크
  - 카카오 알림톡 본문 — `inpsyt-order-frontend/src/api/alimtalk.js:30`이 `${FRONTEND_URL}/order/status/${order.access_token}` 형태로 박는 URL
- 상태 상수: `inpsyt-order-frontend/src/constants/orderStatus.js` (`STATUS_COLORS` — 라벨은 이 페이지에서 자체 매핑)
- DB RPC: `supabase/migrations/20260415_004_update_order_functions.sql` (현행본) + `20260407_rls_token_based_access.sql` (원본) — `get_order_by_token(p_token uuid) RETURNS json`, `SECURITY DEFINER`, anon·authenticated 모두 EXECUTE 권한 부여
- DB 스키마: C1 시트 참조 (`orders`, `order_items`, `events`, `products`)

## 사용자 시나리오
주문 제출 직후 자동 리다이렉트되거나, 결제 완료 후 받은 카카오 알림톡(`status='paid'` 트리거 발화)의 URL을 탭해서 들어오는 화면이다. 토큰 한 개만 알면 누구나 접근 가능하지만 토큰이 UUID라 추측 불가. 1차 사용자는 50대 의사가 부스에서 결제 직후, 또는 학회가 끝나고 며칠 뒤 알림톡으로 진입. 화면 한 장에 "지금 어떤 상태인지·언제 받을지·뭘 샀는지·얼마 냈는지" 를 압축해 보여준다. 추가 액션은 없음 — 보기 전용 화면이다. 합배송된 부모/자식 주문은 한 화면에 1차/2차로 통합 표시한다.

## 진입 흐름
- [ ] URL 파라미터 `token` 추출 (`useParams`, `OrderStatusPage.jsx:72`)
- [ ] `token`이 있으면 `supabase.rpc('get_order_by_token', { p_token: token })` 호출 (`fetchOrder`, line 78-102)
- [ ] RPC 응답 데이터가 있으면 `setOrder(data)` 후 연계 주문 처리:
  - `data.parent_order` 있으면 `linkedOrder = { role: 'parent', ...data.parent_order }`
  - 없고 `data.child_orders?.length > 0` 이면 `linkedOrder = { role: 'child', ...data.child_orders[0] }` (첫 번째 child만)
- [ ] RPC가 데이터 없음(`!data`) 또는 에러(`rpcError`) 시 `setError('주문을 찾을 수 없습니다.')` (line 95-97 catch는 모든 예외를 동일 메시지로 흡수)
- [ ] `token` 자체가 falsy면 `fetchOrder` 자체를 호출하지 않음 (line 101) — 이 경우 로딩 스피너만 계속 도는 상태가 되므로 **확인 필요** (실제로는 `/order/status/:token` 라우트가 token 없는 경로를 매칭하지 않으므로 도달 어려움)

### 토큰 기반 접근 제어 (RLS·RPC 구조)
- [ ] `get_order_by_token`은 `SECURITY DEFINER`로 RLS 우회 — anon 사용자도 토큰 한 개만 알면 1행만 조회 가능
- [ ] `access_token`은 UUID(`gen_random_uuid()`, `20260406_add_access_token_to_orders.sql`) — 순차 ID 노출 방지가 도입 이유
- [ ] 만료 개념 없음 — 토큰은 한 번 발급되면 계속 유효. 학회 종료 후에도 접근 가능
- [ ] 잘못된 토큰(존재하지 않는 UUID): RPC가 null 반환 → "주문을 찾을 수 없습니다" 화면
- [ ] 형식 오류 토큰(UUID 아닌 문자열): Supabase가 `rpcError` 반환 → 동일하게 catch 흡수 → 동일 화면
