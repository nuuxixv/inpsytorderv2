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

// ─────────────────────────────────────────────
// 소분류·배지 마스터 색 프리셋 (A8 설정 화면 — 카테고리 동적화 PRD P1)
//
// 자유 hex 입력은 AA 대비·디자인 토큰 정합을 깨므로 금지(A8 §핵심 발견 10).
// 운영자는 아래 프리셋 중에서만 색을 고른다. 칩은 소프트 틴트(배경 alpha 0.12 +
// 진한 글자색)로 렌더 — C1 §배지 패턴 정합. 진한 값은 글자/보더에, 자체는 색 견본에 쓴다.
//
// 값은 theme.js 팔레트(primary/secondary/category/status accent)·gray 계열에서
// AA(흰 배경 위 글자 대비 4.5:1 이상 — 모두 충분히 진한 톤) 통과하는 색만 선별.
// 마스터 color 컬럼에는 이 hex 문자열이 저장된다(미등록·NULL은 기본 회색 폴백).
// ─────────────────────────────────────────────
export const MASTER_COLOR_PRESETS = [
  { value: '#2B398F', label: '남보라' }, // primary.main
  { value: '#3B82F6', label: '파랑' },   // category-book
  { value: '#6366F1', label: '인디고' }, // category-test
  { value: '#0764C7', label: '하늘' },   // info.dark
  { value: '#00A884', label: '초록' },   // success.dark
  { value: '#D97706', label: '주황' },   // warning.dark
  { value: '#D63031', label: '빨강' },   // error.dark
  { value: '#C026D3', label: '자주' },
  { value: '#6B7684', label: '회색' },   // category-tool / gray.600
];

// 마스터에 색이 없거나 미등록 라벨일 때의 기본 폴백 색(중립 회색).
export const MASTER_COLOR_FALLBACK = '#6B7684';
