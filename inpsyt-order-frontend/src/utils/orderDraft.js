// 고객 주문서 임시 보존 — 부스 회선 불안정 환경에서 새로고침·탭 퇴출 시 진행 내용 유실 방지.
//
// 저장소 = sessionStorage(탭 생명주기)로 한정한다. localStorage 금지:
// 부스 공용 태블릿에서 다음 고객에게 이전 고객의 연락처(customerInfo)가 남으면 안 되기 때문.
// 따라서 여기 복원되는 customerInfo·cart·activeStep은 "같은 탭 안에서만" 유효하다 —
// 탭을 닫으면 sessionStorage가 비워져 다음 고객에게 전 고객 정보가 넘어가지 않는다.
//
// 키에 행사 slug를 포함해 행사별로 분리한다(다른 행사 주문서에 이전 카트가 새면 안 됨).
// 파싱 실패·구버전 스키마(v 불일치)는 조용히 무시하고 빈 상태로 시작한다.

export const DEFAULT_CUSTOMER_INFO = {
  name: '', phone: '', postcode: '',
  address: '', detailAddress: '', inpsytId: '', request: '',
};

const SCHEMA_VERSION = 1;
const keyFor = (slug) => `inpsyt:orderDraft:${slug}`;

const hasCustomerInput = (info) => Object.values(info || {}).some(Boolean);

export const loadOrderDraft = (slug) => {
  if (!slug) return null;
  try {
    const raw = sessionStorage.getItem(keyFor(slug));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || parsed.v !== SCHEMA_VERSION || !Array.isArray(parsed.cart)) return null;

    const cart = parsed.cart.filter(item => item && item.id);
    const customerInfo = { ...DEFAULT_CUSTOMER_INFO, ...(parsed.customerInfo || {}) };
    // step 1·2는 담긴 상품이 전제 — 카트가 비면 상품 선택(0)부터 다시 시작.
    let activeStep = Number.isInteger(parsed.activeStep) ? parsed.activeStep : 0;
    if (cart.length === 0) activeStep = 0;
    if (activeStep < 0 || activeStep > 2) activeStep = 0;

    return { cart, customerInfo, activeStep };
  } catch {
    return null;
  }
};

export const saveOrderDraft = (slug, { cart = [], customerInfo = {}, activeStep = 0 } = {}) => {
  if (!slug) return;
  try {
    const meaningful = cart.length > 0 || activeStep > 0 || hasCustomerInput(customerInfo);
    if (!meaningful) {
      sessionStorage.removeItem(keyFor(slug));
      return;
    }
    sessionStorage.setItem(
      keyFor(slug),
      JSON.stringify({ v: SCHEMA_VERSION, cart, customerInfo, activeStep }),
    );
  } catch {
    // 용량 초과·프라이빗 모드 등 — 임시저장은 보조 안전망이라 조용히 무시.
  }
};

export const clearOrderDraft = (slug) => {
  if (!slug) return;
  try {
    sessionStorage.removeItem(keyFor(slug));
  } catch {
    // ignore
  }
};
