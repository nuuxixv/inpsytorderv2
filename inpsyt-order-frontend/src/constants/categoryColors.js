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
//
// 키 체계:
//   - 영문 키(book/test/tool): 데이터 모델·시안 코드의 정식 키
//   - 한글 라벨('도서'/'검사'/'도구') → 영문 키 역매핑은 CATEGORY_KEY_BY_LABEL로 제공
//     (실 페이지 product.category가 한글로 저장되어 있어 룩업 필요)

export const CATEGORY_COLORS = {
  book: '#3B82F6', // category-book — 도서 (출고 시안 채택값)
  test: '#6366F1', // category-test — 검사 (출고 시안 채택값)
  tool: '#6B7684', // category-tool — 도구 (회색 계열, 실 페이지 grey[600] 정합. Appendix §2-1)
};

export const CATEGORY_LABELS = {
  book: '도서',
  test: '검사',
  tool: '도구',
};

// 한글 라벨 → 영문 키 역매핑. 실 페이지(ProductManagementPage)는 product.category를
// 한글로 저장·필터링하므로, 색 토큰을 가져올 때 이 역매핑이 필요하다.
export const CATEGORY_KEY_BY_LABEL = Object.fromEntries(
  Object.entries(CATEGORY_LABELS).map(([key, label]) => [label, key])
);
