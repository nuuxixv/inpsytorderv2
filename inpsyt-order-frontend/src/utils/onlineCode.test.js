import { describe, it, expect } from 'vitest';
import { hasOnlineCode, itemHasOnlineCode, orderHasOnlineCode } from './onlineCode';

// 판정은 3상태(includes_online_code)를 존중한다 — 단순 OR 아님.
// true=포함 / false=미포함(문자열 폴백 차단) / null·undefined=상품명 폴백.
describe('hasOnlineCode — 3상태 판정 (false는 문자열보다 강하다)', () => {
  it('#1 플래그 true → true (이름 무관)', () => {
    expect(hasOnlineCode([{ includes_online_code: true, name: 'ADI-R SET(1)' }])).toBe(true);
  });

  it('#2 플래그 false인데 이름에 "온라인" → false (핵심 정정: 오탐 차단)', () => {
    // 도서 "온라인상담개론"은 온라인코드와 무관. false가 문자열 폴백을 끊는다.
    // 단순 OR이면 true가 되어 실패한다.
    expect(hasOnlineCode([{ includes_online_code: false, name: '온라인상담개론(김환)' }])).toBe(false);
  });

  it('#3 플래그 null + 이름 매칭 → true (미확인 → 문자열 폴백)', () => {
    expect(hasOnlineCode([{ includes_online_code: null, name: 'K-WISC-V 온라인코드(10)' }])).toBe(true);
  });

  it('#4 플래그 undefined(컬럼 미적용) + 이름 매칭 → true (기존 432개 무회귀)', () => {
    expect(hasOnlineCode([{ includes_online_code: undefined, name: '...온라인코드(15)' }])).toBe(true);
    expect(hasOnlineCode([{ name: '온라인 이용권' }])).toBe(true); // 키 자체가 없어도 폴백
  });

  it('#5 플래그 null + 이름 미매칭 → false (미확인·미감지, 씨딩으로 해소될 몫)', () => {
    expect(hasOnlineCode([{ includes_online_code: null, name: 'BASA:R SET(1)' }])).toBe(false);
  });

  it('#6 빈 배열 → false', () => {
    expect(hasOnlineCode([])).toBe(false);
  });

  it('null/undefined 입력 → false (방어)', () => {
    expect(hasOnlineCode(null)).toBe(false);
    expect(hasOnlineCode(undefined)).toBe(false);
  });

  it('여러 품목 중 하나만 온라인코드여도 → true', () => {
    expect(hasOnlineCode([
      { name: '지필 검사지' },
      { includes_online_code: true, name: 'SET 상품' },
    ])).toBe(true);
  });

  it('false 확정 품목 + 미확인 매칭 품목 혼재 → true (미확인 품목이 살림)', () => {
    expect(hasOnlineCode([
      { includes_online_code: false, name: '온라인상담개론(김환)' },
      { includes_online_code: null, name: 'K-WISC-V 온라인코드(10)' },
    ])).toBe(true);
  });

  it('죽은 조건 검증 — category="온라인코드"만으로는 매칭 안 됨(제거된 조건)', () => {
    expect(hasOnlineCode([{ name: '검사지', category: '온라인코드' }])).toBe(false);
  });
});

describe('itemHasOnlineCode — 출고 스냅샷은 product_name 필드 사용', () => {
  it('order_items 스냅샷(product_name)에 "온라인" → true (플래그 없음=미확인 폴백)', () => {
    expect(itemHasOnlineCode({ product_name: '온라인코드 세트' })).toBe(true);
  });

  it('order_items 스냅샷 플래그 true → true', () => {
    expect(itemHasOnlineCode({ product_name: 'SET', includes_online_code: true })).toBe(true);
  });

  it('플래그 false면 product_name 매칭이어도 false', () => {
    expect(itemHasOnlineCode({ product_name: '온라인상담개론', includes_online_code: false })).toBe(false);
  });

  it('필드 없음 → false', () => {
    expect(itemHasOnlineCode({})).toBe(false);
  });
});

describe('orderHasOnlineCode — 컬럼 우선, 없으면 스냅샷 폴백', () => {
  it('has_online_code=true 컬럼 우선 → true (아이템 무관)', () => {
    expect(orderHasOnlineCode({ has_online_code: true, order_items: [{ product_name: '검사지' }] })).toBe(true);
  });

  it('has_online_code=false 컬럼 우선 신뢰 → false (아이템 이름 매칭 무시)', () => {
    expect(orderHasOnlineCode({ has_online_code: false, order_items: [{ product_name: '온라인' }] })).toBe(false);
  });

  it('컬럼 없음 → order_items 스냅샷으로 폴백(true)', () => {
    expect(orderHasOnlineCode({ order_items: [{ product_name: '온라인 이용권' }] })).toBe(true);
  });

  it('컬럼 없음 + mergedItems 우선 사용(합배송 병합 아이템)', () => {
    expect(orderHasOnlineCode({ mergedItems: [{ product_name: 'SET', includes_online_code: true }], order_items: [] })).toBe(true);
  });

  it('컬럼 없음 + 아이템 미매칭 → false', () => {
    expect(orderHasOnlineCode({ order_items: [{ product_name: '지필 검사지' }] })).toBe(false);
  });
});
