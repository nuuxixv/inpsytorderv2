// 카테고리 색 토큰 — design-system Appendix §2-1 / 08 D17 정식 등재값.
//
// status 색(주문 상태)과 의미가 다르다:
//   - status : "이 주문이 어떤 상태인가" (filled 칩)
//   - category: "이 상품이 어떤 종류인가" (outlined 칩)
// category-test(#6366F1)는 status-completed와 헥사가 같으므로, 같은 화면 공존 시
// 형태(category=outlined / status=filled)로 구분한다.
//
// theme.js(글로벌)를 건드리지 않고 D17 토큰을 코드 단일 소스로 격리하기 위한 모듈.
// 시안·컴포넌트는 raw hex 대신 이 토큰을 호출한다(02 §운영 조항 1).

export const CATEGORY_COLORS = {
  book: '#3B82F6', // category-book — 도서
  test: '#6366F1', // category-test — 검사
};

export const CATEGORY_LABELS = {
  book: '도서',
  test: '검사',
};
