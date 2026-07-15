import { describe, it, expect } from 'vitest';
import { buildOrderExcelRows } from './orderExcel';

const events = [{ id: 10, name: '2026 심리학회' }];
const productsMap = {
  1: { id: 1, name: '도서A', category: '도서' },
  2: { id: 2, name: '검사B', category: '검사' },
};

const baseOrder = {
  id: 501,
  created_at: '2026-07-15T10:00:00',
  customer_name: '김의사',
  phone_number: '010-1111-2222',
  shipping_address: { postcode: '12345', address: '서울 강남', detail: '3층' },
  customer_request: null,
  admin_memo: null,
  event_id: 10,
  final_payment: 30000,
  status: 'paid',
  order_items: [
    { product_id: 1, quantity: 2, price_at_purchase: 10000, product_name: '도서A', category: '도서' },
    { product_id: 2, quantity: 1, price_at_purchase: 20000, product_name: '검사B', category: '검사' },
  ],
};

describe('buildOrderExcelRows', () => {
  it("type='book'은 도서 아이템만 행 분해", () => {
    const rows = buildOrderExcelRows({ orders: [baseOrder], type: 'book', events, productsMap });
    expect(rows).toHaveLength(1);
    expect(rows[0]['상품명']).toBe('도서A');
    expect(rows[0]['카테고리']).toBe('도서');
  });

  it("type='test'은 검사 계열만", () => {
    const rows = buildOrderExcelRows({ orders: [baseOrder], type: 'test', events, productsMap });
    expect(rows).toHaveLength(1);
    expect(rows[0]['상품명']).toBe('검사B');
  });

  it("type='all'은 전체 아이템", () => {
    const rows = buildOrderExcelRows({ orders: [baseOrder], type: 'all', events, productsMap });
    expect(rows).toHaveLength(2);
  });

  it('컬럼 순서·값이 현행과 동일 (학회 미필터 시 학회명 포함)', () => {
    const rows = buildOrderExcelRows({ orders: [baseOrder], type: 'book', events, productsMap });
    expect(Object.keys(rows[0])).toEqual([
      '주문일시', '주문번호', '고객명', '연락처', '배송 주소',
      '고객 요청사항', '관리자 메모', '학회명', '카테고리', '상품명',
      '주문 수량', '실결제금액(참고)', '상태',
    ]);
    expect(rows[0]['배송 주소']).toBe('12345 서울 강남 3층');
    expect(rows[0]['고객 요청사항']).toBe('-');
    expect(rows[0]['상태']).toBe('결제완료');
    expect(rows[0]['학회명']).toBe('2026 심리학회');
  });

  it('eventFilterName이 있으면 학회명 컬럼 생략', () => {
    const rows = buildOrderExcelRows({ orders: [baseOrder], type: 'all', events, productsMap, eventFilterName: '2026 심리학회' });
    expect(Object.keys(rows[0])).not.toContain('학회명');
  });

  it('아이템 소스는 mergedItems 우선 (합배송 껍데기)', () => {
    const shell = {
      ...baseOrder,
      order_items: [],
      mergedItems: [{ product_id: 1, quantity: 1, price_at_purchase: 10000, product_name: '도서A', category: '도서' }],
    };
    const rows = buildOrderExcelRows({ orders: [shell], type: 'book', events, productsMap });
    expect(rows).toHaveLength(1);
    expect(rows[0]['상품명']).toBe('도서A');
  });

  it('분류·상품정보 모두 없는 아이템은 제외', () => {
    const order = { ...baseOrder, order_items: [{ product_id: 999, quantity: 1, price_at_purchase: 0 }] };
    const rows = buildOrderExcelRows({ orders: [order], type: 'all', events, productsMap });
    expect(rows).toHaveLength(0);
  });

  it('스냅샷 없이 products join만 있어도 분류 판정 (출고 데이터 형태)', () => {
    const order = {
      ...baseOrder,
      order_items: [{ product_id: 3, quantity: 1, price_at_purchase: 5000, products: { name: '검사C', category: '검사' } }],
    };
    const rows = buildOrderExcelRows({ orders: [order], type: 'test', events, productsMap: {} });
    expect(rows).toHaveLength(1);
    expect(rows[0]['상품명']).toBe('검사C');
    expect(rows[0]['카테고리']).toBe('검사');
  });
});
